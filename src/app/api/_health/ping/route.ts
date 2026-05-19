import { NextResponse } from "next/server";

/**
 * SOVEREIGN MATRIX — Uptime Ping Endpoint
 *
 * Ultra-lightweight health check for uptime monitoring services
 * (Better Stack, Uptime Robot, Pingdom, etc.)
 *
 * Returns 200 with response time if DB is reachable, 503 if not.
 * No auth required — this is a public health check.
 *
 * Monitor URL: https://sovereignmatrix.agency/api/health/ping
 *
 * Runtime: nodejs. Edge runtime broke the @neondatabase/serverless
 * cold-start handshake; the previous drizzle-executor variant failed
 * instantly because the orm wrapper's lazy schema load happens before
 * the connection check. Both issues vanish when we reuse the same
 * raw-sql code path that `/api/health` already uses — testConnection()
 * is a dynamic import so a broken DB module can't take down the route.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const start = Date.now();

  try {
    const { testConnection } = await import("@/db");
    const result = await testConnection();
    const latency = Date.now() - start;

    if (!result.connected) {
      return NextResponse.json(
        {
          status: "unhealthy",
          db: "disconnected",
          latency_ms: latency,
          timestamp: new Date().toISOString(),
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        status: "healthy",
        db: "connected",
        latency_ms: latency,
        timestamp: new Date().toISOString(),
        version: "2.1.0",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "X-Response-Time": `${latency}ms`,
        },
      },
    );
  } catch (err) {
    return NextResponse.json(
      {
        status: "unhealthy",
        db: "module-error",
        latency_ms: Date.now() - start,
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }
}
