import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentActivity } from "@/db/schema";
import { eq, and, gte, count, sql, avg as _avg } from "drizzle-orm";

const log = createLogger("agent-performance");

/**
 * AGENT PERFORMANCE API — Track which agents perform best.
 *
 * Returns per-agent metrics: execution count, success rate,
 * average duration, quality trends. Used by the admin dashboard
 * and for internal optimization.
 *
 * GET: Returns performance metrics for all agents (last 30 days)
 */

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const day30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const day7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    // Agent execution stats (last 30 days)
    const agentStats = await db
      .select({
        agent: agentActivity.agentName,
        totalRuns: count(),
        successRuns: sql<number>`count(*) filter (where ${agentActivity.action} = 'completed')`,
        failedRuns: sql<number>`count(*) filter (where ${agentActivity.action} = 'failed')`,
      })
      .from(agentActivity)
      .where(
        and(
          eq(agentActivity.userId, userId),
          gte(agentActivity.createdAt, day30),
        ),
      )
      .groupBy(agentActivity.agentName)
      .orderBy(sql`count(*) desc`)
      .limit(20);

    // Recent activity (last 7 days for trend)
    const recentStats = await db
      .select({
        agent: agentActivity.agentName,
        runs: count(),
      })
      .from(agentActivity)
      .where(
        and(
          eq(agentActivity.userId, userId),
          gte(agentActivity.createdAt, day7),
        ),
      )
      .groupBy(agentActivity.agentName)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    // Total executions
    const [totalResult] = await db
      .select({ value: count() })
      .from(agentActivity)
      .where(
        and(
          eq(agentActivity.userId, userId),
          gte(agentActivity.createdAt, day30),
        ),
      );

    const leaderboard = agentStats.map((a) => {
      const total = Number(a.totalRuns);
      const succeeded = Number(a.successRuns);
      const failed = Number(a.failedRuns);
      const successRate = total > 0 ? Math.round((succeeded / total) * 100) : 0;

      // Check 7-day trend
      const recent = recentStats.find((r) => r.agent === a.agent);
      const recentRuns = recent ? Number(recent.runs) : 0;
      const weeklyRate = total > 0 ? Math.round((recentRuns / total) * 100) : 0;

      return {
        agent: a.agent,
        totalRuns: total,
        succeeded,
        failed,
        successRate,
        trend:
          weeklyRate > 30 ? "rising" : weeklyRate > 15 ? "stable" : "declining",
        recentRuns7d: recentRuns,
      };
    });

    return NextResponse.json({
      period: "last_30_days",
      totalExecutions: Number(totalResult?.value ?? 0),
      agentCount: leaderboard.length,
      leaderboard,
      topAgent: leaderboard[0]?.agent || "none",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    log.error("[agent-performance]", { error: String(err) });
    return NextResponse.json(
      { error: "Failed to fetch performance data" },
      { status: 500 },
    );
  }
}
