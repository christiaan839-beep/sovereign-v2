import { NextResponse } from "next/server";
import { getUsageStats, getUsageLogs } from "@/lib/agent-auth";
import { requireAuth } from "@/lib/auth-guard";
import { db } from "@/db";
import { usage, leads, generations } from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * AGENT ANALYTICS API — Returns usage statistics for the analytics dashboard.
 * Combines in-memory stats with database-backed metrics.
 */

export async function GET() {
  const auth = await requireAuth(); if (auth.error) return auth.error;

  // In-memory stats (always available)
  const stats = getUsageStats();
  const recentLogs = getUsageLogs().slice(-50).reverse();

  // Database-backed stats (graceful fallback on error)
  let dbStats: Record<string, unknown> = {};
  try {
    const [usageCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usage);

    const [leadsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads);

    const [gensCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(generations);

    const [totalTokens] = await db
      .select({ total: sql<number>`coalesce(sum(${usage.tokensUsed}), 0)` })
      .from(usage);

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
