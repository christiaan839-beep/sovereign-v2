/**
 * SOVEREIGN MATRIX — Error Prevention & Auto-Recovery System
 *
 * Unified resilience layer that prevents errors from reaching users.
 * Composes: retry logic, circuit breaking, error classification, and
 * cached fallbacks into a single cohesive module.
 *
 * Components:
 *   safeFetch()       — fetch() wrapper with retries, timeout, cache fallback
 *   withRetry()       — generic retry wrapper for any async function
 *   CircuitBreaker    — per-service failure tracking with open/half-open/closed states
 *   ErrorClassifier   — categorizes errors for proper handling strategy
 */

import { createLogger } from "@/lib/logger";
import { reportError } from "@/lib/error-reporter";

const log = createLogger("error-recovery");

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

/** Discriminated union for safe return values — never throws. */
export type Result<T> =
  | { ok: true; data: T; fromCache: boolean }
  | { ok: false; error: RecoveryError; fromCache: false };

/** Structured error with classification metadata. */
export interface RecoveryError {
  message: string;
  category: ErrorCategory;
  statusCode?: number;
  retryable: boolean;
  retryAfterMs?: number;
  originalError?: unknown;
}

/** Error classification categories. */
export type ErrorCategory = "TRANSIENT" | "CLIENT" | "FATAL" | "RATE_LIMITED";

/** Configuration for safeFetch(). */
export interface SafeFetchOptions {
  /** Maximum number of retry attempts (default: 3). */
  maxRetries?: number;
  /** Request timeout in milliseconds (default: 10000). */
  timeoutMs?: number;
  /** Cache key — if provided, enables read-through cache fallback. */
  cacheKey?: string;
  /** Cache TTL in seconds (default: 300 = 5 minutes). */
  cacheTtlSeconds?: number;
  /** CircuitBreaker instance to use for this service. */
  circuitBreaker?: ServiceCircuitBreaker;
  /** Additional headers to merge into the request. */
  headers?: Record<string, string>;
  /** Human-readable label for log messages. */
  label?: string;
}

/** Configuration for withRetry(). */
export interface RetryOptions<T> {
  /** Maximum number of retry attempts (default: 3). */
  maxRetries?: number;
  /** Base delay in ms — doubles each attempt (default: 1000). */
  baseDelayMs?: number;
  /** Called before each retry with the attempt number and error. */
  onRetry?: (attempt: number, error: unknown) => void;
  /** Human-readable label for log messages. */
  label?: string;
  /** Predicate to decide if an error is retryable (default: all errors). */
  shouldRetry?: (error: unknown) => boolean;
}

/** Configuration for ServiceCircuitBreaker. */
export interface CircuitBreakerConfig {
  /** Human-readable service name for logging. */
  name: string;
  /** Consecutive failures to trigger open state (default: 5). */
  failureThreshold?: number;
  /** Milliseconds to wait before probing in half-open state (default: 30000). */
  resetTimeoutMs?: number;
}

/** Possible states of a circuit breaker. */
export type CircuitState = "closed" | "open" | "half-open";

/** Snapshot of circuit breaker health for monitoring dashboards. */
export interface CircuitSnapshot {
  name: string;
  state: CircuitState;
  consecutiveFailures: number;
  totalFailures: number;
  totalSuccesses: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  openedAt: number | null;
}

// ═══════════════════════════════════════════════════════════════
// INTERNAL CACHE — lightweight per-key response cache
// ═══════════════════════════════════════════════════════════════

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const responseCache = new Map<string, CacheEntry<unknown>>();
const MAX_CACHE_ENTRIES = 200;

function cacheGet<T>(key: string): T | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function cacheSet<T>(key: string, data: T, ttlSeconds: number): void {
  // Evict oldest when full
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    if (oldest) responseCache.delete(oldest);
  }
  responseCache.set(key, { data, expiresAt: Date.now() + ttlSeconds * 1000 });
}

// ═══════════════════════════════════════════════════════════════
// ERROR CLASSIFIER
// ═══════════════════════════════════════════════════════════════

/**
 * Categorize an error for proper handling strategy.
 *
 * Categories:
 *   TRANSIENT     — network timeout, 502/503/504 — safe to auto-retry
 *   CLIENT        — 400/401/403/404/422 — do not retry, surface user message
 *   FATAL         — code error, missing dependency — log and alert
 *   RATE_LIMITED   — 429 — wait for Retry-After header then retry
 */
export const ErrorClassifier = {
  /**
   * Classify an error or HTTP status code into a recovery category.
   * @param error - The caught error, Response, or status code
   * @returns A RecoveryError with classification metadata
   */
  classify(error: unknown): RecoveryError {
    // HTTP Response object
    if (error instanceof Response || (error && typeof error === "object" && "status" in error)) {
      const status = (error as { status: number }).status;
      return ErrorClassifier.fromStatus(status, error);
    }

    // AbortError / timeout
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        message: "Request timed out",
        category: "TRANSIENT",
        retryable: true,
        originalError: error,
      };
    }

    // TypeError from fetch (network failure, DNS, etc.)
    if (error instanceof TypeError) {
      return {
        message: `Network error: ${error.message}`,
        category: "TRANSIENT",
        retryable: true,
        originalError: error,
      };
    }

    // SyntaxError from JSON.parse
    if (error instanceof SyntaxError) {
      return {
        message: `JSON parse failure: ${error.message}`,
        category: "TRANSIENT",
        retryable: true,
        originalError: error,
      };
    }

    // Generic Error
    if (error instanceof Error) {
      // Check for network-related error messages
      const msg = error.message.toLowerCase();
      if (
        msg.includes("timeout") ||
        msg.includes("econnreset") ||
        msg.includes("econnrefused") ||
        msg.includes("socket hang up") ||
        msg.includes("network") ||
        msg.includes("fetch failed") ||
        msg.includes("aborted")
      ) {
        return {
          message: error.message,
          category: "TRANSIENT",
          retryable: true,
          originalError: error,
        };
      }

      // Everything else is a code-level error
      return {
        message: error.message,
        category: "FATAL",
        retryable: false,
        originalError: error,
      };
    }

    // Unknown shape
    return {
      message: String(error),
      category: "FATAL",
      retryable: false,
      originalError: error,
    };
  },

  /**
   * Classify from an HTTP status code.
   * @param status - HTTP status code
   * @param originalError - optional original error/response for context
   */
  fromStatus(status: number, originalError?: unknown): RecoveryError {
    // 429 — Rate limited
    if (status === 429) {
      // Extract Retry-After if available
      let retryAfterMs: number | undefined;
      if (originalError instanceof Response) {
        const retryAfter = originalError.headers.get("Retry-After");
        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          retryAfterMs = isNaN(seconds) ? undefined : seconds * 1000;
        }
      }
      return {
        message: `Rate limited (429)`,
        category: "RATE_LIMITED",
        statusCode: 429,
        retryable: true,
        retryAfterMs: retryAfterMs ?? 5000,
        originalError,
      };
    }

    // 400, 401, 403, 404, 405, 409, 422 — Client errors, do not retry
    if (status >= 400 && status < 500) {
      return {
        message: `Client error (${status})`,
        category: "CLIENT",
        statusCode: status,
        retryable: false,
        originalError,
      };
    }

    // 502, 503, 504 — Transient server errors, safe to retry
    if (status === 502 || status === 503 || status === 504) {
      return {
        message: `Server error (${status})`,
        category: "TRANSIENT",
        statusCode: status,
        retryable: true,
        originalError,
      };
    }

    // 500, 501 and other 5xx — may be transient
    if (status >= 500) {
      return {
        message: `Server error (${status})`,
        category: "TRANSIENT",
        statusCode: status,
        retryable: true,
        originalError,
      };
    }

    // Unexpected status
    return {
      message: `Unexpected status (${status})`,
      category: "FATAL",
      statusCode: status,
      retryable: false,
      originalError,
    };
  },

  /**
   * Check whether an error is retryable based on its classification.
   */
  isRetryable(error: unknown): boolean {
    return ErrorClassifier.classify(error).retryable;
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// CIRCUIT BREAKER — per-service failure tracking
// ═══════════════════════════════════════════════════════════════

/**
 * Generic service-level circuit breaker.
 *
 * State machine:
 *   CLOSED   → normal operation, requests flow through
 *   OPEN     → after `failureThreshold` consecutive failures, all calls
 *              return cached data (if available) or a fast error
 *   HALF-OPEN → after `resetTimeoutMs`, allows exactly one probe request.
 *              Success closes the circuit; failure reopens it.
 *
 * Usage:
 *   const breaker = new ServiceCircuitBreaker({ name: "stripe-api" });
 *   const result = await breaker.execute(() => fetch(...));
 */
export class ServiceCircuitBreaker {
  private state: CircuitState = "closed";
  private consecutiveFailures = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private lastFailureAt: number | null = null;
  private lastSuccessAt: number | null = null;
  private openedAt: number | null = null;
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  constructor(config: CircuitBreakerConfig) {
    this.name = config.name;
    this.failureThreshold = config.failureThreshold ?? 5;
    this.resetTimeoutMs = config.resetTimeoutMs ?? 30_000;
  }

  /**
   * Execute a function through the circuit breaker.
   * @param fn - The async operation to protect
   * @returns The result of fn(), or throws if the circuit is open with no probe allowed
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // OPEN — check if reset timeout has elapsed
    if (this.state === "open") {
      const elapsed = Date.now() - (this.openedAt ?? 0);
      if (elapsed < this.resetTimeoutMs) {
        const remainingSec = Math.ceil((this.resetTimeoutMs - elapsed) / 1000);
        log.warn("Circuit open — failing fast", {
          service: this.name,
          retriesIn: `${remainingSec}s`,
        });
        throw new CircuitOpenError(this.name, remainingSec);
      }
      // Transition to half-open
      this.state = "half-open";
      log.info("Circuit half-open — sending probe", { service: this.name });
    }

    // HALF-OPEN or CLOSED — execute the function
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      throw err;
    }
  }

  /** Record a success — resets consecutive failures and closes the circuit. */
  private onSuccess(): void {
    if (this.state !== "closed") {
      log.info("Circuit closed — service recovered", { service: this.name });
    }
    this.consecutiveFailures = 0;
    this.totalSuccesses++;
    this.lastSuccessAt = Date.now();
    this.state = "closed";
    this.openedAt = null;
  }

  /** Record a failure — may trip the circuit open. */
  private onFailure(err: unknown): void {
    this.consecutiveFailures++;
    this.totalFailures++;
    this.lastFailureAt = Date.now();

    if (this.state === "half-open") {
      // Probe failed — reopen immediately
      this.state = "open";
      this.openedAt = Date.now();
      log.warn("Circuit reopened — probe failed", {
        service: this.name,
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = "open";
      this.openedAt = Date.now();
      log.error("Circuit opened — failure threshold reached", {
        service: this.name,
        failures: String(this.consecutiveFailures),
        threshold: String(this.failureThreshold),
      });
    } else {
      log.warn("Circuit failure recorded", {
        service: this.name,
        failures: `${this.consecutiveFailures}/${this.failureThreshold}`,
      });
    }
  }

  /**
   * Get a snapshot of the circuit breaker state for monitoring.
   * @returns Current state, failure counts, and timestamps
   */
  getState(): CircuitSnapshot {
    return {
      name: this.name,
      state: this.state,
      consecutiveFailures: this.consecutiveFailures,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
      openedAt: this.openedAt,
    };
  }

  /**
   * Manually reset the circuit to closed state (admin action).
   */
  reset(): void {
    this.state = "closed";
    this.consecutiveFailures = 0;
    this.openedAt = null;
    log.info("Circuit manually reset", { service: this.name });
  }
}

/** Error thrown when the circuit breaker is open and blocking requests. */
export class CircuitOpenError extends Error {
  public readonly retriesInSeconds: number;

  constructor(serviceName: string, retriesInSeconds: number) {
    super(
      `Circuit breaker "${serviceName}" is OPEN — service unavailable. Retry in ${retriesInSeconds}s.`
    );
    this.name = "CircuitOpenError";
    this.retriesInSeconds = retriesInSeconds;
  }
}

// ═══════════════════════════════════════════════════════════════
// withRetry() — generic retry wrapper for any async function
// ═══════════════════════════════════════════════════════════════

/**
 * Retry an async function with exponential backoff and jitter.
 *
 * Returns the result on success, or a RecoveryError on final failure —
 * never throws. Jitter adds up to 25% randomization to prevent
 * thundering-herd when many callers retry simultaneously.
 *
 * Delay sequence (with default baseDelayMs=1000):
 *   Attempt 1 fail → wait ~1s
 *   Attempt 2 fail → wait ~2s
 *   Attempt 3 fail → wait ~4s
 *
 * @param fn - The async operation to retry
 * @param options - Retry configuration
 * @returns Result<T> — { ok: true, data } on success, { ok: false, error } on final failure
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions<T> = {}
): Promise<Result<T>> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    onRetry,
    label = "operation",
    shouldRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await fn();
      return { ok: true, data, fromCache: false };
    } catch (err) {
      lastError = err;

      // If shouldRetry predicate is provided and returns false, stop immediately
      if (shouldRetry && !shouldRetry(err)) {
        log.warn(`${label} failed with non-retryable error`, {
          attempt: String(attempt + 1),
          error: err instanceof Error ? err.message : String(err),
        });
        break;
      }

      if (attempt >= maxRetries) {
        log.error(`${label} failed after ${maxRetries + 1} attempts`, {
          error: err instanceof Error ? err.message : String(err),
        });
        break;
      }

      // Exponential backoff: baseDelayMs * 2^attempt
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      // Jitter: 0% to +25% (positive only to avoid sub-base delays)
      const jitter = Math.round(exponentialDelay * 0.25 * Math.random());
      const delay = exponentialDelay + jitter;

      log.warn(`${label} attempt ${attempt + 1} failed — retrying in ${delay}ms`, {
        attempt: String(attempt + 1),
        maxRetries: String(maxRetries),
        delay: String(delay),
        error: err instanceof Error ? err.message : String(err),
      });

      // Fire onRetry callback
      if (onRetry) {
        try {
          onRetry(attempt + 1, err);
        } catch {
          // Callback errors must never break retry logic
        }
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  const classified = ErrorClassifier.classify(lastError);

  // Report to error-reporter for dashboard visibility
  reportError(lastError, `${label} exhausted retries`, {
    severity: classified.category === "FATAL" ? "high" : "medium",
  });

  return { ok: false, error: classified, fromCache: false };
}

// ═══════════════════════════════════════════════════════════════
// safeFetch() — resilient fetch() wrapper
// ═══════════════════════════════════════════════════════════════

/**
 * Safe fetch wrapper that prevents errors from reaching callers.
 *
 * Features:
 *   - Configurable timeout via AbortController (default 10s)
 *   - Automatic retries with exponential backoff for transient errors
 *   - Circuit breaker integration to prevent cascading failures
 *   - Falls back to cached response data when all retries are exhausted
 *   - Returns typed Result<T> — never throws
 *   - Classifies errors for proper downstream handling
 *   - Logs all failures to the error reporter
 *
 * @param url - The URL to fetch
 * @param init - Standard fetch RequestInit options
 * @param options - safeFetch configuration (retries, timeout, cache, circuit breaker)
 * @returns Result<T> with parsed JSON data on success, or RecoveryError on failure
 */
export async function safeFetch<T = unknown>(
  url: string,
  init?: RequestInit,
  options: SafeFetchOptions = {}
): Promise<Result<T>> {
  const {
    maxRetries = 3,
    timeoutMs = 10_000,
    cacheKey,
    cacheTtlSeconds = 300,
    circuitBreaker,
    headers: extraHeaders,
    label = url,
  } = options;

  // ── Circuit breaker gate ──
  if (circuitBreaker) {
    const snapshot = circuitBreaker.getState();
    if (snapshot.state === "open") {
      log.warn("safeFetch blocked by open circuit", {
        url,
        service: snapshot.name,
      });

      // Try cache fallback
      if (cacheKey) {
        const cached = cacheGet<T>(cacheKey);
        if (cached !== null) {
          log.info("safeFetch returning cached data (circuit open)", { url, cacheKey });
          return { ok: true, data: cached, fromCache: true };
        }
      }

      return {
        ok: false,
        fromCache: false,
        error: {
          message: `Circuit breaker "${snapshot.name}" is open`,
          category: "TRANSIENT",
          retryable: true,
          retryAfterMs: 30_000,
        },
      };
    }
  }

  // ── Retry loop ──
  const result = await withRetry<T>(
    async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        // Merge headers
        const mergedHeaders: Record<string, string> = {
          ...(init?.headers as Record<string, string> | undefined),
          ...extraHeaders,
        };

        const fetchFn = async () => {
          const response = await fetch(url, {
            ...init,
            headers: mergedHeaders,
            signal: controller.signal,
          });

          if (!response.ok) {
            const classified = ErrorClassifier.fromStatus(response.status, response);

            // For rate limiting, attach Retry-After info
            if (classified.category === "RATE_LIMITED") {
              const retryErr = new Error(classified.message) as Error & {
                statusCode: number;
                retryAfterMs: number;
              };
              retryErr.statusCode = response.status;
              retryErr.retryAfterMs = classified.retryAfterMs ?? 5000;
              throw retryErr;
            }

            // For client errors, do not retry
            if (classified.category === "CLIENT") {
              const clientErr = new Error(
                `${response.status} ${response.statusText}: ${url}`
              ) as Error & { statusCode: number; nonRetryable: boolean };
              clientErr.statusCode = response.status;
              clientErr.nonRetryable = true;
              throw clientErr;
            }

            // Transient server errors — throw to trigger retry
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          // Parse JSON safely
          const text = await response.text();
          try {
            return JSON.parse(text) as T;
          } catch {
            throw new SyntaxError(`Invalid JSON from ${url}: ${text.slice(0, 100)}`);
          }
        };

        // Run through circuit breaker if provided
        if (circuitBreaker) {
          return await circuitBreaker.execute(fetchFn);
        }
        return await fetchFn();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    {
      maxRetries,
      baseDelayMs: 1000,
      label,
      shouldRetry: (err) => {
        // Never retry client errors (400, 401, 403, etc.)
        if (err && typeof err === "object" && "nonRetryable" in err) {
          return false;
        }
        return ErrorClassifier.isRetryable(err);
      },
    }
  );

  // ── Success: populate cache ──
  if (result.ok) {
    if (cacheKey) {
      cacheSet(cacheKey, result.data, cacheTtlSeconds);
    }
    return result;
  }

  // ── Failure: try cache fallback ──
  if (cacheKey) {
    const cached = cacheGet<T>(cacheKey);
    if (cached !== null) {
      log.info("safeFetch returning stale cached data after failure", {
        url,
        cacheKey,
        error: result.error.message,
      });
      return { ok: true, data: cached, fromCache: true };
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// CONVENIENCE — pre-built circuit breakers for common services
// ═══════════════════════════════════════════════════════════════

/** Circuit breaker for external API integrations. */
export const externalApiBreaker = new ServiceCircuitBreaker({
  name: "external-api",
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
});

/** Circuit breaker for payment provider calls. */
export const paymentBreaker = new ServiceCircuitBreaker({
  name: "payment-provider",
  failureThreshold: 3,
  resetTimeoutMs: 60_000,
});

/** Circuit breaker for email/notification services. */
export const notificationBreaker = new ServiceCircuitBreaker({
  name: "notification-service",
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
});

/**
 * Get health status of all pre-built circuit breakers.
 * Useful for /api/health and monitoring dashboards.
 */
export function getRecoveryStatus(): {
  breakers: CircuitSnapshot[];
  cacheEntries: number;
} {
  return {
    breakers: [
      externalApiBreaker.getState(),
      paymentBreaker.getState(),
      notificationBreaker.getState(),
    ],
    cacheEntries: responseCache.size,
  };
}
