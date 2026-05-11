/**
 * GET /api/agent-runs/latest-public
 *
 * Public, no-auth endpoint that returns the most recent receipt with
 * visibility ∈ {public, unlisted}. Used by the landing-page LIVE
 * VERIFIER DEMO — the visitor doesn't have a receipt id of their own,
 * so we hand them the freshest real one and let them watch it verify.
 *
 * Returns null `receipt` (not 404) if the platform has no public
 * receipts yet — the widget renders an "agent hasn't run yet"
 * empty state instead of looking broken.
 *
 * Open CORS so any auditor / docs page on any domain can demo the
 * verifier from the same endpoint. No PII leaks: only public/unlisted
 * receipts are returned, and only the fields needed for verification
 * (id, canonical, signature) are echoed.
 */
import { NextResponse } from "next/server";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { canonicalizeRun, getRun } from "@/lib/agent-runs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  try {
    // SECURITY: only `public` is enumerable. `unlisted` means
    // share-by-link — exposing it here violates the user's
    // intent (they marked it not-discoverable).
    const rows = await db
      .select({ id: agentRuns.id })
      .from(agentRuns)
      .where(eq(agentRuns.visibility, "public"))
      .orderBy(desc(agentRuns.createdAt))
      .limit(1);

    const id = rows[0]?.id;
    if (!id) {
      return NextResponse.json(
        { receipt: null, reason: "no-public-receipts-yet" },
        { headers: CORS_HEADERS },
      );
    }

    const run = await getRun(id);
    if (!run) {
      return NextResponse.json(
        { receipt: null, reason: "race-deleted" },
        { headers: CORS_HEADERS },
      );
    }

    return NextResponse.json(
      {
        receipt: {
          id: run.id,
          agent: run.agentName,
          createdAt: run.createdAt,
          canonical: canonicalizeRun(run),
          signature: run.signature,
        },
      },
      { headers: CORS_HEADERS },
    );
  } catch {
    // Same "graceful empty" semantics on DB failure — the landing page
    // must never crash because the receipt table isn't reachable.
    return NextResponse.json(
      { receipt: null, reason: "unavailable" },
      { headers: CORS_HEADERS },
    );
  }
}
