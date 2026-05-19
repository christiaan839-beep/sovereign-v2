/**
 * GET /api/transparency/threshold-status
 *
 * Public, open-CORS, machine-readable threshold-signing status.
 *
 * What this endpoint is for:
 *   - Auditors and witnesses query it to discover the active TRS
 *     issuer registry + quorum threshold m-of-n.
 *   - Compliance automation pulls it to fill out vendor-questionnaire
 *     fields like "do you use threshold cryptography for receipt
 *     signing?" with a deterministic JSON answer.
 *   - Federation members verify the deploy's view of the witness set
 *     matches their own — divergence indicates split-brain that
 *     would break verification on receipts signed during the split.
 *
 * What this endpoint does NOT reveal:
 *   - Which specific issuers this server holds local signing keys
 *     for. That information would tell an attacker the smallest set
 *     of servers to compromise to forge a quorum.
 *
 * Cache: 5 minutes — the issuer registry rotates on the order of
 * weeks, not seconds. A reverse-proxy cache absorbs vendor-
 * questionnaire fan-out without hitting the runtime each time.
 */

import { NextResponse } from "next/server";
import { thresholdStatus } from "@/lib/threshold-signer";

export const revalidate = 300;

export async function GET() {
  const s = thresholdStatus();
  const body = {
    generatedAt: new Date().toISOString(),
    scheme: "trs1",
    specCitation:
      "@sovereign-matrix/verifiable-receipts/threshold (Apache-2.0)",
    enabled: s.enabled,
    quorum: {
      m: s.m,
      n: s.n,
    },
    // The full ordered set of authorised issuers. Verifiers MUST only
    // accept cosignatures from these ids. Publishing them is safe —
    // each public key lives at /.well-known/sovereign-receipts/issuers/<id>.pem
    // (operator-published, not derived here).
    authorizedIssuers: s.authorizedIssuers,
    notes: {
      compromiseModel:
        "An attacker who compromises fewer than (n - m + 1) authorised " +
        "issuers cannot forge a threshold-signed receipt. With n=" +
        s.n +
        " and m=" +
        s.m +
        ", at least " +
        Math.max(0, s.m) +
        " of the " +
        s.n +
        " distinct issuer keys must be controlled to forge.",
      witnessFederation:
        "Each issuer signs the binding bytes from " +
        "trsSigningBytes(canonical, {m,n}, authorizedIssuers). " +
        "The binding prevents reuse of a non-TRS signature as a TRS cosignature.",
    },
  };

  return NextResponse.json(body, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
