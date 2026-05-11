/**
 * GET /api/agent-runs/recent-public[?limit=30]
 *
 * Public, no-auth endpoint returning a feed of the most recent
 * public receipts. Powers /explorer — a Bitcoin-block-explorer-style
 * live stream of platform activity.
 *
 * Security:
 *   - ONLY visibility = "public" is enumerated. "unlisted" stays
 *     share-by-link.
 *   - Returns only the fields needed to render the feed row
 *     (id, agentName, modelUsed, createdAt, durationMs, signatureSha)
 *     — never the input/output payloads or full signature. Visitors
 *     wanting the full receipt click through to /r/[id].
 *   - signatureSha is a SHA-256-derived fingerprint of the receipt's
 *     own HMAC signature (first 8 hex chars). Useful for spotting
 *     duplicate-displayed rows in the UI without leaking the
 *     signature itself.
 *   - Open CORS (same contract as /api/agent-runs/[id]) so any
 *     dashboard or audit doc can render the feed from any origin.
 *   - 15-second edge cache + stale-while-revalidate keeps the feed
 *     fresh without hammering Postgres.
 *
 * Rate limit:
 *   60 req/min/IP via the shared limiter. Trivially over-rideable by
 *   the edge cache but the limiter exists for cache-bypass cases.
 *
 * Query params:
 *   limit — 1..50, default 30. Hard-capped at 50 to keep the SQL
 *   bounded.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { createHash } from "crypto";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
};

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 30;

const limiter = rateLimit({ interval: 60, limit: 60 });

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const url = new URL(req.url);
  const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), MAX_LIMIT)
    : DEFAULT_LIMIT;

  try {
    const rows = await db
      .select({
        id: agentRuns.id,
        agentName: agentRuns.agentName,
        modelUsed: agentRuns.modelUsed,
        durationMs: agentRuns.durationMs,
        signature: agentRuns.signature,
        createdAt: agentRuns.createdAt,
      })
      .from(agentRuns)
      .where(eq(agentRuns.visibility, "public"))
      .orderBy(desc(agentRuns.createdAt))
      .limit(limit);

    const receipts = rows.map((r) => ({
      id: r.id,
      agentName: r.agentName,
      modelUsed: r.modelUsed,
      durationMs: r.durationMs,
      // Fingerprint, not the actual signature. Lets the UI spot
      // duplicate rows in a live-update without exposing the secret-
      // backed HMAC that callers should fetch from /r/[id].
      signatureSha: createHash("sha256")
        .update(r.signature ?? "")
        .digest("hex")
        .slice(0, 12),
      createdAt:
        r.createdAt instanceof Date
          ? r.createdAt.toISOString()
          : (r.createdAt as unknown as string),
    }));

    return NextResponse.json(
      {
        count: receipts.length,
        receipts,
      },
      { headers: CORS_HEADERS },
    );
  } catch {
    // Same "graceful empty" semantics as /latest-public — the
    // /explorer page must never crash because the table is missing
    // or DB is unreachable.
    return NextResponse.json(
      { count: 0, receipts: [], reason: "unavailable" },
      { headers: CORS_HEADERS },
    );
  }
}
