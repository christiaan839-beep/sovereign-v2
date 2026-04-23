/**
 * GET /api/marketplace/search?q=<query>&limit=<N>
 *
 * Public semantic search over the marketplace catalog. Uses:
 *   1. nvidia/llama-3.2-nv-embedqa-1b-v2 (embed query)
 *   2. Cosine similarity over stored agent embeddings
 *   3. nvidia/llama-nemotron-rerank-1b-v2 (rerank top 20 → top N)
 *
 * Falls back to ILIKE keyword search when NIM is unavailable, and
 * returns an empty result set on any other failure. Never throws.
 *
 * Rate-limited per IP (30/min) so search is cheap to abuse but also
 * cheap to use from client-side live-search.
 */

import { NextResponse } from "next/server";
import { checkIpRateLimit, extractClientIp } from "@/lib/api-guard";
import { searchMarketplace } from "@/lib/marketplace-search";

function parseLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(Math.floor(n), 50);
}

export async function GET(request: Request): Promise<Response> {
  // Generous cap — search is cheap and valuable; we want live-search
  // on the catalog page to "just work" as users type.
  const ip = extractClientIp(request.headers);
  const gate = checkIpRateLimit(ip, {
    bucket: "marketplace-search",
    windowMs: 60_000,
    max: 30,
  });
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "Too many searches — slow down for a minute." },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.ceil(gate.resetIn / 1000)),
        },
      },
    );
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = parseLimit(url.searchParams.get("limit"));
  const skipRerank = url.searchParams.get("rerank") === "0";

  const { hits, mode } = await searchMarketplace(q, { limit, skipRerank });

  return NextResponse.json(
    {
      query: q,
      mode,
      count: hits.length,
      hits,
    },
    {
      status: 200,
      headers: {
        // Cache results briefly so fast-typed queries from the same
        // user don't hammer NIM; Vercel edge will still respect this.
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    },
  );
}
