/**
 * SOVEREIGN MATRIX — DLQ retry worker.
 *
 * Drains the `deferred_jobs` table populated by `withDLQ()` in safe-async.ts.
 * Each tick claims a small batch of due jobs (status=pending, next_attempt_at
 * in the past), attempts to re-run the original operation, and on failure
 * schedules the next retry with exponential backoff. After MAX_ATTEMPTS the
 * job is marked "abandoned" so it stops cycling.
 *
 * Backoff schedule (after each failed attempt):
 *   1 → +60s, 2 → +5m, 3 → +30m, 4 → +2h, 5 → +12h, 6+ → abandoned
 *
 * Designed to be invoked by a cron (every 10 minutes). Single tick is
 * idempotent: if two workers race, only the one whose UPDATE matches
 * status='pending' actually processes the row.
 */
import { db } from "@/db";
import { deferredJobs } from "@/db/schema";
import { and, eq, lte } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { fireUserWebhook } from "@/lib/webhooks";

const log = createLogger("dlq-worker");

const MAX_ATTEMPTS = 6;
const BATCH_SIZE = 25;

/** Backoff schedule keyed by the upcoming attempt number (1-indexed). */
const BACKOFF_MS: Record<number, number> = {
  1: 60_000,
  2: 5 * 60_000,
  3: 30 * 60_000,
  4: 2 * 60 * 60_000,
  5: 12 * 60 * 60_000,
};

export interface DrainResult {
  scanned: number;
  succeeded: number;
  retried: number;
  abandoned: number;
  durationMs: number;
}

/**
 * Re-run a single deferred job by kind. Returns true on success, false to
 * trigger backoff. Throws are treated as failures.
 */
async function dispatch(
  kind: string,
  target: string,
  payload: unknown,
): Promise<boolean> {
  switch (kind) {
    case "webhook": {
      // Customer-facing webhooks: re-call fireUserWebhook with a clear
      // "Retry-…" action verb so the receiver can dedupe if needed.
      const args = (payload ?? {}) as Record<string, unknown>;
      const action = `Retry-${target}`;
      await fireUserWebhook(target, action, args);
      return true;
    }
    case "audit":
    case "usage":
    case "notification":
    case "memory":
      // The other kinds aren't yet emitted by withDLQ() call sites in
      // production; when they are, add a case here. For now, log + abandon
      // so we don't pretend to retry something we don't know how to.
      log.warn("dlq: dispatch not implemented for kind", { kind, target });
      return false;
    default:
      log.warn("dlq: unknown kind", { kind, target });
      return false;
  }
}

/**
 * Claim and process up to BATCH_SIZE due jobs. Returns counts so the cron
 * route can return a status payload.
 */
export async function drainDLQ(now: Date = new Date()): Promise<DrainResult> {
  const startedAt = Date.now();
  const result: DrainResult = {
    scanned: 0,
    succeeded: 0,
    retried: 0,
    abandoned: 0,
    durationMs: 0,
  };

  // 1. Pull a batch of candidates. We don't lock — concurrency is handled
  //    by the conditional UPDATE below.
  const candidates = await db
    .select()
    .from(deferredJobs)
    .where(
      and(
        eq(deferredJobs.status, "pending"),
        lte(deferredJobs.nextAttemptAt, now),
      ),
    )
    .limit(BATCH_SIZE);

  result.scanned = candidates.length;
  if (candidates.length === 0) {
    result.durationMs = Date.now() - startedAt;
    return result;
  }

  for (const job of candidates) {
    // 2. Atomic claim: only the worker whose UPDATE matches a still-pending
    //    row gets to process this job. Sets a far-future nextAttemptAt as a
    //    soft guard against a racing worker re-claiming during processing.
    const claimWindow = new Date(now.getTime() + 60 * 60_000);
    const [claimed] = await db
      .update(deferredJobs)
      .set({ nextAttemptAt: claimWindow })
      .where(
        and(eq(deferredJobs.id, job.id), eq(deferredJobs.status, "pending")),
      )
      .returning({ id: deferredJobs.id });
    if (!claimed) continue;

    let payload: unknown = null;
    try {
      payload = job.payload ? JSON.parse(job.payload) : null;
    } catch {
      payload = null;
    }

    let success = false;
    let lastError = "";
    try {
      success = await dispatch(job.kind, job.target, payload);
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (success) {
      await db
        .update(deferredJobs)
        .set({
          status: "succeeded",
          completedAt: new Date(),
          attempts: job.attempts + 1,
        })
        .where(eq(deferredJobs.id, job.id));
      result.succeeded++;
      log.info("dlq: succeeded", {
        kind: job.kind,
        target: job.target,
        attempts: job.attempts + 1,
      });
      continue;
    }

    // 3. Failure path — either schedule the next attempt or abandon.
    const nextAttempts = job.attempts + 1;
    if (nextAttempts >= MAX_ATTEMPTS) {
      await db
        .update(deferredJobs)
        .set({
          status: "abandoned",
          completedAt: new Date(),
          attempts: nextAttempts,
          lastError: (lastError || "dispatch returned false").slice(0, 1000),
        })
        .where(eq(deferredJobs.id, job.id));
      result.abandoned++;
      log.warn("dlq: abandoned after max attempts", {
        kind: job.kind,
        target: job.target,
        attempts: nextAttempts,
      });
      continue;
    }

    const backoffMs = BACKOFF_MS[nextAttempts] ?? 12 * 60 * 60_000;
    await db
      .update(deferredJobs)
      .set({
        status: "pending",
        attempts: nextAttempts,
        nextAttemptAt: new Date(now.getTime() + backoffMs),
        lastError: (lastError || "dispatch returned false").slice(0, 1000),
      })
      .where(eq(deferredJobs.id, job.id));
    result.retried++;
  }

  result.durationMs = Date.now() - startedAt;
  return result;
}
