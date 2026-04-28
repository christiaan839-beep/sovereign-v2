/**
 * ADVISORY LOCK — cluster-wide mutual exclusion via Postgres.
 *
 * Round 26. The instrumentation.ts background loop on Railway calls
 * `setInterval` to ping cron endpoints every 30s / 5m. If two Railway
 * instances are running (warm-after-cold-transition, blue-green
 * deploy, horizontal scale), BOTH loops fire — and the resulting
 * cron triggers race. The job-runner endpoint defends with atomic
 * `UPDATE ... WHERE status='pending'`, but the playbook-scheduler
 * has no such guard. Result: scheduled playbooks could fire twice.
 *
 * pg_try_advisory_lock is the standard Postgres primitive for
 * cluster-wide "exactly one of N processes does this":
 *
 *   - Each "lock key" is a 64-bit integer (we hash a string to int64)
 *   - try_advisory_lock returns true if WE got the lock, false if
 *     someone else holds it
 *   - Lock is automatically released when the connection closes
 *     (so a dying worker never holds the lock forever)
 *   - Unlike row locks, advisory locks don't block any tables
 *
 * USAGE:
 *
 *   await withAdvisoryLock("playbook-scheduler", async () => {
 *     await ping("/api/cron/playbook-scheduler");
 *   });
 *
 * The callback runs ONLY on the instance that grabs the lock. Other
 * instances skip silently (no error, no log noise — the absence of
 * a tick is the correct behavior).
 *
 * The lock key derives from the string via a stable hash, so the
 * same key produces the same int64 on every instance. There's no
 * key registry — pick a unique string per workload.
 */

import { sql } from "drizzle-orm";

/**
 * Hash a string to a deterministic 32-bit signed int. The hash is
 * stable across processes (same string → same int) and small enough
 * to be one half of Postgres's two-int advisory lock pair.
 *
 * Postgres advisory locks accept either one int64 or two int32s.
 * Using the two-int32 form because it's easier to debug (you can
 * read the lock pair as "key=N, sub=0" in pg_locks).
 */
function hashKey(key: string): number {
  // FNV-1a 32-bit. Stable, fast, no deps. Result is in [0, 2^32) but
  // Postgres advisory-lock keys are SIGNED int32, so we shift into
  // signed range when needed.
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Convert to signed int32 (Postgres expects signed).
  return hash | 0;
}

/**
 * Run `fn` only if THIS instance can acquire the cluster lock for
 * `key`. Returns whatever fn returned, or null if the lock was held
 * by another instance.
 *
 * Lock is released automatically:
 *   - When fn finishes (we explicitly call pg_advisory_unlock)
 *   - When the DB connection closes (Postgres backstop — even if our
 *     process dies mid-fn the lock isn't held forever)
 *
 * If `fn` throws, the lock IS released. The exception propagates.
 *
 * No-DB fallback: returns null without running fn. The caller's
 * cron tick is effectively skipped — but that matches the
 * "DB-unreachable, do nothing" expected behavior.
 */
export async function withAdvisoryLock<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T | null> {
  if (!process.env.DATABASE_URL) return null;

  const lockKey = hashKey(key);

  let db: typeof import("@/db").db;
  try {
    db = (await import("@/db")).db;
  } catch {
    return null;
  }

  // Try to grab the lock. pg_try_advisory_lock is non-blocking:
  // returns true immediately if we got it, false if someone else
  // has it. This is the right semantics for cron-style work — a
  // missed tick on one instance is fine; the next tick (or another
  // instance) picks it up.
  let acquired = false;
  try {
    const rows = await db.execute(sql`SELECT pg_try_advisory_lock(${lockKey}) AS acquired`);
    // drizzle returns rows; the result shape varies by driver but
    // each driver gives back an object with the column. Be defensive.
    type LockRow = { acquired?: boolean };
    const first = (rows as unknown as LockRow[])[0]
      ?? ((rows as unknown as { rows?: LockRow[] }).rows?.[0]);
    acquired = first?.acquired === true;
  } catch {
    // DB error trying to acquire the lock = treat as "not acquired"
    // and skip. The next cron tick will retry.
    return null;
  }

  if (!acquired) {
    // Another instance (or another process on this instance with a
    // different connection) holds the lock. Skip silently — that's
    // the correct behavior, not an error.
    return null;
  }

  try {
    return await fn();
  } finally {
    // Always release. If pg_advisory_unlock itself errors (very
    // unusual), the connection-close backstop will eventually free
    // it; we shouldn't crash the caller over a release failure.
    try {
      await db.execute(sql`SELECT pg_advisory_unlock(${lockKey})`);
    } catch {
      /* swallow — connection-close backstop will release */
    }
  }
}
