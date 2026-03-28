import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { usage, leads, bookings, generations } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { getSignalStats } from "@/lib/agent-memory";

/**
 * DASHBOARD STATS API — Real metrics for the home page.
 *
 * Returns agent execution counts, lead stats, booking counts,
 * and cross-agent signal activity.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const email = auth.email || "";

    // Parallel DB queries for speed
    const [usageRows, leadRows, bookingRows, generationRows] = await Promise.all([
      db.select({
        count: sql<number>`count(*)`,
        totalTokens: sql<number>`coalesce(sum(${usage.tokensUsed}), 0)`,
      }).from(usage).where(eq(usage.userId, email)).then(r => r[0]),

      db.select({
        count: sql<number>`count(*)`,
      }).from(leads).where(eq(leads.userEmail, email)).then(r => r[0]),

      db.select({
        count: sql<number>`count(*)`,
      }).from(bookings).where(eq(bookings.userEmail, email)).then(r => r[0]),

      db.select({
        count: sql<number>`count(*)`,
      }).from(generations).where(eq(generations.userEmail, email))
        .then(r => r[0]),
    ]);

    // Recent activity — last 5 agent executions
    const recentActivity = await db.select({
      agentId: usage.agentId,
      model: usage.model,
      tokens: usage.tokensUsed,
      createdAt: usage.createdAt,
    })
      .from(usage)
      .where(eq(usage.userId, email))
      .orderBy(desc(usage.createdAt))
      .limit(5);

    // Cross-agent signal stats
    const signals = getSignalStats();

    return NextResponse.json({
      stats: {
        agentExecutions: Number(usageRows?.count || 0),
        totalTokens: Number(usageRows?.totalTokens || 0),
        leadsGenerated: Number(leadRows?.count || 0),
        bookings: Number(bookingRows?.count || 0),
        contentGenerated: Number(generationRows?.count || 0),
      },
      recentActivity,
      signals: {
        totalSignals: signals.totalSignals,
        lastHour: signals.lastHour,
        activeSubscriptions: signals.activeSubscriptions,
        topSources: signals.topSources,
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Return zeros if DB is unavailable (graceful degradation)
    return NextResponse.json({
      stats: {
        agentExecutions: 0,
        totalTokens: 0,
        leadsGenerated: 0,
        bookings: 0,
        contentGenerated: 0,
      },
      recentActivity: [],
      signals: { totalSignals: 0, lastHour: 0, activeSubscriptions: 0, topSources: [] },
      timestamp: new Date().toISOString(),
    });
  }
}
