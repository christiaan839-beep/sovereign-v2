import { NextResponse } from "next/server";
import { db } from "@/db";
import { marketplaceAgents } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("marketplace-trending");

/**
 * TRENDING AGENTS — GET /api/marketplace/trending
 *
 * Returns the top marketplace agents by weekly run count.
 * Public endpoint — no auth required for discovery.
 *
 * Used by: landing page, marketplace browse, dashboard widgets.
 */

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category") || undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "12"), 50);
    const featured = url.searchParams.get("featured") === "true";

    const conditions = [eq(marketplaceAgents.verificationStatus, "verified"), eq(marketplaceAgents.isPublic, true)];
    if (category) conditions.push(eq(marketplaceAgents.category, category));
    if (featured) conditions.push(eq(marketplaceAgents.featured, true));

    const agents = await db
      .select({
        id: marketplaceAgents.id,
        name: marketplaceAgents.name,
        description: marketplaceAgents.description,
        category: marketplaceAgents.category,
        authorName: marketplaceAgents.authorName,
        pricePerRun: marketplaceAgents.pricePerRun,
        installs: marketplaceAgents.installs,
        rating: marketplaceAgents.rating,
        totalRunCount: marketplaceAgents.totalRunCount,
        weeklyRunCount: marketplaceAgents.weeklyRunCount,
        safetyScore: marketplaceAgents.safetyScore,
        featured: marketplaceAgents.featured,
        tags: marketplaceAgents.tags,
        createdAt: marketplaceAgents.createdAt,
      })
      .from(marketplaceAgents)
      .where(and(...conditions))
      .orderBy(desc(marketplaceAgents.weeklyRunCount))
      .limit(limit);

    return NextResponse.json({
      agents: agents.map((a) => ({
        ...a,
        tags: (() => { try { return JSON.parse(a.tags ?? "[]"); } catch { return []; } })(),
        priceDisplay: a.pricePerRun === 0 ? "Free" : `$${(a.pricePerRun / 100).toFixed(2)}/run`,
        isVerified: true,
      })),
      total: agents.length,
    });
  } catch (err) {
    log.error("Trending agents failed", err as Record<string, unknown>);
    // Graceful degradation: return empty list rather than 500
    return NextResponse.json({ agents: [], total: 0 });
  }
}
