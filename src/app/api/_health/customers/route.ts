/**
 * GET /api/health/customers
 *
 * Public, anonymized platform-wide stats for /trust/customers.
 * Reads agent_stats_daily over the last 14 days and reduces to:
 *   - total runs (bucketed)
 *   - distinct users (bucketed)
 *   - distinct agents (exact — agents are public)
 *   - success rate (% — already aggregated, can't single out a tenant)
 *   - avg latency
 *
 * The bucketing config + suppression thresholds live in
 * src/lib/customer-stats-anonymizer.ts. Edit there to change the
 * privacy/trust posture.
 *
 * Cached for 6h. The numbers don't move that fast and the public
 * page should not hammer the DB.
 */

import { NextResponse } from "next/server";
import { sql, gt } from "drizzle-orm";
import { publishStats } from "@/lib/customer-stats-anonymizer";
import { createLogger } from "@/lib/logger";

const log = createLogger("health-customers");

export const runtime = "nodejs";
// 6h cache — these numbers move slowly.
export const revalidate = 21_600;

const WINDOW_DAYS = 14;

export async function GET() {
  const t0 = Date.now();

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        published: null,
        note: "Database unavailable — telemetry warming up.",
        generatedAt: new Date().toISOString(),
        generatedInMs: Date.now() - t0,
      },
      { status: 200 },
    );
  }

  try {
    const { db } = await import("@/db");
    const { agentStatsDaily } = await import("@/db/schema");

    // Aggregate over the window. SUM/AVG of pre-aggregated daily rows.
    const result = await db.execute(sql`
      SELECT
        COALESCE(SUM(runs), 0)::int                              AS total_runs,
        COALESCE(SUM(successes), 0)::int                         AS total_successes,
        COALESCE(SUM(unique_users), 0)::int                      AS distinct_users,
        COUNT(DISTINCT agent_slug)::int                          AS distinct_agents,
        COALESCE(AVG(avg_duration_ms), 0)::int                   AS avg_duration_ms
      FROM ${agentStatsDaily}
      WHERE day > CURRENT_DATE - (${WINDOW_DAYS}::int || ' days')::interval
    `);
    void gt; // imported for future filtering

    const row = (result as unknown as {
      rows: Array<{
        total_runs: number;
        total_successes: number;
        distinct_users: number;
        distinct_agents: number;
        avg_duration_ms: number;
      }>;
    }).rows?.[0];

    if (!row) {
      return NextResponse.json(
        {
          published: null,
          note: "No data in window yet.",
          generatedAt: new Date().toISOString(),
          generatedInMs: Date.now() - t0,
        },
        { status: 200 },
      );
    }

    const published = publishStats({
      totalRuns: row.total_runs,
      totalSuccesses: row.total_successes,
      distinctUsers: row.distinct_users,
      distinctAgents: row.distinct_agents,
      avgDurationMs: row.avg_duration_ms || null,
      windowDays: WINDOW_DAYS,
    });

    return NextResponse.json(
      {
        published,
        generatedAt: new Date().toISOString(),
        generatedInMs: Date.now() - t0,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, max-age=21600, s-maxage=21600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (err) {
    log.error("customers stats failed", { error: String(err) });
    return NextResponse.json(
      {
        published: null,
        note: "Aggregation failed.",
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
