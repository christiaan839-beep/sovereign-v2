import { NextResponse } from "next/server";
import { db } from "@/db";
import { marketplaceAgents } from "@/db/schema";
import { eq, sum, count, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth-guard";
import { createLogger } from "@/lib/logger";

const log = createLogger("marketplace-stats");

/**
 * CREATOR STATS — GET /api/marketplace/stats
 *
 * Returns revenue, run counts, and per-agent breakdown for the
 * authenticated creator. Used by the Creator Dashboard UI.
 *
 * Revenue model: 70% creator / 20% Sovereign Matrix / 10% infra.
 * `creatorRevenueCents` in the DB already stores the 70% share.
 */

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const userId = auth.userId || "";

  try {
    // Run all queries in parallel
    const _ago30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000);

    const [agents, totals, recent] = await Promise.all([
      // All agents owned by this creator
      db
        .select({
          id: marketplaceAgents.id,
          name: marketplaceAgents.name,
          category: marketplaceAgents.category,
          pricePerRun: marketplaceAgents.pricePerRun,
          installs: marketplaceAgents.installs,
          rating: marketplaceAgents.rating,
          totalRunCount: marketplaceAgents.totalRunCount,
          weeklyRunCount: marketplaceAgents.weeklyRunCount,
          revenueCents: marketplaceAgents.revenueCents,
          creatorRevenueCents: marketplaceAgents.creatorRevenueCents,
          verificationStatus: marketplaceAgents.verificationStatus,
          safetyScore: marketplaceAgents.safetyScore,
          featured: marketplaceAgents.featured,
          createdAt: marketplaceAgents.createdAt,
        })
        .from(marketplaceAgents)
        .where(eq(marketplaceAgents.creatorUserId, userId))
        .orderBy(desc(marketplaceAgents.creatorRevenueCents)),

      // Aggregate totals
      db
        .select({
          totalRuns: sum(marketplaceAgents.totalRunCount),
          totalRevenue: sum(marketplaceAgents.revenueCents),
          creatorRevenue: sum(marketplaceAgents.creatorRevenueCents),
          agentCount: count(),
        })
        .from(marketplaceAgents)
        .where(eq(marketplaceAgents.creatorUserId, userId)),

      // Recent 30d run counts
      db
        .select({
          weeklyRuns: sum(marketplaceAgents.weeklyRunCount),
        })
        .from(marketplaceAgents)
        .where(eq(marketplaceAgents.creatorUserId, userId)),
    ]);

    const t = totals[0] ?? {};

    // Revenue breakdown
    const grossRevenueCents = Number(t.totalRevenue ?? 0);
    const creatorRevenueCents = Number(t.creatorRevenue ?? 0);
    const platformRevenueCents = Math.floor(grossRevenueCents * 0.2);
    const infraRevenueCents = grossRevenueCents - creatorRevenueCents - platformRevenueCents;

    log.info("Creator stats served", { userId, agentCount: agents.length });

    return NextResponse.json({
      summary: {
        totalAgents: Number(t.agentCount ?? 0),
        totalRuns: Number(t.totalRuns ?? 0),
        weeklyRuns: Number(recent[0]?.weeklyRuns ?? 0),
        revenue: {
          grossCents: grossRevenueCents,
          grossDollars: (grossRevenueCents / 100).toFixed(2),
          creatorCents: creatorRevenueCents,
          creatorDollars: (creatorRevenueCents / 100).toFixed(2),
          platformCents: platformRevenueCents,
          infraCents: infraRevenueCents,
          split: { creator: 70, platform: 20, infra: 10 },
        },
      },
      agents: agents.map((a) => ({
        ...a,
        priceDisplay: a.pricePerRun === 0 ? "Free" : `$${(a.pricePerRun / 100).toFixed(2)}/run`,
        creatorRevenueDisplay: `$${((a.creatorRevenueCents ?? 0) / 100).toFixed(2)}`,
        tags: [], // Tags not loaded in summary query — fetch per-agent if needed
      })),
    });
  } catch (err) {
    log.error("Marketplace stats failed", err as Record<string, unknown>);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
