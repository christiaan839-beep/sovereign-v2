/**
 * GET /.well-known/sovereign-receipts/issuers.json
 *
 * Machine-readable registry of known VAOS issuers + their pubkey
 * URLs. The "CA root store for AI agent receipts". Open CORS so
 * any verifier (browser, CI pipeline, regulator automation) can
 * fetch the list and pin trust.
 *
 * Schema documented at src/lib/vaos-issuers.ts. New issuers added
 * via PR to that file.
 */
import { NextResponse } from "next/server";
import { getIssuerRegistry } from "@/lib/vaos-issuers";

// 5-minute cache — issuer additions are rare; the cache aligns with
// the security-posture endpoint TTL.
export const revalidate = 300;

export async function GET() {
  const registry = getIssuerRegistry();
  return NextResponse.json(registry, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
