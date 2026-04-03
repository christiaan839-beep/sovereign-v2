import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { sql, desc, gte, and, count } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("agent-analytics");

export const runtime = "edge";

/**
 * GET /api/_misc/agent-analytics
 *
 * Returns aggregated agent execution analytics from audit_logs.
 * Filters on action = 'agent.execute' (or any action starting with 'agent.').
 */
export async function GET(_req: NextRequest) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 1. Top 10 agents by execution count (this month)
    const topAgentsRaw = await db
      .select({
        resource: auditLogs.resource,
        executions: count(),
      })
      .from(auditLogs)
      .where(
        and(
          sql`${auditLogs.action} LIKE 'agent.%'`,
          gte(auditLogs.createdAt, startOfMonth)
        )
      )
      .groupBy(auditLogs.resource)
      .orderBy(desc(count()))
      .limit(10);

    const topAgents = topAgentsRaw.map((r) => ({
      agent: r.resource || "unknown",
      executions: Number(r.executions),
    }));

    // 2. Average execution duration per agent (parsed from details JSON field "durationMs")
    //    details is a JSON string: {"durationMs": 1234, "status": "success", ...}
    const avgDurationRaw = await db
      .select({
        resource: auditLogs.resource,
        avgDuration: sql<number>`AVG(CAST(NULLIF(${auditLogs.details}::json->>'durationMs', '') AS DOUBLE PRECISION))`,
        totalExecs: count(),
      })
      .from(auditLogs)
      .where(
        and(
          sql`${auditLogs.action} LIKE 'agent.%'`,
          gte(auditLogs.createdAt, startOfMonth)
        )
      )
      .groupBy(auditLogs.resource)
      .orderBy(sql`AVG(CAST(NULLIF(${auditLogs.details}::json->>'durationMs', '') AS DOUBLE PRECISION)) ASC NULLS LAST`)
      .limit(10);

    const avgDuration = avgDurationRaw.map((r) => ({
      agent: r.resource || "unknown",
      avgMs: r.avgDuration ? Math.round(Number(r.avgDuration)) : null,
      executions: Number(r.totalExecs),
    }));

    // 3. Success rate per agent
    //    We check details JSON for "status" field: "success" vs anything else
    const successRateRaw = await db
      .select({
        resource: auditLogs.resource,
        total: count(),
        successes: sql<number>`COUNT(*) FILTER (WHERE ${auditLogs.details}::json->>'status' = 'success')`,
      })
      .from(auditLogs)
      .where(
        and(
          sql`${auditLogs.action} LIKE 'agent.%'`,
          gte(auditLogs.createdAt, startOfMonth)
        )
      )
      .groupBy(auditLogs.resource)
      .orderBy(desc(count()))
      .limit(10);

    const successRate = successRateRaw.map((r) => ({
      agent: r.resource || "unknown",
      total: Number(r.total),
      successes: Number(r.successes),
      rate: r.total ? Math.round((Number(r.successes) / Number(r.total)) * 100) : 0,
    }));

    // 4. Daily counts for last 7 days
    const dailyCountsRaw = await db
      .select({
        day: sql<string>`TO_CHAR(${auditLogs.createdAt}, 'YYYY-MM-DD')`,
        total: count(),
      })
      .from(auditLogs)
      .where(
        and(
          sql`${auditLogs.action} LIKE 'agent.%'`,
          gte(auditLogs.createdAt, sevenDaysAgo)
        )
      )
      .groupBy(sql`TO_CHAR(${auditLogs.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(${auditLogs.createdAt}, 'YYYY-MM-DD') ASC`);

    // Fill in missing days with 0
    const dailyCounts: { day: string; label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", { weekday: "short" });
      const found = dailyCountsRaw.find((r) => r.day === key);
      dailyCounts.push({ day: key, label, count: found ? Number(found.total) : 0 });
    }

    // 5. Total executions this month
    const totalMonthRaw = await db
      .select({ total: count() })
      .from(auditLogs)
      .where(
        and(
          sql`${auditLogs.action} LIKE 'agent.%'`,
          gte(auditLogs.createdAt, startOfMonth)
        )
      );

    const totalMonth = Number(totalMonthRaw[0]?.total || 0);

    // Also get last month for trend
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const totalLastMonthRaw = await db
      .select({ total: count() })
      .from(auditLogs)
      .where(
        and(
          sql`${auditLogs.action} LIKE 'agent.%'`,
          gte(auditLogs.createdAt, startOfLastMonth),
          sql`${auditLogs.createdAt} <= ${endOfLastMonth}`
        )
      );
    const totalLastMonth = Number(totalLastMonthRaw[0]?.total || 0);
    const trend = totalLastMonth > 0
      ? Math.round(((totalMonth - totalLastMonth) / totalLastMonth) * 100)
      : totalMonth > 0 ? 100 : 0;

    return NextResponse.json({
      topAgents,
      avgDuration,
      successRate,
      dailyCounts,
      totalMonth,
      trend,
    });
  } catch (err) {
    log.error("Failed to fetch agent analytics", { error: String(err) });
    return NextResponse.json(
      { error: "Failed to fetch analytics", topAgents: [], avgDuration: [], successRate: [], dailyCounts: [], totalMonth: 0, trend: 0 },
      { status: 500 }
    );
  }
}
