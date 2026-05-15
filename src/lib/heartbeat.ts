/**
 * SOVEREIGN MATRIX — Cron heartbeat monitor (Cook 100).
 *
 * Every scheduled job emits a heartbeat record after a successful
 * run. The monitor flags any job that has missed N consecutive
 * windows so on-call gets paged before a silent cron drift becomes
 * a missed audit-bundle delivery.
 *
 * Pure module — caller wires Sentry / PagerDuty / Slack on the
 * paging side.
 */

// ── Public types ──────────────────────────────────────────────────────────

export interface HeartbeatRecord {
  /** Stable job name (e.g. "/api/_cron/audit-bundles"). */
  job: string;
  /** Unix ms of the last successful run. */
  lastSuccessMs: number;
  /** Cadence in ms — caller computes from the cron expr. */
  cadenceMs: number;
  /** Optional last-error message for paging context. */
  lastError?: string;
}

export interface HeartbeatVerdict {
  job: string;
  status: "ok" | "stale" | "critical" | "unknown";
  /** How many cadence windows the job has missed. */
  missedWindows: number;
  /** Human-readable message for the pager. */
  message: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const STALE_THRESHOLD = 1; // missed 1 window → stale
const CRITICAL_THRESHOLD = 2; // missed 2+ windows → page

// ── Heartbeat store (in-memory, swap to persistent on migration) ─────────

const STORE = new Map<string, HeartbeatRecord>();

export function recordHeartbeat(rec: HeartbeatRecord): void {
  if (!rec.job) throw new Error("recordHeartbeat: job is required");
  if (!Number.isFinite(rec.cadenceMs) || rec.cadenceMs <= 0) {
    throw new Error("recordHeartbeat: cadenceMs must be > 0");
  }
  STORE.set(rec.job, { ...rec });
}

export function getHeartbeat(job: string): HeartbeatRecord | undefined {
  return STORE.get(job);
}

export function listHeartbeats(): HeartbeatRecord[] {
  return [...STORE.values()];
}

export function _resetForTests(): void {
  STORE.clear();
}

// ── Verdict ───────────────────────────────────────────────────────────────

/** Evaluate a single job's heartbeat. Caller passes `now` for determinism. */
export function evaluateJob(job: string, now: number): HeartbeatVerdict {
  const rec = STORE.get(job);
  if (!rec) {
    return {
      job,
      status: "unknown",
      missedWindows: -1,
      message: `No heartbeat ever recorded for ${job}`,
    };
  }
  const elapsed = Math.max(0, now - rec.lastSuccessMs);
  const missed = Math.max(0, Math.floor(elapsed / rec.cadenceMs) - 1);
  if (missed >= CRITICAL_THRESHOLD) {
    return {
      job,
      status: "critical",
      missedWindows: missed,
      message: `CRITICAL: ${job} missed ${missed} consecutive runs (last success ${new Date(rec.lastSuccessMs).toISOString()})`,
    };
  }
  if (missed >= STALE_THRESHOLD) {
    return {
      job,
      status: "stale",
      missedWindows: missed,
      message: `STALE: ${job} missed ${missed} window`,
    };
  }
  return {
    job,
    status: "ok",
    missedWindows: 0,
    message: `${job} healthy`,
  };
}

/** Evaluate every recorded job. */
export function evaluateAll(now: number): HeartbeatVerdict[] {
  return [...STORE.keys()].map((job) => evaluateJob(job, now));
}

export const HEARTBEAT_THRESHOLDS = {
  STALE_THRESHOLD,
  CRITICAL_THRESHOLD,
};
