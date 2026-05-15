/**
 * SOVEREIGN MATRIX — DB connection pool sizing (Cook 114).
 *
 * Caps the number of concurrent Neon Postgres connections per Vercel
 * function instance to prevent traffic spikes from exhausting Neon's
 * compute branch. Neon serverless gives each function instance its
 * own pool; without a cap a single spike can serialize every read.
 *
 * Pure module: returns a "guard" wrapper around a Drizzle query
 * function. Production wires this around `db.select(...)` in the
 * hot-path routes.
 *
 * Construction:
 *   const guard = createGuard({ maxConcurrent: 8, queueTimeoutMs: 5_000 });
 *   const rows = await guard(() => db.select().from(users));
 */

// ── Public types ──────────────────────────────────────────────────────────

export interface GuardConfig {
  /** Max simultaneous in-flight queries. */
  maxConcurrent: number;
  /** ms a query can wait in queue before failing with a structured error. */
  queueTimeoutMs: number;
}

export interface GuardStats {
  inflight: number;
  queued: number;
  totalAccepted: number;
  totalCompleted: number;
  totalTimedOut: number;
}

export type GuardedFn = <T>(fn: () => Promise<T>) => Promise<T>;

// ── Implementation ────────────────────────────────────────────────────────

interface PendingTask {
  start: () => void;
  reject: (err: Error) => void;
  enqueuedAt: number;
}

/**
 * Create a query guard. The returned function caps in-flight calls
 * at `maxConcurrent`. Excess calls wait in a FIFO queue; the queue
 * has a per-task timeout so a stuck connection doesn't hold up the
 * world.
 */
export function createGuard(config: GuardConfig): {
  guard: GuardedFn;
  stats: () => GuardStats;
  _reset: () => void;
} {
  if (!Number.isInteger(config.maxConcurrent) || config.maxConcurrent <= 0) {
    throw new Error("createGuard: maxConcurrent must be a positive integer");
  }
  if (!Number.isFinite(config.queueTimeoutMs) || config.queueTimeoutMs <= 0) {
    throw new Error("createGuard: queueTimeoutMs must be > 0");
  }

  let inflight = 0;
  let queued = 0;
  let totalAccepted = 0;
  let totalCompleted = 0;
  let totalTimedOut = 0;
  const queue: PendingTask[] = [];

  function drain() {
    while (inflight < config.maxConcurrent && queue.length > 0) {
      const task = queue.shift();
      if (!task) break;
      queued--;
      task.start();
    }
  }

  const guard: GuardedFn = async <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const startTask = () => {
        inflight++;
        totalAccepted++;
        fn()
          .then((value) => {
            inflight--;
            totalCompleted++;
            drain();
            resolve(value);
          })
          .catch((err) => {
            inflight--;
            totalCompleted++;
            drain();
            reject(err);
          });
      };

      if (inflight < config.maxConcurrent) {
        startTask();
        return;
      }

      queued++;
      const task: PendingTask = {
        start: startTask,
        reject: (err) => reject(err),
        enqueuedAt: Date.now(),
      };
      queue.push(task);

      // Per-task queue timeout.
      const timer = setTimeout(() => {
        const idx = queue.indexOf(task);
        if (idx >= 0) {
          queue.splice(idx, 1);
          queued--;
          totalTimedOut++;
          task.reject(
            new Error(
              `DB guard queue timeout (${config.queueTimeoutMs}ms) — try again`,
            ),
          );
        }
      }, config.queueTimeoutMs);

      // Clear timer once task starts (start gets wrapped).
      const originalStart = task.start;
      task.start = () => {
        clearTimeout(timer);
        originalStart();
      };
    });
  };

  return {
    guard,
    stats: () => ({
      inflight,
      queued,
      totalAccepted,
      totalCompleted,
      totalTimedOut,
    }),
    _reset: () => {
      // Reject every queued task + reset counters. Used by tests only.
      while (queue.length > 0) {
        const t = queue.shift();
        t?.reject(new Error("guard reset"));
      }
      inflight = 0;
      queued = 0;
      totalAccepted = 0;
      totalCompleted = 0;
      totalTimedOut = 0;
    },
  };
}
