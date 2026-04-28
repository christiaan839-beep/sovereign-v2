/**
 * GET /api/agent-commerce/verify/[authorizationId]
 *   Verify the receipt-hash chain for an authorization's charges.
 *
 * Public endpoint — no auth required because the chain is meant to
 * be customer-verifiable. The authorization ID itself is the
 * capability; without it, you can't query.
 *
 * Returns the chain status: ok with chargeCount, or broken with
 * the row at which the chain broke + expected vs found hash.
 *
 * Use case: a customer dispute. Customer can hit this endpoint and
 * see "yes the chain is intact" or "no the platform tampered with
 * past charges". Hash-chain integrity is the SOC-2-grade trust
 * artifact.
 */

import { NextResponse } from "next/server";
import { verifyReceiptChain } from "@/lib/agent-spend";

export const runtime = "nodejs";
// Cache for 30s — chain integrity doesn't change minute-to-minute.
export const revalidate = 30;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ authorizationId: string }> },
) {
  const { authorizationId } = await params;
  if (!authorizationId || authorizationId.length > 100) {
    return NextResponse.json({ error: "Invalid authorization id" }, { status: 400 });
  }
  const result = await verifyReceiptChain(authorizationId);
  if (result.ok) {
    return NextResponse.json({
      chainIntact: true,
      chargeCount: result.chargeCount,
      verifiedAt: new Date().toISOString(),
    });
  }
  return NextResponse.json(
    {
      chainIntact: false,
      brokenAt: result.brokenAt,
      expected: result.expected,
      found: result.found,
      verifiedAt: new Date().toISOString(),
    },
    { status: 200 }, // Status 200 — the verification ran; the answer is "broken"
  );
}
