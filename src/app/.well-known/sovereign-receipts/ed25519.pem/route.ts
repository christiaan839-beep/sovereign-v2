/**
 * GET /.well-known/sovereign-receipts/ed25519.pem
 *
 * Public Ed25519 verification key for VAOS 2.0 signatures.
 * Open CORS — any third-party verifier can fetch this without
 * authenticating, recompute the canonical projection of a receipt,
 * and confirm the signature locally.
 *
 * If the issuer has not configured AGENT_RUN_ED25519_PRIVATE_KEY,
 * this endpoint returns 404 — there is no v2 key to advertise yet,
 * and v1 (HMAC) receipts are verified via /api/verify rather than
 * by client-side key check.
 */
import { NextResponse } from "next/server";
import { getEd25519PublicKeyPem } from "@/lib/agent-runs";

export async function GET() {
  const pem = getEd25519PublicKeyPem();
  if (!pem) {
    return new NextResponse(
      "No VAOS 2.0 (Ed25519) signing key configured for this deployment. Receipts signed under VAOS 1.0 (HMAC-SHA256) — use POST /api/verify to confirm.",
      {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "public, max-age=60",
        },
      },
    );
  }
  return new NextResponse(pem, {
    status: 200,
    headers: {
      "Content-Type": "application/x-pem-file; charset=utf-8",
      // 5-min cache to let key rotations propagate within a deploy
      // cycle. The key itself is durable; the short TTL is just a
      // safety valve for emergency rotation.
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
