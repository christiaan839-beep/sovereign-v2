import { NextResponse } from "next/server";

/**
 * GET /.well-known/snapshot-signing
 *
 * Public discovery endpoint for our snapshot signing metadata.
 * Published so auditors can:
 *   1. Verify which key ID SHOULD be on current production snapshots
 *   2. See when we last rotated (a key rotation is a signal on its
 *      own — "we're actively maintaining the signing infrastructure")
 *   3. Know which endpoint to POST signed snapshots to for verification
 *
 * We do NOT publish the signing key itself — this is HMAC, not an
 * asymmetric scheme. Verification goes through /api/_replay/verify
 * which uses our key server-side. An auditor can't verify offline
 * today; v3 (future) adds ECDSA + JWKS for fully offline verification.
 *
 * Cache: 1 hour. Key rotation requires a deploy anyway, so the cache
 * TTL can be generous.
 */

export const revalidate = 3600;

export async function GET() {
  const currentKeyId =
    process.env.SNAPSHOT_SIGNING_KEY_ID ??
    (() => {
      const d = new Date();
      const q = Math.floor(d.getUTCMonth() / 3) + 1;
      return `smx-sig-${d.getUTCFullYear()}-q${q}`;
    })();

  const hasKey = Boolean(process.env.SNAPSHOT_SIGNING_KEY);

  return NextResponse.json(
    {
      spec: "sovereign-matrix-snapshot-v2",
      algorithm: "HMAC-SHA256",
      currentKeyId,
      signingEnabled: hasKey,
      verifyEndpoint: "https://sovereignmatrix.agency/api/_replay/verify",
      rotationPolicy: "quarterly (Q1/Q2/Q3/Q4 each calendar year)",
      rotationNotice:
        "Historical snapshots continue to verify after rotation via their embedded keyId. Contact security@sovereignmatrix.agency for offline verification of pre-rotation snapshots.",
      publishedAt: new Date().toISOString(),
      documentation: "https://sovereignmatrix.agency/trust/defenders",
      upgradePathToV3:
        "v3 (planned) will switch to ECDSA with a public key published here as JWKS, enabling fully offline verification without hitting our /api/_replay/verify endpoint.",
    },
    {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    },
  );
}
