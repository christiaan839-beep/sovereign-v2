import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { createLogger } from "@/lib/logger";

const log = createLogger("database");

// Required for Edge Environments (Vercel)
// During Vercel's static build phase, env vars may be undefined.
const connectionString = process.env.DATABASE_URL;

if (!connectionString && typeof window === "undefined" && process.env.NODE_ENV === "production") {
  log.error("DATABASE_URL is not configured. Database operations will fail.");
}

// Neon free tier auto-pauses after 5 min of inactivity.
// First connection after pause takes 3-5s ("cold start").
// fetchOptions.cache: "no-store" prevents stale connection reuse.
const sql: NeonQueryFunction<boolean, boolean> = neon(connectionString || "postgresql://build:placeholder@localhost/build", {
  fetchOptions: { cache: "no-store" },
});

export const db = drizzle(sql, { schema });

/**
 * Test database connectivity with a simple query.
 * Returns true if connected, false if not.
 * Handles Neon cold starts gracefully.
 */
export async function testConnection(): Promise<{ connected: boolean; latencyMs: number }> {
  const t0 = performance.now();
  try {
    await sql`SELECT 1`;
    return { connected: true, latencyMs: Math.round(performance.now() - t0) };
  } catch (err) {
    log.error("Database connection test failed", { error: (err as Error).message });
    return { connected: false, latencyMs: Math.round(performance.now() - t0) };
  }
}
