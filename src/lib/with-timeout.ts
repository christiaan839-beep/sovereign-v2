/**
 * withTimeout — bound any Promise to a max duration.
 *
 * The Vercel serverless invocation cap is 60 seconds. A slow Drizzle
 * query with no client-side timeout will hold a Lambda for the full
 * 60s, then return 504, then be retried by the user — multiplying
 * the load. Wrapping every external call in `withTimeout` caps the
 * blast radius at our chosen limit, frees the Lambda earlier, and
 * surfaces a typed error that callers can degrade against.
 *
 * Usage — DB query:
 *   const rows = await withTimeout(db.select().from(usage), 5000, "usage-query");
 *
 * Usage — fetch:
 *   const res = await withTimeout(fetch(url), 8000, "anthropic-call");
 *
 * The `label` is included in the thrown error and the warn-level log
 * line so production logs are searchable without inspecting stack
 * traces.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("with-timeout");

export class TimeoutError extends Error {
  constructor(
    public readonly label: string,
    public readonly timeoutMs: number,
  ) {
    super(`Timed out after ${timeoutMs}ms — ${label}`);
    this.name = "TimeoutError";
  }
}

/**
 * Race the input promise against a timer. If the timer wins, throws
 * a `TimeoutError` (subclass of Error) — callers can `instanceof`
 * check to degrade gracefully.
 *
 * The underlying promise may still resolve after the timeout fired;
 * we don't cancel it (Promises aren't cancellable in JS). For fetch
 * calls that need real cancellation, prefer `AbortSignal.timeout()`.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = "operation",
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      log.warn("Timed out", { label, timeoutMs });
      reject(new TimeoutError(label, timeoutMs));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

/**
 * Convenience helper for fetch() — adds an AbortSignal.timeout() so
 * the underlying network connection actually closes (not just the
 * waiting Promise resolves). Always prefer this over wrapping fetch
 * in `withTimeout` directly.
 */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number; label?: string } = {},
): Promise<Response> {
  const { timeoutMs = 8000, label = "fetch", ...rest } = init;
  const signal = rest.signal ?? AbortSignal.timeout(timeoutMs);
  return withTimeout(
    fetch(input, { ...rest, signal }),
    timeoutMs + 1000, // small buffer over AbortSignal so the abort wins first
    label,
  );
}
