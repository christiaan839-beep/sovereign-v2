/**
 * TIMEOUT WRAPPER — hard deadline for any async operation.
 *
 * Wraps a Promise-returning function with AbortSignal.timeout() so that
 * hung network calls can't block indefinitely. If the underlying call
 * respects AbortSignal (fetch, most SDKs), the request is genuinely
 * cancelled — not just abandoned on our side.
 *
 * Composition order matters: this should wrap the OUTERMOST layer so
 * the entire retry+circuit-breaker chain has a hard upper bound.
 *
 *   withTimeout(30_000, () =>
 *     circuitBreaker.execute(() =>
 *       withRetry(() => provider.call(signal))
 *     )
 *   )
 *
 * @param ms       Milliseconds before the operation is aborted
 * @param fn       Function that performs the async work. Receives an
 *                 AbortSignal — pass it to fetch/SDK so the call is
 *                 genuinely cancelled, not just abandoned.
 * @param label    Human-readable label for the timeout error message
 */
import { createLogger } from "@/lib/logger";

const log = createLogger("with-timeout");

export class TimeoutError extends Error {
  constructor(public readonly label: string, public readonly ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(
  ms: number,
  fn: (signal: AbortSignal) => Promise<T>,
  label: string = "operation",
): Promise<T> {
  const controller = new AbortController();

  // Two-layer defense: (1) abort the signal so signal-aware callees
  // (fetch, most SDKs) genuinely cancel, AND (2) race the callee promise
  // against a rejection so callees that ignore the signal don't block
  // us forever. Both are needed — either alone leaves a failure mode
  // open. See reliability.test.ts for the regression that drove this.
  let timer: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new TimeoutError(label, ms);
      controller.abort(err);
      log.warn("Operation timed out", { label, ms: String(ms) });
      reject(err);
    }, ms);
  });

  try {
    return await Promise.race([fn(controller.signal), timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Convenience wrapper when the callee doesn't accept an AbortSignal —
 * uses Promise.race to enforce the deadline at the wrapper level.
 * The underlying request keeps running until it resolves (or the process
 * dies), but our code no longer waits for it.
 *
 * Prefer withTimeout() when the callee supports AbortSignal — it actually
 * cancels the work rather than just ignoring the result.
 */
export async function raceTimeout<T>(
  ms: number,
  fn: () => Promise<T>,
  label: string = "operation",
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(label, ms)), ms),
    ),
  ]);
}

/**
 * Timeout defaults per operation class. Centralized so we can tune them
 * from one place and reason about the total latency budget of a request.
 */
export const TIMEOUTS = {
  /** Single AI provider call — generous because LLMs can be slow */
  AI_CALL: 30_000,
  /** Fast-path AI call (Cerebras, classification) — should be snappy */
  AI_FAST: 10_000,
  /** Extended thinking / Opus / deep reasoning — allow headroom */
  AI_DEEP: 90_000,
  /** Database queries — should never be slow */
  DB: 5_000,
  /** External HTTP integrations (Tavily, Stripe, etc.) */
  HTTP: 15_000,
  /** Vector similarity queries */
  VECTOR: 3_000,
} as const;
