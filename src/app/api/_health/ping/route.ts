import { NextResponse } from "next/server";

/**
 * SOVEREIGN MATRIX — Uptime Ping Endpoint
 *
 * Pure heartbeat. Returns 200 if the lambda is alive — no DB check, no
 * external-service check, no cold-start surface. This is the URL you
 * point Better Stack / Uptime Robot / Pingdom at: it answers "is the
 * site reachable" and nothing else.
 *
 * For diagnostic / per-service status, use /api/health (which reports
 * a graceful "degraded" status with a service-by-service breakdown
 * when downstream deps are sleeping or unreachable).
 *
 * This split follows the Kubernetes liveness/readiness distinction —
 * the ping = liveness (am I alive?), /api/health = readiness (can I
 * serve requests properly?). A liveness probe that fails on downstream
 * outage triggers an unnecessary restart loop.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const startedAt = Date.now();

export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime_ms: Date.now() - startedAt,
      version: "2.1.0",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}
