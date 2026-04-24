/**
 * GET /api/public/catalog
 *
 * Public catalog feed for the landing v2 Staff Directory + Atlas.
 * Returns the 223 agents with 30-day rollup stats in the shape:
 *
 *   { agents: PublicAgent[], count: number }
 *
 * Never 500s on DB outage — falls back to 503 with a cacheable error
 * response so clients render the static-roster fallback instead of a
 * broken grid.
 */

import { NextResponse } from "next/server";
import { listCatalog } from "@/lib/agent-catalog";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const category = url.searchParams.get("category") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Math.min(200, Math.max(1, Number(limitParam))) : undefined;

  try {
    const agents = await listCatalog({ category, limit });
    return NextResponse.json(
      { agents, count: agents.length },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    console.error("[api/public/catalog] failed", err);
    return NextResponse.json(
      { error: "catalog temporarily unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "public, s-maxage=30" },
      },
    );
  }
}
