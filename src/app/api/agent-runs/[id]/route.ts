/**
 * GET /api/agent-runs/[id] — fetch a verifiable agent run receipt.
 *
 * Visibility rules:
 *   - public  → anyone can fetch (the /r/[id] receipt URL hits this)
 *   - unlisted → anyone with the URL can fetch (same as public — separate
 *                tier kept for future search-engine deindex semantics)
 *   - private → only the owning userId can fetch (Clerk auth required)
 *
 * Response includes the signature so a third party can re-derive the
 * canonical projection client-side and verify against this server.
 *
 * Open CORS so the /embed/verify.js badge running on customer sites
 * can fetch and validate receipts. Visibility gate stays enforced —
 * private receipts still 404 from cross-origin requests.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getRun, canonicalizeRun } from "@/lib/agent-runs";

// Open CORS — the embed badge + cross-origin auditors call this from
// any origin. Visibility gate stays enforced via run.visibility, so
// private receipts still 404 cross-origin.
//
// SECURITY TRIPWIRE: do NOT add `Access-Control-Allow-Credentials: true`.
// Cookies must NEVER flow through this endpoint cross-origin — Clerk's
// session cookie would otherwise leak the authenticated owner's identity.
// Browsers reject credentialed requests when origin is `*`, but a future
// reviewer might "fix" that by hard-coding an origin and adding
// Allow-Credentials. Don't.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{32,40}$/i.test(id)) {
    return NextResponse.json(
      { error: "Invalid id" },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const run = await getRun(id);
  if (!run) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  if (run.visibility === "private") {
    const { userId } = await auth();
    if (!userId || userId !== run.userId) {
      return NextResponse.json(
        { error: "Not found" },
        { status: 404, headers: CORS_HEADERS },
      );
    }
  }

  // Re-derive canonical projection so callers can verify the signature
  // without needing to know the field order. They can:
  //   1. Receive {canonical, signature} from this endpoint
  //   2. POST them to /api/verify
  //   3. Get back { valid: true|false }
  // (The secret never leaves the server. We only expose canonical+sig.)
  const canonical = canonicalizeRun({
    id: run.id,
    agentName: run.agentName,
    modelUsed: run.modelUsed,
    input: run.input,
    output: run.output,
    safetyResult: run.safetyResult,
    durationMs: run.durationMs,
    createdAt: run.createdAt,
  });

  return NextResponse.json(
    {
      id: run.id,
      agentName: run.agentName,
      modelUsed: run.modelUsed,
      input: run.input,
      output: run.output,
      safetyResult: run.safetyResult,
      durationMs: run.durationMs,
      chainDepth: run.chainDepth,
      trustDecision: run.trustDecision,
      visibility: run.visibility,
      signature: run.signature,
      canonical,
      createdAt: run.createdAt,
    },
    { headers: CORS_HEADERS },
  );
}
