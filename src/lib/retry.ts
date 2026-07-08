import { createLogger } from "@/lib/logger";

const log = createLogger("retry");

interface RetryOptions {
  /** Maximum number of retries (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds — doubles each attempt (default: 1000) */
  baseDelay?: number;
  /** Human-readable label for log messages */
  label?: string;
  /**
   * Predicate to decide whether an error is worth retrying. Return false
   * to break immediately (default retries everything). Provided so
   * callers stop wasting ~3s of backoff — and shared-circuit-breaker
   * failures — on deterministic 4xx errors like a bad BYOK key
   * (BACKLOG retry-4xx).
   */
  shouldRetry?: (err: unknown) => boolean;
}

/** Non-retryable client errors: 4xx except 408 (timeout) and 429 (rate). */
function isNonRetryableStatus(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status =
    (err as { status?: number }).status ??
    (err as { statusCode?: number }).statusCode;
  if (typeof status !== "number") return false;
  if (status === 408 || status === 429) return false;
  return status >= 400 && status < 500;
}

/**
 * Retry a function with exponential backoff and jitter.
 *
 * Delay sequence (with default baseDelay=1000):
 *   Attempt 1 → ~1s, Attempt 2 → ~2s, Attempt 3 → ~4s
 *
 * Jitter adds ±25% to prevent thundering-herd on shared providers.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    label = "operation",
    shouldRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      // Break immediately on deterministic client errors — retrying a
      // 400/401/403 just burns backoff and taxes the shared breaker.
      const retryable = shouldRetry
        ? shouldRetry(err)
        : !isNonRetryableStatus(err);
      if (!retryable) {
        log.warn(`${label} failed with non-retryable error — not retrying`, {
          error: err instanceof Error ? err.message : String(err),
        });
        break;
      }

      if (attempt >= maxRetries) {
        log.error(`${label} failed after ${maxRetries} retries`, {
          error: err instanceof Error ? err.message : String(err),
        });
        break;
      }

      // Exponential backoff: baseDelay * 2^attempt
      const exponentialDelay = baseDelay * Math.pow(2, attempt);
      // Jitter: ±25%
      const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
      const delay = Math.round(exponentialDelay + jitter);

      log.warn(
        `${label} attempt ${attempt + 1} failed — retrying in ${delay}ms`,
        {
          attempt: String(attempt + 1),
          maxRetries: String(maxRetries),
          delay: String(delay),
          error: err instanceof Error ? err.message : String(err),
        },
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
