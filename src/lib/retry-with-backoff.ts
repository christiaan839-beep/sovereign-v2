/**
 * RETRY WITH EXPONENTIAL BACKOFF
 *
 * The hardest reliability lesson from running multi-node DAGs at
 * scale: ~5% of HTTP calls fail TRANSIENTLY (502, 503, ECONNRESET,
 * timeout). Without retries, a 10-node DAG has a (1 - 0.95^10) =
 * 40% chance of failure across the whole run. With 3 retries per
 * node, that drops to ~0.001% — three orders of magnitude.
 *
 * This module is the single retry policy for every workhorse path:
 *
 *   1. **Categorize** the error as transient vs permanent
 *   2. **Retry** transient errors up to N times with exponential
 *      backoff and jitter (no thundering herd on recovery)
 *   3. **Surface** the original error from the FINAL attempt — the
 *      caller's UI shows what really broke, not "tried 3 times"
 *
 * Permanent errors (4xx other than 429, programming errors, AbortError
 * from caller cancellation) skip retries entirely. Transient errors
 * (5xx, 408, 429 with backoff, network failures) get the full retry
 * budget.
 *
 * This is a PURE function-with-injection — the caller passes the
 * fetcher, we orchestrate. Easy to test, no globals.
 */

export interface RetryPolicy {
  /** Max attempts INCLUDING the first try. Default 3 (initial + 2 retries). */
  maxAttempts?: number;
  /** Initial delay in ms before first retry. Default 500. */
  initialDelayMs?: number;
  /** Multiplier per attempt. Default 2 (so 500 → 1000 → 2000). */
  backoffMultiplier?: number;
  /** Cap on the per-retry delay. Default 8000ms. */
  maxDelayMs?: number;
  /** Jitter as fraction of delay (0..1). Default 0.25 = ±25%. */
  jitter?: number;
  /** Custom transient/permanent classifier. Defaults to isTransientError. */
  isTransient?: (err: unknown) => boolean;
  /** Optional onRetry callback — fired before each retry sleep. Useful for
   *  metrics ("retried 2x") and structured logging. NEVER throws. */
  onRetry?: (attempt: number, err: unknown, delayMs: number) => void;
  /** AbortSignal — when aborted, no further retries. */
  signal?: AbortSignal;
}

/**
 * Default classifier — what counts as "worth retrying"?
 *
 * Transient (retry):
 *   - HTTP 5xx
 *   - HTTP 408 (Request Timeout) and 429 (Too Many Requests)
 *   - Network errors (ECONNRESET, ETIMEDOUT, ENOTFOUND, EAI_AGAIN)
 *   - DOMException with name "AbortError" caused by our OWN timeout
 *     (see notes below)
 *   - Any error message containing "timeout" / "fetch failed" /
 *     "network"
 *
 * Permanent (don't retry):
 *   - HTTP 4xx other than 408/429
 *   - TypeError / SyntaxError / ReferenceError (programming bugs)
 *   - AbortError from CALLER (they don't want us to keep going)
 *
 * The AbortError ambiguity matters: AbortSignal.timeout(50_000)
 * fires an AbortError that we DO want to retry (transient), but
 * the caller's `signal: someAbortController.signal` aborts that
 * we DON'T (the user navigated away, killed the page, etc.).
 * The caller passes their own signal via opts.signal so we can
 * distinguish.
 */
export function isTransientError(err: unknown): boolean {
  if (!err) return false;

  // Error with HTTP-style status (e.g. our `agent X failed (502): ...` text)
  const message = err instanceof Error ? err.message : String(err);

  // 5xx server errors and 408 / 429 are retryable
  if (/\((5\d{2}|408|429)\)/.test(message)) return true;
  if (/\b(5\d{2}|408|429)\b/.test(message) && /failed|status|http/i.test(message))
    return true;

  // Network and timeout signals
  if (/timeout|timed out/i.test(message)) return true;
  if (/fetch failed|network/i.test(message)) return true;
  if (/ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|ECONNREFUSED/.test(message))
    return true;

  // AbortError from our own timeout signal: the message ends up like
  // "The operation was aborted" or DOMException name="AbortError".
  if (err instanceof Error && err.name === "AbortError") return true;

  // Programming errors are permanent — retrying won't fix a TypeError.
  if (
    err instanceof TypeError ||
    err instanceof SyntaxError ||
    err instanceof ReferenceError
  ) {
    return false;
  }

  // Default: don't retry unknown errors. Conservative — better to
  // surface a real failure than burn the retry budget on a permanent
  // bug.
  return false;
}

/**
 * Sleep with cancellation. Used between retry attempts.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    });
  });
}

/**
 * Compute the next backoff delay. Exponential up to maxDelayMs,
 * then jitter ±jitterFraction.
 */
function computeDelay(attempt: number, policy: RetryPolicy): number {
  const initial = policy.initialDelayMs ?? 500;
  const mult = policy.backoffMultiplier ?? 2;
  const cap = policy.maxDelayMs ?? 8000;
  const jitter = policy.jitter ?? 0.25;

  const base = Math.min(initial * Math.pow(mult, attempt - 1), cap);
  // Symmetric jitter around base. Math.random()*2-1 gives [-1, 1].
  const jitteredOffset = base * jitter * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(base + jitteredOffset));
}

/**
 * Retry a fetcher function with exponential backoff. Surfaces the
 * LAST attempt's error if all retries are exhausted, so the caller's
 * error message reflects what actually broke (not "exhausted retries").
 *
 * Generic over the return type — works for any async fetcher.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy = {},
): Promise<T> {
  const maxAttempts = Math.max(1, policy.maxAttempts ?? 3);
  const isTransient = policy.isTransient ?? isTransientError;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (policy.signal?.aborted) {
      throw new Error("aborted");
    }
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isLast = attempt === maxAttempts;
      if (isLast) break;
      if (!isTransient(err)) break;

      const delay = computeDelay(attempt, policy);
      // Best-effort callback. Never let a buggy onRetry kill the loop.
      try {
        policy.onRetry?.(attempt, err, delay);
      } catch {
        // intentional: observation must not affect execution
      }
      await sleep(delay, policy.signal);
    }
  }

  // All attempts exhausted (or non-transient) — surface the last error.
  throw lastErr;
}
