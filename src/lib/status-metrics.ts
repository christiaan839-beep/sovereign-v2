/**
 * SOVEREIGN MATRIX — Status metrics (Wave 15, audit-2026-05 elite).
 *
 * Computes real p50 / p95 / p99 latency, success rate, and request
 * volume from the agent_runs table (where every signed run lands).
 * Used by /api/status/metrics and rendered on the public /status
 * page so visitors see actual production numbers, not hardcoded
 * "99.98% uptime" marketing claims.
 *
 * Pure module — no I/O is initiated by import. The exported functions
 * take a Drizzle db instance (or use the default) and return typed
 * StatusMetrics. Easy to unit-test by passing a fake `rows` array.
 */

import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { gt, sql } from "drizzle-orm";

export type Window = "24h" | "7d" | "30d";

export interface WindowMetrics {
  /** The window this metrics block covers. */
  window: Window;
  /** Total runs in the window. */
  count: number;
  /** Successful runs (trustDecision != "blocked"). */
  successCount: number;
  /** Success rate as a fraction [0, 1]. */
  successRate: number;
  /** Latency percentiles in milliseconds. Null when count = 0. */
  latencyMs: {
    p50: number | null;
    p95: number | null;
    p99: number | null;
    max: number | null;
  };
}

export interface StatusMetrics {
  generatedAt: string;
  windows: WindowMetrics[];
  /** Overall self-reported health flag — derived from the 24h block. */
  overall: "ok" | "degraded" | "fail";
}

/** Window → ms-since-now. */
const WINDOW_MS: Record<Window, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

/**
 * Compute percentile from a sorted ascending array. p in [0, 1].
 * Returns null on empty input. Linear interpolation between
 * adjacent samples (matches Prometheus / Sentry conventions).
 */
export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const rank = p * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  const frac = rank - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

/**
 * Reduce a list of rows to a WindowMetrics block.
 * Pure function — testable with any array of {durationMs, trustDecision}.
 */
export function reduceWindow(
  window: Window,
  rows: Array<{ durationMs: number; trustDecision: string }>,
): WindowMetrics {
  const count = rows.length;
  const successCount = rows.filter((r) => r.trustDecision !== "blocked").length;
  const successRate = count === 0 ? 1 : successCount / count;
  const durations = rows
    .map((r) => r.durationMs)
    .filter((d) => Number.isFinite(d) && d >= 0)
    .sort((a, b) => a - b);
  return {
    window,
    count,
    successCount,
    successRate,
    latencyMs: {
      p50: percentile(durations, 0.5),
      p95: percentile(durations, 0.95),
      p99: percentile(durations, 0.99),
      max: durations.length > 0 ? durations[durations.length - 1] : null,
    },
  };
}

/**
 * Project a 24h success rate onto an overall health verdict.
 * - >= 99.5% → ok
 * - 95–99.5% → degraded
 * - < 95%    → fail
 * No data → ok (defaults to optimistic; the page surfaces "no data" too).
 */
export function deriveOverall(
  m: WindowMetrics | undefined,
): "ok" | "degraded" | "fail" {
  if (!m || m.count === 0) return "ok";
  if (m.successRate >= 0.995) return "ok";
  if (m.successRate >= 0.95) return "degraded";
  return "fail";
}

/**
 * Pull rows from agent_runs in each rolling window and reduce to
 * the StatusMetrics shape. Best-effort: returns the empty payload
 * when the DB query fails (table missing in dev, etc.).
 */
export async function computeStatusMetrics(): Promise<StatusMetrics> {
  const now = Date.now();
  const generatedAt = new Date(now).toISOString();

  // One query per window — small enough that this is fine; once volume
  // warrants, swap for a single materialized aggregate.
  const blocks: WindowMetrics[] = [];
  for (const w of ["24h", "7d", "30d"] as const) {
    const cutoff = new Date(now - WINDOW_MS[w]);
    try {
      const rows = await db
        .select({
          durationMs: agentRuns.durationMs,
          trustDecision: agentRuns.trustDecision,
        })
        .from(agentRuns)
        .where(gt(agentRuns.createdAt, cutoff))
        // Defensive cap — the largest window (30d) on a high-traffic
        // tenant could otherwise pull millions of rows.
        .limit(50_000);
      blocks.push(reduceWindow(w, rows));
    } catch {
      blocks.push(reduceWindow(w, []));
    }
  }

  return {
    generatedAt,
    windows: blocks,
    overall: deriveOverall(blocks.find((b) => b.window === "24h")),
  };
}

// Re-export `sql` helper so dependent modules don't double-import.
export { sql };
