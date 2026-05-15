/**
 * GET /api/agent-runs/[id]/proof — Merkle inclusion proof for one receipt.
 *
 * The "constant-cost" verification primitive. A consumer holding a
 * receipt + this proof + the signed chain root envelope can verify
 * inclusion in the issuer's signed audit chain in O(log N) hashes —
 * never needing to download the whole tenant's receipt history.
 *
 * Visibility gate matches the receipt itself: private receipts
 * require the owning user; public/unlisted receipts are accessible
 * cross-origin (open CORS).
 *
 * Response shape (mirrors VAOS extension proposal):
 *   {
 *     receipt:    { id, signature, agentName, modelUsed, ... },
 *     proof:      { leaf, index, leafCount, siblings[], expectedRoot },
 *     chainRoot:  { envelope, canonical, signature },
 *     spec:       { receiptFormat, verifyEndpoint }
 *   }
 *
 * Verifier algorithm (third party, no Sovereign trust required):
 *   1. Recompute leaf = sha256("LEAF\0" || receipt.id || "\0" || receipt.signature)
 *      and assert leaf === proof.leaf
 *   2. Walk proof.siblings from leaf to root, hashing
 *      sha256("NODE\0" || (left||right) per sibling.position)
 *      and assert recomputed root === proof.expectedRoot
 *   3. Assert proof.expectedRoot === chainRoot.envelope.root
 *   4. POST {chainRoot.canonical, chainRoot.signature} to /api/verify
 *      and assert valid:true
 *
 * If all four checks pass, the third party has cryptographic proof
 * that this specific receipt is part of Sovereign's signed audit
 * chain at attestation time.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { buildInclusionProof, buildSignedChainRoot } from "@/lib/receipt-chain";
import { getRun } from "@/lib/agent-runs";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/agent-runs/proof");

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

  // Fetch the target receipt — visibility gate identical to
  // /api/agent-runs/[id]. Private receipts only readable by their owner.
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

  // The proof is built over the OWNING tenant's full receipt set —
  // the same set the chain root is computed over. Without a userId
  // (anonymous demo receipt), there's no chain to anchor against.
  if (!run.userId) {
    return NextResponse.json(
      {
        error:
          "Receipt has no owning tenant; inclusion proof requires a chain anchor",
      },
      { status: 422, headers: CORS_HEADERS },
    );
  }

  let chainReceipts: Array<{
    id: string;
    signature: string;
    createdAt: Date | null;
  }> = [];
  try {
    chainReceipts = await db
      .select({
        id: agentRuns.id,
        signature: agentRuns.signature,
        createdAt: agentRuns.createdAt,
      })
      .from(agentRuns)
      .where(eq(agentRuns.userId, run.userId))
      .orderBy(asc(agentRuns.createdAt));
  } catch (err) {
    log.warn("proof: chain fetch failed", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Chain fetch failed" },
      { status: 503, headers: CORS_HEADERS },
    );
  }

  const chainInput = chainReceipts.map((r) => ({
    id: r.id,
    signature: r.signature,
    createdAt: r.createdAt ?? new Date(0),
  }));

  const proof = buildInclusionProof(chainInput, id);
  if (!proof) {
    // Shouldn't happen — getRun returned a row, the chain query covers
    // the same userId. But guard anyway.
    return NextResponse.json(
      { error: "Receipt not found in tenant chain" },
      { status: 422, headers: CORS_HEADERS },
    );
  }

  const chainRoot = buildSignedChainRoot(chainInput);

  return NextResponse.json(
    {
      receipt: {
        id: run.id,
        agentName: run.agentName,
        modelUsed: run.modelUsed,
        signature: run.signature,
        createdAt: run.createdAt,
      },
      proof,
      chainRoot,
      spec: {
        receiptFormat: "VAOS 1.0",
        proofAlgorithm: "MerkleSHA256-Sovereign-1",
        verifyEndpoint:
          (process.env.NEXT_PUBLIC_APP_URL ??
            "https://sovereignmatrix.agency") + "/api/verify",
      },
    },
    { headers: CORS_HEADERS },
  );
}
