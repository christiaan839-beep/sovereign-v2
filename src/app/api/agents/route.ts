import { NextResponse } from "next/server";
import { AGENT_REGISTRY } from "./registry";
import { FEATURED_AGENTS, isFeaturedAgent } from "./catalog-meta";

/**
 * GET /api/agents
 *
 * Public agent catalog. Returns ONLY the featured ~30 agents by
 * default — not all 131 in the auto-generated registry. This is
 * the marketing surface; the dashboard shows all agents to
 * authenticated users.
 *
 * Query params:
 *   ?all=1        — return every registered agent (131), not just
 *                    featured. Used by the dashboard + partner
 *                    integrations.
 *   ?category=X   — filter to a specific category (TODO: needs
 *                    category metadata; currently returns featured
 *                    regardless).
 *
 * Response shape:
 *   {
 *     count: number,
 *     featured: number,   // Always ~30 regardless of ?all
 *     agents: [
 *       { slug: string, resumeUrl: string, runUrl: string, featured: boolean }
 *     ]
 *   }
 *
 * Cache: 1-hour edge cache. The registry only changes on deploy so
 * revalidation on every request would be wasteful.
 */

export const revalidate = 3600;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const all = url.searchParams.get("all") === "1";

  const allSlugs = Object.keys(AGENT_REGISTRY).sort();
  const visibleSlugs = all ? allSlugs : allSlugs.filter(isFeaturedAgent);

  return NextResponse.json(
    {
      count: visibleSlugs.length,
      featured: FEATURED_AGENTS.size,
      total: allSlugs.length,
      agents: visibleSlugs.map((slug) => ({
        slug,
        featured: isFeaturedAgent(slug),
        resumeUrl: `/api/agents/${slug}.agent.md`,
        runUrl: `/api/agents/${slug}`,
      })),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
      },
    },
  );
}
