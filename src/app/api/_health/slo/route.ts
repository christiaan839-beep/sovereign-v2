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
import { getPlatformSlo, getPlatformSloFromDb } from "@/lib/slo-tracker";

export const runtime = "nodejs";
// This endpoint is deliberately cacheable for 30s — SLO numbers don't
// need real-time precision, and caching prevents polling from skewing
// the latency numbers themselves.
export const revalidate = 30;

/**
 * Cross-instance read path:
 *   1. Try Postgres aggregation (slo_events table). Consistent across
 *      every Vercel lambda + survives cold starts. Source of truth in
 *      production.
 *   2. Fall back to per-instance in-memory ring buffer when the DB is
 *      unavailable (DATABASE_URL unset, query failed). The status page
 *      MUST NOT break — accurate-but-divergent in-memory numbers beat
 *      a 500.
 *
 * The `meta.source` field tells the client which path served the
 * response so monitoring can detect persistent DB-fallback states.
 */
export async function GET(): Promise<NextResponse> {
  const dbSlo = await getPlatformSloFromDb({ windowMs: 24 * 60 * 60 * 1000 });
  const slo = dbSlo ?? getPlatformSlo({ windowMs: 24 * 60 * 60 * 1000 });
  const source = dbSlo
    ? "postgres slo_events (cross-instance)"
    : "in-memory ring buffer (per-instance fallback — DATABASE_URL unset or query failed)";

  return NextResponse.json(
    {
      platform: slo.overall,
      // Top 10 most-trafficked endpoints — enough for a status-page
      // summary without overwhelming dashboards.
      topEndpoints: slo.endpoints.slice(0, 10),
      generatedAt: new Date().toISOString(),
      meta: {
        source,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30",
      },
    },
  );
}
