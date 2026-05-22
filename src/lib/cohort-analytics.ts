/**
 * SOVEREIGN MATRIX — Per-tenant cohort analytics (Wave 127).
 *
 * Computes per-user / per-tenant retention + receipt-volume cohorts
 * from `agent_runs`. Surface for the admin dashboard + investor
 * diligence: "how many tenants accumulated >100 receipts, >1000, etc."
 *
 * Cohort math (pure):
 *   - userId → first run timestamp (cohort week / month)
 *   - userId → total receipt count
 *   - userId → last activity timestamp
 *   - per-cohort: retained at week N = users still firing at week N
 *
 * Pure-function design: takes a `rows: RunRow[]` parameter so the
 * aggregator is fully testable without touching the DB. The lib also
 * exports `computeCohorts` which queries the DB + calls the
 * aggregator. Tests target the aggregator directly.
 */

import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { gt } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("cohort-analytics");

export interface RunRow {
  userId: string | null;
  createdAt: Date;
}

export interface UserCohortRow {
  userId: string;
  firstRunAt: string;
  lastRunAt: string;
  totalRuns: number;
  ageDays: number;
  retentionScore: number; // 0-1 — runs / age-in-days, capped at 1
}

export interface CohortBucket {
  /** ISO week label, e.g. "2026-W18". */
  week: string;
  /** Users whose first run landed in this week. */
  newUsers: number;
  /** Total runs from THIS cohort over the full window. */
  totalRuns: number;
  /** Cohort users still active in the last 7 days. */
  activeInLastWeek: number;
  /** Retention rate = activeInLastWeek / newUsers. */
  retention: number;
}

export interface CohortReport {
  generatedAt: string;
  windowDays: number;
  /** Distinct users that fired at least one run in the window. */
  totalUsers: number;
  /** Total runs in the window. */
  totalRuns: number;
  /** Median runs per user (50th percentile). */
  medianRunsPerUser: number;
  /** 90th-percentile runs per user — power users. */
  p90RunsPerUser: number;
  /** Users with >= 100 runs (long-tail accumulation signal). */
  superUsers: number;
  /** Per-cohort week breakdown (sorted oldest → newest). */
  weeklyCohorts: CohortBucket[];
  /** Top 25 users by total runs in the window. */
  topUsers: UserCohortRow[];
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** ISO-week label (e.g. "2026-W18"). Always Mon-start. */
export function isoWeek(date: Date): string {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length),
  );
  return sorted[idx];
}

/**
 * Pure aggregator — takes the raw run rows + the window length and
 * returns a fully-computed CohortReport. No I/O. Fully testable.
 */
export function aggregateCohorts(
  rows: RunRow[],
  windowDays: number = 90,
): CohortReport {
  const now = Date.now();
  const windowStart = now - windowDays * 24 * 60 * 60 * 1000;

  // Per-user accumulator
  const perUser = new Map<
    string,
    { firstRunAt: number; lastRunAt: number; runs: number }
  >();

  for (const r of rows) {
    if (!r.userId || r.userId === "anon") continue;
    const t = r.createdAt instanceof Date ? r.createdAt.getTime() : NaN;
    if (!Number.isFinite(t) || t < windowStart) continue;

    let bucket = perUser.get(r.userId);
    if (!bucket) {
      bucket = { firstRunAt: t, lastRunAt: t, runs: 0 };
      perUser.set(r.userId, bucket);
    }
    bucket.runs++;
    if (t < bucket.firstRunAt) bucket.firstRunAt = t;
    if (t > bucket.lastRunAt) bucket.lastRunAt = t;
  }

  const totalUsers = perUser.size;
  const totalRuns = [...perUser.values()].reduce((sum, u) => sum + u.runs, 0);

  // Sorted runs-per-user array for percentile math
  const runCounts = [...perUser.values()]
    .map((u) => u.runs)
    .sort((a, b) => a - b);
  const medianRunsPerUser = percentile(runCounts, 50);
  const p90RunsPerUser = percentile(runCounts, 90);
  const superUsers = runCounts.filter((n) => n >= 100).length;

  // Weekly cohort buckets — keyed by week of FIRST run
  const cohortAccum = new Map<
    string,
    { newUsers: number; totalRuns: number; activeUserIds: Set<string> }
  >();

  const lastWeekCutoff = now - WEEK_MS;

  for (const [userId, u] of perUser.entries()) {
    const week = isoWeek(new Date(u.firstRunAt));
    let bucket = cohortAccum.get(week);
    if (!bucket) {
      bucket = {
        newUsers: 0,
        totalRuns: 0,
        activeUserIds: new Set<string>(),
      };
      cohortAccum.set(week, bucket);
    }
    bucket.newUsers++;
    bucket.totalRuns += u.runs;
    if (u.lastRunAt >= lastWeekCutoff) {
      bucket.activeUserIds.add(userId);
    }
  }

  const weeklyCohorts: CohortBucket[] = [...cohortAccum.entries()]
    .map(([week, b]) => ({
      week,
      newUsers: b.newUsers,
      totalRuns: b.totalRuns,
      activeInLastWeek: b.activeUserIds.size,
      retention: b.newUsers === 0 ? 0 : b.activeUserIds.size / b.newUsers,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // Top users by runs (cap at 25 for table render)
  const topUsers: UserCohortRow[] = [...perUser.entries()]
    .map(([userId, u]) => {
      const ageDays = Math.max(
        0,
        (u.lastRunAt - u.firstRunAt) / (24 * 60 * 60 * 1000),
      );
      const denom = Math.max(1, ageDays);
      return {
        userId,
        firstRunAt: new Date(u.firstRunAt).toISOString(),
        lastRunAt: new Date(u.lastRunAt).toISOString(),
        totalRuns: u.runs,
        ageDays: Number(ageDays.toFixed(2)),
        retentionScore: Number(Math.min(1, u.runs / denom).toFixed(4)),
      };
    })
    .sort((a, b) => b.totalRuns - a.totalRuns)
    .slice(0, 25);

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    totalUsers,
    totalRuns,
    medianRunsPerUser,
    p90RunsPerUser,
    superUsers,
    weeklyCohorts,
    topUsers,
  };
}

/**
 * Live query — pulls agent_runs rows in the window and aggregates.
 * Returns a degraded empty report when agent_runs is missing.
 */
export async function computeCohorts(
  windowDays: number = 90,
): Promise<CohortReport> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  try {
    const rows = await db
      .select({
        userId: agentRuns.userId,
        createdAt: agentRuns.createdAt,
      })
      .from(agentRuns)
      .where(gt(agentRuns.createdAt, since));
    return aggregateCohorts(rows, windowDays);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") return aggregateCohorts([], windowDays);
    log.warn("computeCohorts failed", { error: String(err) });
    return aggregateCohorts([], windowDays);
  }
}
