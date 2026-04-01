import { createLogger } from "@/lib/logger";

const log = createLogger("retry");

interface RetryOptions {
  /** Maximum number of retries (default: 3) */
  maxRetries?: number;
  /** Base delay in milliseconds — doubles each attempt (default: 1000) */
  baseDelay?: number;
  /** Human-readable label for log messages */
  label?: string;
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
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, label = "operation" } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

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

      log.warn(`${label} attempt ${attempt + 1} failed — retrying in ${delay}ms`, {
        attempt: String(attempt + 1),
        maxRetries: String(maxRetries),
        delay: String(delay),
        error: err instanceof Error ? err.message : String(err),
      });

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
