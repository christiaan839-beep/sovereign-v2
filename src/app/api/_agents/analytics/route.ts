import { NextResponse } from "next/server";
import { getUsageStats, getUsageLogs } from "@/lib/agent-auth";
import { requireAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { usage, leads, generations } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * AGENT ANALYTICS API — Returns usage statistics for the
 * authenticated user's analytics dashboard. Combines in-memory
 * stats with database-backed per-user metrics.
 *
 * SECURITY: every DB query is scoped to the caller's identity
 * (userId for `usage`, userEmail for `leads`/`generations`).
 * Earlier versions of this route ran `count(*) FROM leads` /
 * `count(*) FROM generations` etc. with no WHERE clause — the
 * caller saw PLATFORM-WIDE counts. That leaked competitively
 * sensitive growth data: anyone with a free account could poll
 * daily and chart total customer leads / generations / API calls.
 * Fixed 2026-04-27.
 */

export async function GET() {
  const auth = await requireAuth(); if (auth.error) return auth.error;
  const { userId, email } = auth;

  // In-memory stats (always available)
  const stats = getUsageStats();
  const recentLogs = getUsageLogs().slice(-50).reverse();

  // Database-backed stats — scoped to the caller. Previous version
  // returned platform-wide aggregates; this version returns ONLY the
  // caller's rows.
  let dbStats: Record<string, unknown> = {};
  try {
    // `usage` table keys by userId (Clerk subject); `leads` /
    // `generations` key by userEmail (legacy schema).
    const [usageCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usage)
      .where(eq(usage.userId, userId));

    const [leadsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.userEmail, email));

    const [gensCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(generations)
      .where(eq(generations.userEmail, email));

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
      db_note: "Database stats unavailable — using mock defaults",
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
