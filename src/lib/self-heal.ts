import { createLogger } from "@/lib/logger";
import { nimChat } from "@/lib/nvidia";
import { NIM_MODELS } from "@/lib/nvidia";

const log = createLogger("self-heal");

/**
 * SELF-HEALING WRAPPER for agent execution.
 *
 * Philosophy
 * ----------
 * An agent that fails and says "try again" is a tool. An agent that
 * fails, reasons about the failure, adjusts, and retries is a service.
 * This wrapper turns an existing agent handler into the second thing —
 * without modifying the handler itself.
 *
 * How it works
 * ------------
 *   const healed = withSelfHeal(originalHandler, { maxRetries: 2 });
 *   const result = await healed(input);
 *
 * 1. Call the underlying handler.
 * 2. On success: return the result.
 * 3. On failure: ask a small model (Claude Haiku by default) to
 *    diagnose the error and propose a modified input.
 * 4. Retry with the modified input, up to `maxRetries`.
 * 5. If all retries fail, throw the original error with a `_healAttempts`
 *    trail attached for observability.
 *
 * This wraps the `auto-heal` agent's reasoning in a transparent retry
 * loop — existing agent routes opt in by wrapping themselves with
 * withSelfHeal() in their handler factory call.
 *
 * Boundaries
 * ----------
 *  - Does NOT retry on security failures (jailbreak/PII/policy) — those
 *    must surface to the user immediately.
 *  - Does NOT retry on 429 from upstream (rate-limit), 401 (auth), or
 *    403 (forbidden). The diagnoser won't help those.
 *  - Capped at 2 retries by default. Beyond that we assume the task
 *    is fundamentally off.
 */

export interface HealAttempt {
  attempt: number;
  error: string;
  diagnosis: string;
  modifiedInput: Record<string, unknown>;
}

export interface SelfHealResult<T> {
  value: T;
  _healAttempts?: HealAttempt[];
}

export interface SelfHealOptions {
  /** Max retries BEFORE throwing the original error. Default 2. */
  maxRetries?: number;
  /** Optional label — shows in logs. */
  label?: string;
  /** Override the diagnosis model (default: Nemotron Ultra via NIM). */
  diagnoseModel?: string;
}

/** Errors we won't try to heal from — re-throw immediately. */
function isTerminalError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  return (
    msg.includes("unauthoriz") ||
    msg.includes("forbidden") ||
    msg.includes("rate limit") ||
    msg.includes("jailbreak") ||
    msg.includes("pii detected") ||
    msg.includes("content policy")
  );
}

/**
 * Ask the diagnoser model to propose a modified input.
 * Returns null if the diagnosis couldn't be parsed — caller should
 * treat that as "can't heal, give up".
 */
async function diagnoseAndPropose(
  originalInput: Record<string, unknown>,
  errorMessage: string,
  options: { label?: string; diagnoseModel?: string },
): Promise<{ diagnosis: string; modifiedInput: Record<string, unknown> } | null> {
  const system = `You are an agent self-healing diagnoser. An agent attempt failed. Inspect the original input and error, then propose a modified input that is likely to succeed. Return ONLY valid JSON with two keys: "diagnosis" (string, 1-2 sentences) and "modified_input" (object with the same shape as the original, but with adjusted values). No markdown, no code fence, no commentary.`;

  const prompt = [
    `AGENT: ${options.label ?? "unknown"}`,
    `ORIGINAL_INPUT: ${JSON.stringify(originalInput).slice(0, 2000)}`,
    `ERROR: ${errorMessage.slice(0, 500)}`,
    "",
    "Respond with JSON only.",
  ].join("\n");

  try {
    const resp = await nimChat(
      options.diagnoseModel ?? NIM_MODELS.flagship,
      [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      { maxTokens: 500, temperature: 0.2 },
    );

    // The diagnoser sometimes wraps in ```json ... ```. Strip.
    const cleaned = resp.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    if (typeof parsed?.diagnosis !== "string" || typeof parsed?.modified_input !== "object") {
      return null;
    }

    return {
      diagnosis: parsed.diagnosis,
      modifiedInput: parsed.modified_input as Record<string, unknown>,
    };
  } catch (err) {
    log.warn("self-heal diagnoser failed", { error: (err as Error).message });
    return null;
  }
}

/**
 * Wrap an agent handler with self-healing retries.
 *
 *   export const POST = createAgentRoute({
 *     name: "my-agent",
 *     handler: withSelfHeal(async ({ input }) => {
 *       // ... your existing logic
 *     }, { label: "my-agent" }),
 *   });
 */
export function withSelfHeal<Ctx extends { input: Record<string, unknown> }, R>(
  handler: (ctx: Ctx) => Promise<R>,
  options: SelfHealOptions = {},
): (ctx: Ctx) => Promise<R & { _healAttempts?: HealAttempt[] }> {
  const maxRetries = options.maxRetries ?? 2;

  return async (ctx: Ctx) => {
    const attempts: HealAttempt[] = [];
    let currentCtx = ctx;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await handler(currentCtx);
        // Attach heal attempt trail for observability (only if we healed).
        if (attempts.length > 0 && typeof result === "object" && result !== null) {
          return { ...(result as object), _healAttempts: attempts } as R & {
            _healAttempts?: HealAttempt[];
          };
        }
        return result as R & { _healAttempts?: HealAttempt[] };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (isTerminalError(lastError) || attempt === maxRetries) {
          break;
        }

        log.info("self-heal — attempting to diagnose + retry", {
          label: options.label,
          attempt: attempt + 1,
          error: lastError.message,
        });

        const proposal = await diagnoseAndPropose(
          currentCtx.input,
          lastError.message,
          options,
        );

        if (!proposal) break;

        attempts.push({
          attempt: attempt + 1,
          error: lastError.message,
          diagnosis: proposal.diagnosis,
          modifiedInput: proposal.modifiedInput,
        });

        // Merge the proposed input over the original. Explicit override
        // semantics — we don't trust the diagnoser to drop keys.
        currentCtx = {
          ...currentCtx,
          input: { ...currentCtx.input, ...proposal.modifiedInput },
        };
      }
    }

    // Exhausted retries — throw the original with trail attached.
    const enriched = new Error(lastError?.message ?? "self-heal exhausted");
    (enriched as unknown as { _healAttempts: HealAttempt[] })._healAttempts = attempts;
    throw enriched;
  };
}
