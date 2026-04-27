/**
 * SOVEREIGN MATRIX — Safe async helpers
 *
 * Replaces the silent `.catch(() => {})` pattern that was scattered across
 * 37+ call sites. Every fire-and-forget operation now either:
 *   1. Logs the failure with context (so we can see outages in Sentry/logs)
 *   2. Routes to the dlq table for later retry (mission-critical paths only)
 *
 * Two helpers:
 *   - loggedFireForget(promise, ctx)  → log on failure, never throw
 *   - withDLQ(fn, dlqMeta)            → log + persist to dlq for retry
 */
import { createLogger } from "@/lib/logger";

const log = createLogger("safe-async");

export interface SafeAsyncContext {
  /** Origin of the call — typically "agent:closer" or "route:/api/jobs" */
  source: string;
  /** Free-form additional context (userId, agent, etc.) */
  meta?: Record<string, unknown>;
}

/**
 * Fire-and-forget a promise, logging on failure.
 * Drop-in replacement for `.catch(() => {})`.
 *
 * @example
 *   loggedFireForget(sendTelegram(chatId, msg), { source: "jobs:start" });
 */
export function loggedFireForget(
  promise: Promise<unknown> | undefined | null,
  ctx: SafeAsyncContext,
): void {
  if (!promise || typeof (promise as Promise<unknown>).then !== "function")
    return;
  Promise.resolve(promise).catch((err) => {
    log.warn("fire-and-forget failed", {
      source: ctx.source,
      error: err instanceof Error ? err.message : String(err),
      ...ctx.meta,
    });
  });
}

/**
 * Run a critical fire-and-forget operation with DLQ fallback.
 * If the operation throws, the failure is logged AND persisted to the
 * `deferred_jobs` table so a background job can retry later.
 *
 * Use for: webhook delivery, usage increments, audit log writes — anything
 * where silent loss has billing or compliance impact.
 *
 * @example
 *   await withDLQ(
 *     () => fireUserWebhook("ClientReport", "Generated", payload),
 *     { kind: "webhook", target: "ClientReport", payload, userId },
 *   );
 */
export async function withDLQ<T>(
  fn: () => Promise<T>,
  meta: {
    kind: "webhook" | "usage" | "audit" | "notification" | "memory";
    target: string;
    payload?: Record<string, unknown>;
    userId?: string;
  },
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn("operation failed — routing to DLQ", {
      kind: meta.kind,
      target: meta.target,
      error: message,
    });
    // Best-effort enqueue to DLQ. If even this fails, log loudly and move on
    // — never throw, since callers expect fire-and-forget semantics.
    try {
      const { db } = await import("@/db");
      const { deferredJobs } = await import("@/db/schema");
      await db.insert(deferredJobs).values({
        kind: meta.kind,
        target: meta.target,
        payload: meta.payload ? JSON.stringify(meta.payload) : null,
        userId: meta.userId ?? null,
        lastError: message.slice(0, 1000),
        attempts: 1,
        status: "pending",
        nextAttemptAt: new Date(Date.now() + 60_000),
      });
    } catch (dlqErr) {
      log.error("DLQ enqueue ALSO failed", {
        kind: meta.kind,
        target: meta.target,
        original: message,
        dlqError: dlqErr instanceof Error ? dlqErr.message : String(dlqErr),
      });
    }
    return null;
  }
}
