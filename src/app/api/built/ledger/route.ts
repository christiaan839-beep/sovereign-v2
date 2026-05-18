/**
 * SOVEREIGN MATRIX — /api/built/ledger (Wave 14).
 *
 * Machine-readable view of the cryptographically-anchored shipped
 * ledger. Returns the same `MilestoneAttestation[]` the /built page
 * renders, plus the rolling SHA-256 digest that binds every entry.
 *
 * Verifiers should:
 *   1. Fetch this endpoint.
 *   2. For each entry: re-hash `canonical` → compare to `contentHash`.
 *   3. Confirm `signature` validates over `canonical` using the
 *      public Ed25519 key at /.well-known/sovereign-receipts/ed25519.pem.
 *   4. Re-derive the rolling digest by hashing every `canonical` joined
 *      by newlines; compare to the `digest` field on this payload.
 *
 * No auth required. Read-only. The ledger is append-only on the
 * server side so a 60-second cache is correct.
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getSignedLedger } from "@/lib/built-ledger";

const limiter = rateLimit({ interval: 60, limit: 60 });

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const ledger = getSignedLedger();
  return NextResponse.json(ledger, {
    status: 200,
    headers: {
      // Append-only structure — short cache is correct. Builds revalidate
      // every hour anyway, and individual milestone signatures never
      // change once written.
      "cache-control": "public, max-age=60, s-maxage=300",
    },
  });
}
