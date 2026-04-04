import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { createLogger } from "@/lib/logger";

const log = createLogger("database");

/**
 * SOVEREIGN MATRIX — Database Connection
 *
 * Uses Neon HTTP driver for maximum compatibility across all Vercel
 * environments (Edge, Serverless, Static). The HTTP driver makes one
 * HTTPS request per query — no persistent connections needed.
 *
 * Performance characteristics:
 *   - First query after cold start: ~100-200ms (TLS handshake + Neon wake)
 *   - Subsequent queries: ~8-15ms (connection reuse within the same invocation)
 *   - Neon free tier auto-pauses after 5 min idle → 3-5s cold start
 *
 * The `cache: "no-store"` prevents Vercel's edge cache from serving
 * stale query results — critical for real-time data like usage counts.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString && typeof window === "undefined" && process.env.NODE_ENV === "production") {
  log.error("DATABASE_URL is not configured. Database operations will fail.");
}

const sql: NeonQueryFunction<boolean, boolean> = neon(connectionString || "postgresql://user:pass@localhost/sovereign", {
  fetchOptions: { cache: "no-store" },
});

/**
 * ─── Connection Pooling Notes (for scale beyond 10K+ DAU) ───
 *
 * The neon-http driver used here is already connection-pool safe: each query
 * is a stateless HTTPS request with no persistent connection held open.
 * This means there is no risk of connection exhaustion on serverless
 * (Vercel Edge / Lambda) regardless of concurrency.
 *
 * When scaling to 10K+ daily active users, consider:
 *
 *   1. Switch to Neon's pooled connection string (port 6543 instead of 5432).
 *      This routes through PgBouncer on Neon's side, which helps if you ever
 *      migrate to the WebSocket driver (@neondatabase/serverless ws) for
 *      transactions or session-level features.
 *
 *   2. Upgrade to Neon Pro for always-on compute. The free tier auto-suspends
 *      after 5 minutes of inactivity, causing 3-5 second cold starts. Pro
 *      keeps the compute endpoint warm and adds autoscaling replicas.
 *
 *   3. No changes needed for the HTTP driver itself — it is inherently
 *      pool-safe because it opens no persistent connections. Each query
 *      is an independent HTTPS request routed through Neon's proxy.
 */
export const db = drizzle(sql, { schema });

/** Test DB connectivity. Handles Neon cold starts (3-5s). */
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
