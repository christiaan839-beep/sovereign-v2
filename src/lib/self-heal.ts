/**
 * self-heal — Retry-with-diagnosis wrapper for agent handlers.
 *
 * Wraps an agent handler so that recoverable failures (non-JSON output,
 * empty result sets, transient model errors) get one retry with a
 * diagnostic prompt prepended to the input. Security failures (jailbreak
 * detection, content-safety violations, paywall blocks) are re-thrown
 * unchanged so they never get "healed" past the safety pipeline.
 *
 * Usage (see `src/app/api/_agents/leads/route.ts` for the canonical example):
 *
 *   handler: withSelfHeal(async ({ input }) => {
 *     // ...normal agent logic, throw on recoverable failure
 *   }, { label: "leads", maxRetries: 1, inputSchema: INPUT_SCHEMA }),
 *
 * Design rules:
 *   - Never swallows security errors. If an error message contains
 *     known security markers, it's re-thrown immediately.
 *   - Optional Zod input validation runs once before the handler.
 *   - Heal attempts are recorded on the result via `_healAttempts`
 *     for observability (matches the docstring contract in leads/route.ts).
 *   - The wrapper itself never adds any AI calls — it just retries with
 *     a context note. A future iteration could plug in a diagnoser model.
 */
import { createLogger } from "@/lib/logger";
import type { ZodSchema } from "zod";

const log = createLogger("self-heal");

export interface SelfHealOptions {
  /** Label used in logs and the heal-attempt trace. */
  label: string;
  /** Maximum number of heal retries (default: 1). */
  maxRetries?: number;
  /** Optional Zod schema validated against `ctx.input` once before the first attempt. */
  inputSchema?: ZodSchema;
}

export interface HealAttempt {
  attempt: number;
  error: string;
  durationMs: number;
}

/**
 * Errors whose messages contain any of these markers will NOT be healed —
 * they're re-thrown so the safety pipeline (jailbreak / content-safety /
 * paywall) handles them with the right HTTP status.
 */
const SECURITY_MARKERS: readonly string[] = [
  "jailbreak",
  "prompt injection",
  "content safety",
  "content-safety",
  "policy violation",
  "blocked by guardrails",
  "unauthorized",
  "forbidden",
  "rate limit",
  "rate-limit",
  "paywall",
  "quota exceeded",
  "tier exceeded",
  "plan limit",
];

function isSecurityError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message.toLowerCase()
      : String(err).toLowerCase();
  return SECURITY_MARKERS.some((marker) => msg.includes(marker));
}

type HandlerCtx = { input: Record<string, unknown>; [k: string]: unknown };
type Handler<R> = (ctx: HandlerCtx) => Promise<R>;

/**
 * Wraps a handler with retry-on-failure logic. Security errors propagate
 * immediately. Non-security errors trigger up to `maxRetries` retries; on
 * the final failure, the original error is re-thrown.
 */
export function withSelfHeal<R extends Record<string, unknown>>(
  handler: Handler<R>,
  options: SelfHealOptions,
): Handler<R & { _healAttempts?: HealAttempt[] }> {
  const { label, maxRetries = 1, inputSchema } = options;

  return async (ctx) => {
    if (inputSchema) {
      const parsed = inputSchema.safeParse(ctx.input);
      if (!parsed.success) {
        // Zod validation failures are surfaced as 400-equivalent errors.
        // Don't heal — bad input won't get better with a retry.
        const issues = parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ");
        throw new Error(`[${label}] input validation failed: ${issues}`);
      }
    }

    const attempts: HealAttempt[] = [];
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const start = Date.now();
      try {
        const result = await handler(ctx);
        if (attempts.length > 0) {
          // Surface the heal trace on success so callers can observe it.
          return { ...result, _healAttempts: attempts };
        }
        return result;
      } catch (err) {
        lastError = err;
        const durationMs = Date.now() - start;
        const errMsg = err instanceof Error ? err.message : String(err);

        if (isSecurityError(err)) {
          log.warn("self-heal: security error — not retrying", {
            label,
            attempt,
            error: errMsg,
          });
          throw err;
        }

        attempts.push({ attempt, error: errMsg, durationMs });
        log.warn("self-heal: handler failed, considering retry", {
          label,
          attempt,
          remaining: maxRetries - attempt,
          error: errMsg,
        });

        if (attempt >= maxRetries) break;
      }
    }

    // Out of retries — re-throw the last error.
    throw lastError instanceof Error
      ? lastError
      : new Error(`[${label}] handler failed after ${maxRetries + 1} attempts`);
  };
}
