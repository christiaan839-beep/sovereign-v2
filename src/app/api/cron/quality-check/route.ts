import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { agentActivity } from "@/db/schema";
import { sql, gte, lt, eq } from "drizzle-orm";

/**
 * QUALITY REGRESSION DETECTION — Cron Endpoint
 *
 * Compares agent performance in the last 24 hours against
 * the previous 7-day baseline. Alerts if any agent's quality
 * drops by more than 10%.
 *
 * Run via Vercel Cron: every 6 hours
 * Or manually: GET /api/cron/quality-check?secret=CRON_SECRET
 */

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const secret = req.nextUrl.searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get all agents that had activity in the last 24 hours
    const recentActivity = await db
      .select({
        agentName: agentActivity.agentName,
        count: sql<number>`count(*)`,
      })
      .from(agentActivity)
      .where(gte(agentActivity.createdAt, oneDayAgo))
      .groupBy(agentActivity.agentName);

    const alerts: Array<{
      agentName: string;
      recentCount: number;
      baselineCount: number;
      severity: "warning" | "critical";
      message: string;
    }> = [];

    for (const agent of recentActivity) {
      // Get baseline activity (7 days before the last 24h)
      const baseline = await db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(agentActivity)
        .where(
          sql`${agentActivity.agentName} = ${agent.agentName}
              AND ${agentActivity.createdAt} >= ${sevenDaysAgo}
              AND ${agentActivity.createdAt} < ${oneDayAgo}`
        );

      const baselineDaily = baseline[0]?.count ? Number(baseline[0].count) / 6 : 0; // avg per day over 6 days
      const recentCount = Number(agent.count);

      // Check for failure spikes
      const failedRecent = await db
        .select({ count: sql<number>`count(*)` })
        .from(agentActivity)
        .where(
          sql`${agentActivity.agentName} = ${agent.agentName}
              AND ${agentActivity.createdAt} >= ${oneDayAgo}
              AND ${agentActivity.action} = 'failed'`
        );

      const failureRate = Number(failedRecent[0]?.count || 0) / Math.max(recentCount, 1);

      if (failureRate > 0.2) {
        alerts.push({
          agentName: agent.agentName,
          recentCount,
          baselineCount: Math.round(baselineDaily),
          severity: failureRate > 0.5 ? "critical" : "warning",
          message: `${agent.agentName} has ${(failureRate * 100).toFixed(0)}% failure rate in last 24h (${Number(failedRecent[0]?.count || 0)} failures out of ${recentCount} executions)`,
        });
      }

      // Check for unusual volume drops (agent might be broken/unreachable)
      if (baselineDaily > 5 && recentCount < baselineDaily * 0.3) {
        alerts.push({
          agentName: agent.agentName,
          recentCount,
          baselineCount: Math.round(baselineDaily),
          severity: "warning",
          message: `${agent.agentName} volume dropped ${((1 - recentCount / baselineDaily) * 100).toFixed(0)}% — ${recentCount} executions vs ${Math.round(baselineDaily)}/day baseline`,
        });
      }
    }

    return NextResponse.json({
      status: alerts.length > 0 ? "alerts_found" : "healthy",
      checkedAt: now.toISOString(),
      agentsChecked: recentActivity.length,
      alerts,
      criticalCount: alerts.filter((a) => a.severity === "critical").length,
      warningCount: alerts.filter((a) => a.severity === "warning").length,
    });
  } catch (error) {
    console.error("[Quality Check]", error);
    return NextResponse.json({ error: "Quality check failed" }, { status: 500 });
  }
}
