/**
 * SOVEREIGN MATRIX — /api/status/metrics/extended (Wave 116 M8).
 *
 * Public read-only feed of extended performance numbers (per-agent,
 * per-model, trust-decision distribution, cost-savings estimate)
 * computed live from agent_runs. Pairs with /api/status/metrics
 * (which gives global p50/p95/p99) for the full operational picture.
 *
 * Query: ?window=24h | 7d | 30d (default 24h).
 * 60-second cache for the same reason status/metrics caches: recomputing
 * every request would scan tens of thousands of rows.
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { computeExtendedMetrics, type Window } from "@/lib/extended-metrics";

const limiter = rateLimit({ interval: 60, limit: 60 });

function parseWindow(raw: string | null): Window {
  if (raw === "7d" || raw === "30d" || raw === "24h") return raw;
  return "24h";
}

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const url = new URL(req.url);
  const window = parseWindow(url.searchParams.get("window"));
  const metrics = await computeExtendedMetrics(window);

  return NextResponse.json(metrics, {
    status: 200,
    headers: {
      "cache-control": "public, max-age=60, s-maxage=60",
    },
  });
}
