/**
 * Self-heal — wraps an agent handler with retry-with-backoff. Used by 7
 * agent routes today (agri-intel, compliance-monitor, healthcare-docs,
 * supply-chain, leads, threat-hunt, prior-auth) to absorb transient
 * upstream failures from NIM / Tavily / Anthropic without surfacing
 * them to the user.
 *
 * Behaviour on each call:
 *   1. Run the handler.
 *   2. If it throws OR returns `{ error: "..." }`, log to `error_logs`
 *      via `recordSelfHealEvent` (best-effort) and retry.
 *   3. Up to `maxAttempts` (default 3 = 1 try + 2 retries) with
 *      exponential backoff: 250 ms, 500 ms, 1000 ms.
 *   4. On final failure, return the last result envelope unchanged so
 *      the caller's existing error-handling path still works.
 *
 * Out of scope:
 *   - Per-attempt model swap. The unified router (`src/lib/ai.ts`)
 *     already cascades across providers internally; double-cascading
 *     here causes surprising spend.
 *   - Circuit breaker. Lives in `src/lib/circuit-breaker.ts` and is
 *     wired at the provider client level.
 */

import { db } from "@/db";
import { errorLogs } from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("self-heal");

export interface SelfHealOptions {
  /** Total tries before giving up. Default 3 (= 1 initial + 2 retries). */
  maxAttempts?: number;
  /** Base delay between attempts in ms; doubles each retry. */
  baseDelayMs?: number;
  /** Optional label for `error_logs.agent_id` so you can filter by agent. */
  label?: string;
}

export type AgentHandler<TArgs extends unknown[], TResult> = (
  ...args: TArgs
) => Promise<TResult>;

/**
 * Treat results that look like `{ error: "..." }` as failures so a
 * handler doesn't have to throw to trigger a retry. Keeps existing
 * agent code that returns error envelopes working.
 */
function isErrorEnvelope(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error?: unknown }).error === "string"
  );
}

async function recordSelfHealEvent(args: {
  label: string;
  attempt: number;
  error: unknown;
}): Promise<void> {
  try {
    const message =
      args.error instanceof Error ? args.error.message : String(args.error);
    const stack =
      args.error instanceof Error ? (args.error.stack ?? null) : null;
    await db.insert(errorLogs).values({
      userId: "system",
      agentId: `self-heal:${args.label}`,
      message,
      stack,
      context: JSON.stringify({ attempt: args.attempt, label: args.label }),
      severity: "low",
    });
  } catch {
    // error_logs unreachable (table missing or DB down) — log only.
  }
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Wrap a handler with retry-on-failure semantics. Signature is
 * preserved exactly — existing `withSelfHeal(async ({ input }) => ...)`
 * call sites work unchanged.
 */
export function withSelfHeal<TArgs extends unknown[], TResult>(
  handler: AgentHandler<TArgs, TResult>,
  options: SelfHealOptions = {},
): AgentHandler<TArgs, TResult> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = options.baseDelayMs ?? 250;
  const label = options.label ?? "agent";

  return async (...args: TArgs): Promise<TResult> => {
    let lastError: unknown;
    let lastResult: TResult | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await handler(...args);
        if (isErrorEnvelope(result)) {
          lastResult = result;
          lastError = (result as { error: string }).error;
          log.warn("Agent returned error envelope", { label, attempt });
          await recordSelfHealEvent({ label, attempt, error: lastError });
        } else {
          if (attempt > 1) {
            log.info("Agent recovered after retry", { label, attempt });
          }
          return result;
        }
      } catch (err) {
        lastError = err;
        log.warn("Agent threw — retrying", {
          label,
          attempt,
          error: err instanceof Error ? err.message : String(err),
        });
        await recordSelfHealEvent({ label, attempt, error: err });
      }

      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * Math.pow(2, attempt - 1));
      }
    }

    if (lastResult !== undefined) return lastResult;
    if (lastError instanceof Error) throw lastError;
    throw new Error(`self-heal exhausted retries for ${label}`);
  };
}
