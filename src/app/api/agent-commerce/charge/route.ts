/**
 * POST /api/agent-commerce/charge
 *   Agent attempts a charge against an authorization.
 *
 * Auth: requireMutatingAuth — agents authenticate via the same Clerk
 * session as their owner, OR via a scoped API key (the API gateway
 * pattern at /api/v1/* — this route is the user-side equivalent).
 *
 * Idempotency: (authorizationId, idempotencyKey) is unique. A
 * retried POST with the same key returns the original receipt
 * — never double-charges.
 *
 * Returns 200 + receipt on success; 4xx with a structured reason
 * code on rejection. The receipt is the PROOF of the charge —
 * customers can verify it offline using verifyReceiptChain().
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMutatingAuth } from "@/lib/auth-guard";
import { attemptCharge } from "@/lib/agent-spend";
import { createLogger } from "@/lib/logger";

const log = createLogger("agent-commerce-charge");

export const runtime = "nodejs";

const ChargeSchema = z.object({
  authorizationId: z.string().uuid(),
  agentName: z.string().min(1).max(200),
  idempotencyKey: z.string().min(8).max(200),
  amountCents: z.number().int().min(1).max(10_000_000), // $100K hard ceiling per charge
  merchantName: z.string().min(1).max(200),
  merchantCategory: z.string().min(1).max(100),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ERROR_STATUS_CODES: Record<string, number> = {
  authorization_not_found: 404,
  authorization_revoked: 403,
  authorization_expired: 403,
  agent_mismatch: 403,
  merchant_not_allowed: 403,
  category_limit_exceeded: 402,
  amount_exceeds_remaining: 402,
  hitl_required: 202, // Accepted-pending-approval; agent should poll/await
  amount_invalid: 400,
  duplicate_idempotency_key_different_args: 409,
  db_unavailable: 503,
};

export async function POST(req: Request) {
  const auth = await requireMutatingAuth(req);
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ChargeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const result = await attemptCharge(parsed.data);

  if (!result.ok) {
    log.info("charge rejected", {
      userId: auth.userId,
      reason: result.reason,
      authorizationId: parsed.data.authorizationId,
    });
    return NextResponse.json(
      { error: result.message, code: result.reason },
      { status: ERROR_STATUS_CODES[result.reason] ?? 400 },
    );
  }

  return NextResponse.json({
    chargeId: result.chargeId,
    receiptHash: result.receiptHash,
    reversalWindowUntil: result.reversalWindowUntil.toISOString(),
    remainingCents: result.remainingCents,
    status: result.status,
  });
}
