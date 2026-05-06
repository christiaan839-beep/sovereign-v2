import { NextResponse } from "next/server";
import { getProofStats } from "@/lib/proof-stats";

export const runtime = "nodejs";
// 5-minute revalidate. Numbers don't change minute-to-minute and
// caching keeps Neon happy if the public /proof page goes viral.
export const revalidate = 300;

/**
 * GET /api/proof/stats — public, no auth, edge-cached.
 *
 * Thin wrapper around `getProofStats()` (src/lib/proof-stats.ts) so
 * the same logic powers the /proof server component. Read the lib
 * for the methodology + failure modes — none of that lives here.
 */
export async function GET() {
  const stats = await getProofStats();
  return NextResponse.json(stats, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
    },
  });
}
