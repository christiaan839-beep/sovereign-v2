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
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getRun, canonicalizeRun } from "@/lib/agent-runs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id || !/^[0-9a-f-]{32,40}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const run = await getRun(id);
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (run.visibility === "private") {
    const { userId } = await auth();
    if (!userId || userId !== run.userId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  // Re-derive canonical projection so callers can verify the signature
  // without needing to know the field order. They can:
  //   1. Receive {canonical, signature, secret_hint} from this endpoint
  //   2. Compute hmac_sha256(canonical, secret) on their side
  //   3. Compare to signature
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

  return NextResponse.json({
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
  });
}
