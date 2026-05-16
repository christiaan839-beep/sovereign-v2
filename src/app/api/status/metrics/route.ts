/**
 * SOVEREIGN MATRIX — /api/status/metrics (Wave 15).
 *
 * Public read-only feed of real production latency / success-rate /
 * volume numbers, computed live from agent_runs (where every signed
 * run lands). Renders on the /status page so visitors see actual
 * production numbers, not hardcoded marketing uptime.
 *
 * Returns StatusMetrics: 24h / 7d / 30d windows with p50, p95, p99,
 * max latency, total count, success count, success rate, and an
 * overall verdict (ok / degraded / fail) derived from the 24h block.
 *
 * No auth required. 60-second cache — recomputing every request would
 * scan 50k rows per window per call.
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { computeStatusMetrics } from "@/lib/status-metrics";

const limiter = rateLimit({ interval: 60, limit: 60 });

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const metrics = await computeStatusMetrics();
  return NextResponse.json(metrics, {
    status: 200,
    headers: {
      // Mirror the recompute cadence — 60s is the right floor for a
      // status page (any tighter is wasted DB cycles, any looser hides
      // a real outage too long).
      "cache-control": "public, max-age=60, s-maxage=60",
    },
  });
}
