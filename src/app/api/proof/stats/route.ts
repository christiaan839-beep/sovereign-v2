import { NextResponse } from "next/server";
import { getProofStats } from "@/lib/proof-stats";
import { rateLimit } from "@/lib/rate-limit";

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
 *
 * Rate limit: the `Cache-Control` headers below mean the CDN
 * absorbs the vast majority of traffic. But a query-string buster
 * (`?_=<random>`) bypasses the cache and hits Drizzle on every
 * call — the IP-keyed limiter prevents that from hammering Neon.
 * 30/min/IP is well above legitimate dashboard polling and
 * synthetic monitoring (UptimeRobot pings, etc).
 */
const proofLimiter = rateLimit({ interval: 60, limit: 30 });

export async function GET(req: Request) {
  const limited = await proofLimiter.check(req);
  if (limited) return limited;

  const stats = await getProofStats();
  return NextResponse.json(stats, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
    },
  });
}
