/**
 * GET /api/_health/performance — per-endpoint P50/P95/P99 dashboard.
 *
 * Same in-memory SLO source as /api/_health/slo, but scoped to latency
 * distribution only (no success-rate). Useful for perf-regression diffs:
 * scrape this daily → compare P95 week over week.
 *
 * Optional query params:
 *   ?endpoint=/api/agents/god-brain   — filter to a single endpoint
 *   ?windowMinutes=60                 — rolling window (default: 1440 / 24h)
 *
 * Also exposes the cache hit rate telemetry from ai-cache — the two
 * numbers read together ("how fast, how often a cache hit") are the
 * only honest way to claim a latency win vs. competitors.
 */

import { NextResponse } from "next/server";
import { getPlatformSlo, getSloSnapshot } from "@/lib/slo-tracker";
import { getAiCacheStats } from "@/lib/ai-cache";

export const runtime = "nodejs";
export const revalidate = 30;

export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const endpoint = url.searchParams.get("endpoint") ?? null;
  const windowMinutesRaw = Number(url.searchParams.get("windowMinutes") ?? "1440");
  const windowMinutes = Number.isFinite(windowMinutesRaw)
    ? Math.max(1, Math.min(7 * 24 * 60, Math.floor(windowMinutesRaw)))
    : 1440;
  const windowMs = windowMinutes * 60 * 1000;

  const cache = getAiCacheStats();

  if (endpoint) {
    const snap = getSloSnapshot(endpoint, { windowMs });
    return NextResponse.json(
      {
        endpoint: snap,
        cache,
        generatedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } },
    );
  }

  const slo = getPlatformSlo({ windowMs });
  return NextResponse.json(
    {
      platform: slo.overall,
      endpoints: slo.endpoints,
      cache,
      generatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=30" } },
  );
}
