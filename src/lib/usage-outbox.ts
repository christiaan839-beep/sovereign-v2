/**
 * USAGE OUTBOX — drain pending rows back into the canonical `usage`
 * table after transient failures.
 *
 * Round 26. The outbox pattern decouples "the user ran an agent"
 * (a high-traffic, can't-fail-out-of-band event) from "the usage
 * counter is durable" (a slow background job that can retry).
 *
 * Flow:
 *   1. incrementUsage tries the canonical INSERT.
 *   2. On failure, it writes to `usage_outbox` with status='pending'.
 *   3. This drainer (called by /api/cron/drain-usage-outbox every
 *      1 minute) picks up pending rows, retries the canonical insert,
 *      and either marks 'processed' or bumps `attempts`.
 *   4. After N attempts (default 5) a row is marked 'failed' so it
 *      stops consuming drainer cycles. An admin / Sentry alert can
 *      surface it for manual reconciliation.
 *
 * Idempotency: each outbox row corresponds to exactly one canonical
 * row attempt. The drainer marks 'processed' BEFORE a successful
 * canonical insert is "fully seen" — but since both writes are in
 * the same transaction, they commit together. On replay (drainer
 * crashed mid-flight), the row is still 'pending' and gets retried.
 *
 * Bounded: drainer processes at most LIMIT rows per tick so a 50K-row
 * backlog doesn't dominate the cron window. The next tick picks up
 * where this one left off.
 */

import { and, asc, eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("usage-outbox");

const MAX_ATTEMPTS = 5;
const DEFAULT_LIMIT = 200;

async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { db } = await import("@/db");
    return db;
  } catch {
    return null;
  }
}

export interface DrainResult {
  drained: number;
  permanentlyFailed: number;
  retried: number;
}

/**
 * Drain pending outbox rows. Returns counts so the cron handler
 * can log telemetry (and operators can graph "outbox depth over
 * time" — a leading indicator of DB health).
 *
 * NEVER throws. The cron handler returns 200 on a graceful failure
 * so Vercel doesn't page on transient infra issues.
 */
export async function drainUsageOutbox(opts: { limit?: number } = {}): Promise<DrainResult> {
  const limit = Math.min(Math.max(1, opts.limit ?? DEFAULT_LIMIT), 1000);
  const result: DrainResult = { drained: 0, permanentlyFailed: 0, retried: 0 };

  const db = await getDb();
  if (!db) return result;

  try {
    const { usage, usageOutbox } = await import("@/db/schema");

    // Read pending rows oldest-first. Bounded by `limit` so a backlog
    // doesn't dominate the cron tick.
    const candidates = await db
      .select()
      .from(usageOutbox)
      .where(eq(usageOutbox.status, "pending"))
      .orderBy(asc(usageOutbox.createdAt))
      .limit(limit);

    if (candidates.length === 0) return result;

    // Process each row independently. We DON'T parallel-issue the
    // inserts — they're serialised so a hot DB connection isn't
    // overwhelmed by a backlog drain. Cost: ~LIMIT * single-insert-ms,
    // which fits in the cron window for limit=200.
    for (const row of candidates) {
      const nextAttempts = row.attempts + 1;
      try {
        // Canonical insert + outbox status flip in one transaction.
        // If the canonical insert succeeds but the status update
        // fails (rare), the next drainer tick will see this row as
        // 'pending' again and re-insert — which would double-count.
        // The transaction prevents this: both succeed or both don't.
        await db.transaction(async (tx) => {
          await tx.insert(usage).values({
            userId: row.userId,
            agentId: row.agentId,
            model: "platform",
            tokensUsed: 1,
          });
          await tx
            .update(usageOutbox)
            .set({
              status: "processed",
              attempts: nextAttempts,
              processedAt: new Date(),
            })
            .where(eq(usageOutbox.id, row.id));
        });
        result.drained += 1;
      } catch (err) {
        const msg = String(err).slice(0, 500);
        if (nextAttempts >= MAX_ATTEMPTS) {
          // Give up — mark 'failed' so the row doesn't consume more
          // drainer cycles. Operator sees these in the admin dash.
          await db
            .update(usageOutbox)
            .set({
              status: "failed",
              attempts: nextAttempts,
              lastError: msg,
            })
            .where(eq(usageOutbox.id, row.id));
          result.permanentlyFailed += 1;
          log.error("Usage outbox row permanently failed after retries", {
            id: row.id,
            userId: row.userId,
            attempts: nextAttempts,
            error: msg,
          });
        } else {
          // Bump attempts; row stays 'pending' for the next tick.
          await db
            .update(usageOutbox)
            .set({ attempts: nextAttempts, lastError: msg })
            .where(eq(usageOutbox.id, row.id));
          result.retried += 1;
        }
      }
    }
    return result;
  } catch (err) {
    log.error("Outbox drain failed at top level", { error: String(err) });
    return result;
  }
}

/**
 * Admin / health surface — how many rows are pending right now.
 * Used by the platform-wide observability dashboard. A growing
 * pending count = transient DB health degradation; a steady-state
 * non-zero count = persistent issue.
 */
export async function getOutboxDepth(): Promise<{
  pending: number;
  failed: number;
}> {
  const db = await getDb();
  if (!db) return { pending: 0, failed: 0 };
  try {
    const { usageOutbox } = await import("@/db/schema");
    const [pendingRow, failedRow] = await Promise.all([
      db
        .select({ count: usageOutbox.id })
        .from(usageOutbox)
        .where(eq(usageOutbox.status, "pending")),
      db
        .select({ count: usageOutbox.id })
        .from(usageOutbox)
        .where(eq(usageOutbox.status, "failed")),
    ]);
    return {
      pending: pendingRow.length,
      failed: failedRow.length,
    };
  } catch {
    return { pending: 0, failed: 0 };
  }
}
