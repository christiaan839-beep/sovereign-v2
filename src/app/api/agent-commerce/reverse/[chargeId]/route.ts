/**
 * POST /api/agent-commerce/reverse/[chargeId]
 *   Reverse a completed charge within its reversal window.
 *
 * Either the user OR an admin operator can trigger a reversal.
 * Beyond the window, the normal dispute process applies (out of
 * scope for this endpoint).
 *
 * Body: { reason: string }
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMutatingAuth } from "@/lib/auth-guard";
import { reverseCharge } from "@/lib/agent-spend";
import { createLogger } from "@/lib/logger";

const log = createLogger("agent-commerce-reverse");

export const runtime = "nodejs";

const ReverseSchema = z.object({
  reason: z.string().min(1).max(500),
});

const ERROR_STATUS: Record<string, number> = {
  not_found: 404,
  already_reversed: 409,
  outside_window: 410, // Gone — the window closed
  db_unavailable: 503,
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ chargeId: string }> },
) {
  const auth = await requireMutatingAuth(req);
  if (auth.error) return auth.error;
  const { chargeId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = ReverseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Reason required" }, { status: 400 });
  }

  const result = await reverseCharge({
    chargeId,
    reason: parsed.data.reason,
    actor: auth.userId,
  });

  if (!result.ok) {
    log.info("reverse rejected", { userId: auth.userId, chargeId, reason: result.reason });
    return NextResponse.json(
      { error: result.message, code: result.reason },
      { status: ERROR_STATUS[result.reason] ?? 400 },
    );
  }

  return NextResponse.json({
    reversed: true,
    reversedAt: result.reversedAt.toISOString(),
  });
}
