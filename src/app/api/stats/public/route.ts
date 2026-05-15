/**
 * GET /api/stats/public — aggregate platform metrics.
 *
 * Powers /stats — a public-facing "block-explorer-style stats page"
 * for the platform as a whole. Compliance buyers check it during
 * procurement; prospects see proof of activity; journalists writing
 * about audit-grade AI have citeable numbers.
 *
 * Privacy: every metric is an aggregate count. No per-user, per-tenant,
 * or per-receipt data is exposed. The query never joins to users,
 * tenants, or anything PII-bearing — only counts on the agent_runs
 * table (+ public visibility filter where receipts are involved).
 *
 * Cache: edge-cached for 60 seconds + 5-minute stale-while-revalidate.
 * Compliance buyers don't need real-time; freshness within a minute
 * is plenty, and a 60s cache shields Neon from a sudden spike of
 * /stats refreshes if the page goes viral.
 *
 * Graceful empty: if the DB blips or the agent_runs table is empty
 * on a fresh deploy, returns zeros instead of 500.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { sql, eq } from "drizzle-orm";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  try {
    // Run the three counts in parallel — three independent SQL queries,
    // small enough that there's no JOIN overhead to consolidate.
    const [totalRow, publicRow, last24hRow] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(agentRuns),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(agentRuns)
        .where(eq(agentRuns.visibility, "public")),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(agentRuns)
        .where(sql`${agentRuns.createdAt} > now() - interval '24 hours'`),
    ]);

    const total = totalRow[0]?.count ?? 0;
    const publicCount = publicRow[0]?.count ?? 0;
    const last24h = last24hRow[0]?.count ?? 0;

    return NextResponse.json(
      {
        totals: {
          /** Lifetime count of agent runs with signed receipts. */
          signedReceipts: total,
          /** Subset marked public (enumerable by /explorer + /r/feed.xml). */
          publicReceipts: publicCount,
          /** Receipts signed in the last 24 hours. Liveness signal. */
          last24h,
        },
        computedAt: new Date().toISOString(),
      },
      { headers: CORS_HEADERS },
    );
  } catch {
    return NextResponse.json(
      {
        totals: { signedReceipts: 0, publicReceipts: 0, last24h: 0 },
        computedAt: new Date().toISOString(),
        reason: "unavailable",
      },
      { headers: CORS_HEADERS },
    );
  }
}
