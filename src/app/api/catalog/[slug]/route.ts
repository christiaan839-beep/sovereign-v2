/**
 * GET /api/catalog/[slug] — public agent detail.
 *
 * Used by /agents/[slug] SEO pages and the marketplace detail drawer.
 * Delegates to getAgentPublic() in the agent-catalog service.
 *
 * Cache policy:
 *   - Hit  : 30s browser + 60s edge (stats roll up nightly — plenty fresh).
 *   - Miss : no-cache — so a newly-seeded agent surfaces without a TTL wait.
 */

import { NextResponse } from "next/server";
import { getAgentPublic } from "@/lib/agent-catalog";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const agent = await getAgentPublic(slug);

  if (!agent) {
    return NextResponse.json(
      { error: "Agent not found" },
      {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    { agent },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=60",
      },
    },
  );
}
