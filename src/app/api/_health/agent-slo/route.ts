/**
 * GET /api/health/agent-slo
 *
 * Public, anonymized PER-AGENT SLO data over the last 7 days.
 * Aggregates execution_audit_log into:
 *   - count of runs
 *   - p50, p95 execution time (ms)
 *   - success rate (% — defined as approval_status != 'rejected')
 *
 * Sister to /api/_health/slo (platform-wide). This one breaks down
 * by agent_name so customers can see "which of your 223 agents
 * actually has a sub-second p95?" — a real, queryable answer.
 *
 * Privacy:
 *   - tenant_id is NEVER returned
 *   - agent_name IS public (already in the API catalog)
 *   - agents with < MIN_RUNS_FOR_INCLUSION runs are filtered out
 *     (insufficient data for stable percentiles)
 *
 * Cached for 10 minutes. Rolling 7-day p95 doesn't move minute-to-minute.
 */

import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("health-agent-slo");

export const runtime = "nodejs";
export const revalidate = 600;

const WINDOW_DAYS = 7;
const MIN_RUNS_FOR_INCLUSION = 5;

interface AgentSloRow {
  agentName: string;
  runs: number;
  p50Ms: number;
  p95Ms: number;
  successRatePct: number;
  /** "fast" / "med" / "slow" — at-a-glance grouping for the dashboard. */
  latencyTier: "fast" | "med" | "slow";
}

function tierFor(p95Ms: number): AgentSloRow["latencyTier"] {
  if (p95Ms < 2000) return "fast";
  if (p95Ms < 8000) return "med";
  return "slow";
}

export async function GET() {
  const t0 = Date.now();

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        agents: [],
        windowDays: WINDOW_DAYS,
        note: "Database unavailable — SLO data warming up.",
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }

  try {
    const { db } = await import("@/db");
    const { executionAuditLog } = await import("@/db/schema");

    // Postgres percentile_cont gives p50 and p95 directly.
    // The composite index on (tenant_id, created_at) makes the
    // window filter index-friendly even though we don't filter
    // by tenant — we're scanning all tenants for the public agg.
    const result = await db.execute(sql`
      SELECT
        agent_name,
        COUNT(*)::int                                                          AS runs,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time_ms)::int    AS p50_ms,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms)::int   AS p95_ms,
        100.0 * SUM(CASE WHEN approval_status != 'rejected' THEN 1 ELSE 0 END)
          / NULLIF(COUNT(*), 0)                                                AS success_rate
      FROM ${executionAuditLog}
      WHERE created_at > NOW() - (${WINDOW_DAYS}::int || ' days')::interval
      GROUP BY agent_name
      HAVING COUNT(*) >= ${MIN_RUNS_FOR_INCLUSION}
      ORDER BY runs DESC
      LIMIT 200
    `);

    const rows = (result as unknown as {
      rows: Array<{
        agent_name: string;
        runs: number;
        p50_ms: number;
        p95_ms: number;
        success_rate: string | number;
      }>;
    }).rows ?? [];

    const agents: AgentSloRow[] = rows.map((r) => {
      const sr = typeof r.success_rate === "number"
        ? r.success_rate
        : parseFloat(r.success_rate);
      return {
        agentName: r.agent_name,
        runs: r.runs,
        p50Ms: r.p50_ms ?? 0,
        p95Ms: r.p95_ms ?? 0,
        successRatePct: Number((Number.isFinite(sr) ? sr : 0).toFixed(1)),
        latencyTier: tierFor(r.p95_ms ?? 0),
      };
    });

    return NextResponse.json(
      {
        agents,
        windowDays: WINDOW_DAYS,
        minRunsThreshold: MIN_RUNS_FOR_INCLUSION,
        generatedAt: new Date().toISOString(),
        generatedInMs: Date.now() - t0,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, max-age=600, s-maxage=600, stale-while-revalidate=3600",
        },
      },
    );
  } catch (err) {
    log.error("Agent SLO aggregation failed", { error: String(err) });
    return NextResponse.json(
      {
        agents: [],
        windowDays: WINDOW_DAYS,
        note: "Aggregation failed.",
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }
}
