import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { usage } from "@/db/schema";
import { desc, gte, sql } from "drizzle-orm";

/**
 * GET /api/admin/cost-breakdown?window=7d|30d
 *
 * Admin-only. Reads from the usage ledger and aggregates:
 *   - total cost (all time + window)
 *   - top 10 agents by cost in window
 *   - top 10 users by cost in window
 *   - per-provider split in window (anthropic / nvidia-nim / gemini / …)
 *
 * All aggregations use the same SINCE cutoff so the numbers line up.
 */
export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const url = new URL(req.url);
  const window = url.searchParams.get("window") === "7d" ? "7d" : "30d";
  const daysBack = window === "7d" ? 7 : 30;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  // Total all-time and window
  const [totals] = await db
    .select({
      totalAllTimeCents: sql<number>`COALESCE(SUM(${usage.costCents}), 0)::int`,
    })
    .from(usage);

  const [windowTotals] = await db
    .select({
      cents: sql<number>`COALESCE(SUM(${usage.costCents}), 0)::int`,
      requests: sql<number>`COUNT(*)::int`,
    })
    .from(usage)
    .where(gte(usage.createdAt, since));

  // Top agents in window
  const topAgents = await db
    .select({
      agentId: usage.agentId,
      cents: sql<number>`COALESCE(SUM(${usage.costCents}), 0)::int`,
      requests: sql<number>`COUNT(*)::int`,
    })
    .from(usage)
    .where(gte(usage.createdAt, since))
    .groupBy(usage.agentId)
    .orderBy(desc(sql`SUM(${usage.costCents})`))
    .limit(10);

  // Top users in window
  const topUsers = await db
    .select({
      userId: usage.userId,
      cents: sql<number>`COALESCE(SUM(${usage.costCents}), 0)::int`,
      requests: sql<number>`COUNT(*)::int`,
    })
    .from(usage)
    .where(gte(usage.createdAt, since))
    .groupBy(usage.userId)
    .orderBy(desc(sql`SUM(${usage.costCents})`))
    .limit(10);

  // Per-provider split
  const byProvider = await db
    .select({
      provider: usage.provider,
      cents: sql<number>`COALESCE(SUM(${usage.costCents}), 0)::int`,
      requests: sql<number>`COUNT(*)::int`,
      tokens: sql<number>`COALESCE(SUM(${usage.tokensUsed}), 0)::int`,
    })
    .from(usage)
    .where(gte(usage.createdAt, since))
    .groupBy(usage.provider)
    .orderBy(desc(sql`SUM(${usage.costCents})`));

  return NextResponse.json({
    window,
    sinceIso: since.toISOString(),
    allTimeCents: totals?.totalAllTimeCents ?? 0,
    windowCents: windowTotals?.cents ?? 0,
    windowRequests: windowTotals?.requests ?? 0,
    topAgents,
    topUsers,
    byProvider,
  });
}
