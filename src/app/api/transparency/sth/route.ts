/**
 * GET /api/transparency/sth
 *
 * Returns the current Signed Tree Head of the demo transparency log.
 * Pre-seeded from /sample-bundle.json so the response is non-empty and
 * deterministic per-deploy. The signature is Ed25519 (v2) when
 * AGENT_RUN_ED25519_PRIVATE_KEY is configured; otherwise the envelope
 * is returned unsigned (signature: null) so a verifier can still
 * inspect the tree head — they just can't verify provenance.
 *
 * Open CORS — anyone can `curl` this and feed it to an off-platform
 * verifier. That is the entire point of a transparency log.
 */
import { NextResponse } from "next/server";
import { getDemoTransparencyLog } from "@/lib/transparency-singleton";
import { canonicalizeSth } from "@sovereign-matrix/verifiable-receipts/transparency";
import { signRun } from "@/lib/agent-runs";
import { createLogger } from "@/lib/logger";

const log = createLogger("transparency-sth");

export const revalidate = 60; // 1-min CDN cache; STH only advances on append

export async function GET(): Promise<NextResponse> {
  try {
    const tlog = getDemoTransparencyLog();
    const sth = tlog.currentSth();
    const canonical = canonicalizeSth(sth);
    const signature = signRun(canonical);
    const body = {
      ...sth,
      signature: signature === "unsigned" ? null : signature,
      // Convenience for clients: the bytes the signature commits to.
      canonical,
    };
    return NextResponse.json(body, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    log.error("STH endpoint failed", { error: String(err) });
    return NextResponse.json(
      { error: "Unable to compute STH" },
      { status: 500 },
    );
  }
}
