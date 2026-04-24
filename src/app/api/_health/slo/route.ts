/**
 * GET /api/_health/slo — measurable SLO snapshot.
 *
 * Returns a rolled-up view of platform uptime + latency sourced from
 * the in-memory SLO tracker. Safe to publish externally (no secrets,
 * no tenant data). Intended for a future public status page.
 *
 * Example response:
 *   {
 *     "platform": {
 *       "windowSeconds": 86400,
 *       "totalRequests": 12453,
 *       "successRatePct": 99.94,
 *       "p95Ms": 820,
 *       "observedEndpoints": 42
 *     },
 *     "topEndpoints": [
 *       { "endpoint": "/api/agents/god-brain", "totalRequests": 2100, ... },
 *       ...
 *     ],
 *     "generatedAt": "2026-04-24T12:45:00Z"
 *   }
 */

import { NextResponse } from "next/server";
import { getPlatformSlo } from "@/lib/slo-tracker";

export const runtime = "nodejs";
// This endpoint is deliberately cacheable for 30s — SLO numbers don't
// need real-time precision, and caching prevents polling from skewing
// the latency numbers themselves.
export const revalidate = 30;

export async function GET(): Promise<NextResponse> {
  const slo = getPlatformSlo({ windowMs: 24 * 60 * 60 * 1000 });
  return NextResponse.json(
    {
      platform: slo.overall,
      // Top 10 most-trafficked endpoints — enough for a status-page
      // summary without overwhelming dashboards.
      topEndpoints: slo.endpoints.slice(0, 10),
      generatedAt: new Date().toISOString(),
      meta: {
        source: "in-memory ring buffer (per-instance)",
        note: "Numbers reset on instance restart. Cross-instance aggregation is future work.",
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30",
      },
    },
  );
}
