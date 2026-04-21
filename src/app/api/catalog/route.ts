/**
 * GET /api/catalog — public catalog list.
 *
 * Drives /world (constellation), /marketplace (grid), and any surface that
 * needs the full agent list with 30-day rollup stats. Thin wrapper around
 * listCatalog() in the agent-catalog service; adds a per-category count
 * rollup (so the UI can render filter chips without recomputing) and
 * edge-level Cache-Control so Vercel serves ~60s-stale data for free.
 *
 * Query params:
 *   category=<string>   — optional filter
 *   limit=<int>         — default 500, clamped [1, 500]
 *
 * Response:
 *   { agents: PublicAgent[], counts: Record<category, count>, total: number }
 */

import { NextResponse } from "next/server";
import { listCatalog } from "@/lib/agent-catalog";

const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 500;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category") ?? undefined;

  const rawLimit = Number(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT));
  // Clamp. Also trap NaN from garbage input (Number("abc") → NaN).
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), MAX_LIMIT)
      : DEFAULT_LIMIT;

  const agents = await listCatalog({ category, limit });

  const counts = agents.reduce<Record<string, number>>((acc, a) => {
    acc[a.category] = (acc[a.category] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json(
    { agents, counts, total: agents.length },
    {
      headers: {
        // 60s at the edge + 60s browser. Stats are rolled up nightly,
        // so fresh-within-a-minute is fine.
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    },
  );
}
