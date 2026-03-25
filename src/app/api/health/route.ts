import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * HEALTH CHECK — /api/health
 * Returns system health status with database connectivity check.
 */
export async function GET() {
  const services: Record<string, string> = {};

  // Database check
  try {
    await db.execute(sql`SELECT 1`);
    services.db = "ok";
  } catch {
    services.db = "error";
  }

  // NIM check (key presence only — no live call for speed)
  services.nim = process.env.NVIDIA_NIM_API_KEY ? "ok" : "unconfigured";

  const allOk = Object.values(services).every((s) => s === "ok" || s === "unconfigured");

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      services,
    },
    { status: allOk ? 200 : 503 }
  );
}
