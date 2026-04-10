import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getUsageStats, getUsageLogs } from "@/lib/agent-auth";
import { db } from "@/db";
import { usage, leads, generations } from "@/db/schema";
import { sql, eq } from "drizzle-orm";

/**
 * AGENT ANALYTICS API — Returns usage statistics for the analytics dashboard.
 * Combines in-memory stats with database-backed metrics.
 *
 * SECURITY: Results are scoped to the authenticated user. Previously this
 * route returned platform-wide global counts, leaking business metrics
 * (total users, total tokens, total generations) to any logged-in user.
 */

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = await currentUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress || "";

  // In-memory stats (always available)
  const stats = getUsageStats();
  const recentLogs = getUsageLogs().slice(-50).reverse();

  // Database-backed stats — scoped to the authenticated user.
  let dbStats: Record<string, unknown> = {};
  try {
    const [usageCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usage)
      .where(eq(usage.userId, userId));

    // leads + generations are scoped by userEmail (legacy), not userId.
    // Fall back to zero if email unavailable so we never return global counts.
    const [leadsCount] = userEmail
      ? await db
          .select({ count: sql<number>`count(*)` })
          .from(leads)
          .where(eq(leads.userEmail, userEmail))
      : [{ count: 0 }];

    const [gensCount] = userEmail
      ? await db
          .select({ count: sql<number>`count(*)` })
          .from(generations)
          .where(eq(generations.userEmail, userEmail))
      : [{ count: 0 }];

    const [totalTokens] = await db
      .select({ total: sql<number>`coalesce(sum(${usage.tokensUsed}), 0)` })
      .from(usage)
      .where(eq(usage.userId, userId));

    dbStats = {
      db_total_api_calls: Number(usageCount.count),
      db_total_leads: Number(leadsCount.count),
      db_total_generations: Number(gensCount.count),
      db_total_tokens: Number(totalTokens.total),
    };
  } catch {
    dbStats = {
      db_total_api_calls: 0,
      db_total_leads: 0,
      db_total_generations: 0,
      db_total_tokens: 0,
      db_note: "Database stats unavailable — using defaults",
    };
  }

  return NextResponse.json({
    status: "Analytics Engine — Active",
    ...stats,
    ...dbStats,
    recent_activity: recentLogs,
    timestamp: new Date().toISOString(),
  });
}
