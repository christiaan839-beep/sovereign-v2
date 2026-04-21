/**
 * agent-catalog.ts — single read API for the Sovereign World surfaces.
 *
 * Consumed by /world (constellation), /marketplace (grid), /agents/[slug]
 * (public SEO page), and /leaderboard. Joins the code registry
 * (AGENT_REGISTRY) with the agent_metadata + agent_stats_daily +
 * agent_reviews DB tables so the UI never has to touch Drizzle directly.
 *
 * Invariants:
 *   - An agent is listed only if a metadata row exists (seed script
 *     runs on deploy to guarantee one per registry slug).
 *   - getAgentPublic() returns null for slugs not in the code registry
 *     — those URLs are always 404s, even if a metadata row exists.
 *   - successRate is computed client-side (successes / runs) to avoid
 *     leaking COALESCE/CAST quirks into the API shape.
 */

import { db } from "@/db";
import { agentMetadata, agentStatsDaily, agentReviews } from "@/db/schema";
import { AGENT_REGISTRY } from "@/app/api/agents/registry";
import { and, eq, gte, sql } from "drizzle-orm";

/**
 * Public shape served to /world, /marketplace, and /agents/[slug].
 * Do NOT include creator_user_id or internal routing details — this
 * shape is what leaves the server.
 */
export interface PublicAgent {
  slug: string;
  displayName: string;
  tagline: string | null;
  description: string | null;
  category: string;
  icon: string | null;
  heroColor: string | null;
  creatorHandle: string | null;
  pricingCents: number;
  tags: string[];
  featured: boolean;
  verified: boolean;
  // 30-day rollup stats
  runs30d: number;
  successRate: number;
  avgDurationMs: number | null;
  // Per-agent only (single-agent detail pages fetch reviews; list pages don't)
  avgRating: number | null;
  reviewCount: number;
}

const ACRONYMS = /^(seo|api|roi|vsl|ocr|rag|tts|asr|ai|pii|kpi|b2b|b2c|crm|kyc|llm|mcp|mrr|sla|sms|soc|sql|ssl|tls|ui|ux)$/;

/**
 * Humanize slug → display name, matching the seed script logic.
 * Used when metadata row is missing — new agents in the registry
 * that haven't been seeded yet still render something sane.
 */
function humanize(slug: string): string {
  return slug
    .split("-")
    .map((w) => {
      if (ACRONYMS.test(w)) return w.toUpperCase();
      if (w.length === 0) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/**
 * 30-day window as ISO date (YYYY-MM-DD).
 *
 * agent_stats_daily.day is a Postgres DATE column (not TIMESTAMP) and
 * Drizzle's default string-mode maps it to a string. Passing a Date
 * here would fail type-check — and would be semantically sloppy anyway,
 * since DATE comparisons ignore time.
 */
function since30Days(): string {
  const d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10); // "2026-03-22"
}

/** List all public agents with 30d rollup stats. */
export async function listCatalog(
  opts: { category?: string; limit?: number } = {},
): Promise<PublicAgent[]> {
  const since = since30Days();

  let query = db
    .select({
      slug: agentMetadata.slug,
      displayName: agentMetadata.displayName,
      tagline: agentMetadata.tagline,
      description: agentMetadata.description,
      category: agentMetadata.category,
      icon: agentMetadata.icon,
      heroColor: agentMetadata.heroColor,
      creatorHandle: agentMetadata.creatorHandle,
      pricingCents: agentMetadata.pricingCents,
      tags: agentMetadata.tags,
      featured: agentMetadata.featured,
      verified: agentMetadata.verified,
      runs30d: sql<number>`COALESCE(SUM(${agentStatsDaily.runs}), 0)::int`,
      successes30d: sql<number>`COALESCE(SUM(${agentStatsDaily.successes}), 0)::int`,
      avgDurationMs: sql<number | null>`AVG(${agentStatsDaily.avgDurationMs})::int`,
    })
    .from(agentMetadata)
    .leftJoin(
      agentStatsDaily,
      and(
        eq(agentStatsDaily.agentSlug, agentMetadata.slug),
        gte(agentStatsDaily.day, since),
      ),
    )
    .where(
      opts.category ? eq(agentMetadata.category, opts.category) : sql`TRUE`,
    )
    .groupBy(agentMetadata.slug) as unknown as ReturnType<typeof db.select>;

  if (opts.limit != null) {
    query = (query as unknown as { limit: (n: number) => typeof query }).limit(opts.limit);
  }

  const rows = (await query) as unknown as Array<{
    slug: string;
    displayName: string;
    tagline: string | null;
    description: string | null;
    category: string;
    icon: string | null;
    heroColor: string | null;
    creatorHandle: string | null;
    pricingCents: number;
    tags: string[] | null;
    featured: boolean;
    verified: boolean;
    runs30d: number;
    successes30d: number;
    avgDurationMs: number | null;
  }>;

  return rows.map((r) => ({
    slug: r.slug,
    displayName: r.displayName,
    tagline: r.tagline,
    description: r.description,
    category: r.category,
    icon: r.icon,
    heroColor: r.heroColor,
    creatorHandle: r.creatorHandle,
    pricingCents: r.pricingCents,
    tags: r.tags ?? [],
    featured: r.featured,
    verified: r.verified,
    runs30d: r.runs30d,
    successRate: r.runs30d > 0 ? r.successes30d / r.runs30d : 0,
    avgDurationMs: r.avgDurationMs,
    avgRating: null, // filled by getAgentPublic for single-agent pages
    reviewCount: 0,
  }));
}

/**
 * Single-agent public detail — used by /agents/[slug] and marketplace detail.
 * Returns null when the slug isn't in the registry (invalid URL).
 *
 * Fetches metadata, reviews-rollup, and 30d stats as three separate queries
 * rather than one big join. /agents/[slug] is cacheable at the edge, so an
 * extra query hop is cheap — and the SQL stays readable.
 */
export async function getAgentPublic(slug: string): Promise<PublicAgent | null> {
  if (!(slug in AGENT_REGISTRY)) return null;

  const metadataRows = (await db
    .select()
    .from(agentMetadata)
    .where(eq(agentMetadata.slug, slug))
    .limit(1)) as unknown as Array<{
      slug: string;
      displayName: string;
      tagline: string | null;
      description: string | null;
      category: string;
      icon: string | null;
      heroColor: string | null;
      creatorHandle: string | null;
      pricingCents: number;
      tags: string[] | null;
      featured: boolean;
      verified: boolean;
    }>;

  const metadata = metadataRows[0];

  // Fallback — agent in code registry but metadata row missing (seed hasn't run)
  if (!metadata) {
    return {
      slug,
      displayName: humanize(slug),
      tagline: null,
      description: null,
      category: "general",
      icon: null,
      heroColor: null,
      creatorHandle: null,
      pricingCents: 0,
      tags: [],
      featured: false,
      verified: false,
      runs30d: 0,
      successRate: 0,
      avgDurationMs: null,
      avgRating: null,
      reviewCount: 0,
    };
  }

  const since = since30Days();

  const [reviewAgg, stats] = (await Promise.all([
    db
      .select({
        avgRating: sql<number>`COALESCE(AVG(${agentReviews.rating}), 0)::real`,
        reviewCount: sql<number>`COUNT(*)::int`,
      })
      .from(agentReviews)
      .where(eq(agentReviews.agentSlug, slug)),
    db
      .select({
        runs: sql<number>`COALESCE(SUM(${agentStatsDaily.runs}), 0)::int`,
        successes: sql<number>`COALESCE(SUM(${agentStatsDaily.successes}), 0)::int`,
        avgDuration: sql<number | null>`AVG(${agentStatsDaily.avgDurationMs})::int`,
      })
      .from(agentStatsDaily)
      .where(and(eq(agentStatsDaily.agentSlug, slug), gte(agentStatsDaily.day, since))),
  ])) as unknown as [
    Array<{ avgRating: number; reviewCount: number }>,
    Array<{ runs: number; successes: number; avgDuration: number | null }>,
  ];

  const review = reviewAgg[0];
  const stat = stats[0];

  return {
    slug,
    displayName: metadata.displayName,
    tagline: metadata.tagline,
    description: metadata.description,
    category: metadata.category,
    icon: metadata.icon,
    heroColor: metadata.heroColor,
    creatorHandle: metadata.creatorHandle,
    pricingCents: metadata.pricingCents,
    tags: metadata.tags ?? [],
    featured: metadata.featured,
    verified: metadata.verified,
    runs30d: stat?.runs ?? 0,
    successRate: stat && stat.runs > 0 ? stat.successes / stat.runs : 0,
    avgDurationMs: stat?.avgDuration ?? null,
    avgRating: review && review.reviewCount > 0 ? review.avgRating : null,
    reviewCount: review?.reviewCount ?? 0,
  };
}
