/**
 * GET /api/transparency/witness/observations
 *
 * Witness federation primitive — the public, read-only registry of
 * every Signed Tree Head this issuer has accumulated cosignatures
 * against. Counterpart to /api/transparency/witness?sth=<>, which
 * returns cosignatures for a SPECIFIC STH.
 *
 * Why it matters: a peer monitor (independent witness, regulator,
 * auditor) can fetch this list, fan out to OTHER witness aggregators
 * running the same endpoint, and detect log equivocation — the
 * worst-case transparency-log failure where an issuer signs two
 * different rootHashes at the same treeSize. Cross-witness gossip
 * is what makes the trust model Byzantine-fault-tolerant rather
 * than "trust this one server".
 *
 * Authentication: anonymous. Open CORS. The whole point of the
 * federation primitive is that any independent party can pull the
 * full observation list.
 *
 * Cache: 30s CDN + 30s browser. STH set advances slowly; the short
 * TTL is the federation freshness window.
 *
 * Query params:
 *   ?limit=<n>  optional cap on number of observations returned
 *               (default 200, max 1000)
 */
import { NextResponse } from "next/server";
import { listObservations } from "@/lib/witness-store";
import { createLogger } from "@/lib/logger";

const log = createLogger("transparency-witness-observations");

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

export const revalidate = 30;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Cache-Control": "public, max-age=30, s-maxage=30",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders() });
}

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const raw = url.searchParams.get("limit");
    let limit = DEFAULT_LIMIT;
    if (raw !== null) {
      const parsed = Number.parseInt(raw, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = Math.min(parsed, MAX_LIMIT);
      }
    }

    const observations = listObservations(limit);
    const body = {
      // Schema version. Verifiers MUST tolerate additive fields.
      version: 1,
      generated_at: new Date().toISOString(),
      issuer:
        process.env.NEXT_PUBLIC_APP_URL ?? "https://sovereignmatrix.agency",
      observation_count: observations.length,
      limit,
      observations,
    };
    return NextResponse.json(body, { headers: corsHeaders() });
  } catch (err) {
    log.error("observations endpoint failed", { error: String(err) });
    return NextResponse.json(
      { error: "Unable to read witness observations" },
      { status: 500, headers: corsHeaders() },
    );
  }
}
