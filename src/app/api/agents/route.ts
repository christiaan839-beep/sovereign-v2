/**
 * GET /api/agents — public registry of every callable agent slug.
 *
 * Used by the SDK for runtime discovery and by the OpenAPI spec for
 * codegen. No auth — the catalog is intentionally public so devs can
 * inspect it before committing to bearer-token integration.
 *
 * Query params:
 *   ?tier=core       — only core agents (the curated flagship lineup)
 *   ?tier=experimental — only the long tail
 *   ?tier=deprecated — sunset list
 *   no tier filter   — everything except deprecated (matches the
 *                      marketplace default surface)
 */
import { NextResponse } from "next/server";
import { AGENT_SLUGS } from "@/lib/agent-slugs";
import { getAgentTier, type AgentTier } from "@/lib/agent-tiers";

const VALID_TIERS = new Set<AgentTier>(["core", "experimental", "deprecated"]);

function slugToName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tierParam = url.searchParams.get("tier");
  const tierFilter =
    tierParam && VALID_TIERS.has(tierParam as AgentTier)
      ? (tierParam as AgentTier)
      : null;

  const items = AGENT_SLUGS.map((slug) => ({
    slug,
    name: slugToName(slug),
    tier: getAgentTier(slug),
    invokeUrl: `/api/_agents/${slug}`,
  }))
    .filter((a) => {
      if (tierFilter) return a.tier === tierFilter;
      // Default: hide deprecated, show core + experimental
      return a.tier !== "deprecated";
    })
    // Stable sort: core first, then experimental, then by slug.
    .sort((a, b) => {
      const order = { core: 0, experimental: 1, deprecated: 2 };
      const dt = order[a.tier] - order[b.tier];
      if (dt !== 0) return dt;
      return a.slug.localeCompare(b.slug);
    });

  return NextResponse.json(
    {
      items,
      total: items.length,
      tiers: {
        core: items.filter((a) => a.tier === "core").length,
        experimental: items.filter((a) => a.tier === "experimental").length,
        deprecated: items.filter((a) => a.tier === "deprecated").length,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}
