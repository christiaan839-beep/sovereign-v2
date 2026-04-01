import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

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
 */
export const runtime = "edge";

export async function GET() {
  const start = Date.now();

  try {
    await db.execute(sql`SELECT 1`);
    const latency = Date.now() - start;

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
      }
    );
  } catch {
    return NextResponse.json(
      {
        status: "unhealthy",
        db: "disconnected",
        latency_ms: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
