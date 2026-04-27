/**
 * CREDITS API — GET /api/credits  |  POST /api/credits/add
 *
 * GET  → returns current balance + recent transaction history
 * POST → add credits (purchase, bonus, referral)
 *
 * A2E hires happen internally via src/lib/a2e.ts — not through this endpoint.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { requireAdmin } from "@/lib/admin-auth";
import { getCreditBalance, addCredits, getCreditHistory } from "@/lib/a2e";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const log = createLogger("credits-api");

// ── GET /api/credits ──────────────────────────────────────────────────────

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId || "";

  try {
    const [balance, history] = await Promise.all([
      getCreditBalance(userId),
      getCreditHistory(userId, 30),
    ]);

    return NextResponse.json({
      balance: balance.balanceCents,
      lifetimeEarned: balance.lifetimeEarned,
      lifetimeSpent: balance.lifetimeSpent,
      displayBalance: `$${(balance.balanceCents / 100).toFixed(2)}`,
      transactions: history,
    });
  } catch (err) {
    log.error("GET /api/credits failed", err as Record<string, unknown>);
    return NextResponse.json({ error: "Failed to fetch credits" }, { status: 500 });
  }
}

// ── POST /api/credits ─────────────────────────────────────────────────────
//
// SECURITY MODEL
// ──────────────
// Credit grants are money — every path here must prove the user is
// either (a) admin-authorized OR (b) backed by a verified payment.
//
//   type: "bonus"   → ADMIN-ONLY. requireAdmin() gates the call. The
//                     `targetUserId` field lets ops grant a bonus to
//                     someone OTHER than the admin themselves (defaults
//                     to the admin if omitted, e.g. for testing).
//   type: "referral"→ ADMIN-ONLY for the same reason — referral credit
//                     grants are a finance event, not user-initiated.
//                     A future referral-system rewrite would call
//                     addCredits() directly from a server-side handler
//                     after verifying the referral; we deliberately
//                     don't expose self-service here.
//   type: "purchase"→ NOT IMPLEMENTED. Returns 501 until the Stripe
//                     webhook integration verifies a real PaymentIntent.
//                     Letting clients self-service "purchase" without a
//                     Stripe verification is a free-money exploit.
//
// Every successful grant emits an audit_log row (`subscription.change`)
// so the SOC-2 hash chain captures who granted what to whom.

const ADD_SCHEMA = z.object({
  amountCents: z.number().int().min(1).max(100_000),
  type: z.enum(["purchase", "bonus", "referral"]),
  description: z.string().max(200).optional(),
  targetUserId: z.string().min(1).max(200).optional(),
  // In production: purchaseToken or Stripe payment intent ID goes here
});

export async function POST(req: Request) {
  // First gate: caller must be authenticated. We pull userId for the
  // "purchase" branch + as the audit-log actor.
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const callerUserId = auth.userId || "";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = ADD_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { amountCents, type, description, targetUserId } = parsed.data;

  // Purchase path: not implemented until Stripe verification is wired.
  // 501 (instead of silently calling addCredits) closes the exploit
  // immediately — a future commit replaces this with a real Stripe
  // PaymentIntent check + idempotency-by-PI-id.
  if (type === "purchase") {
    log.warn("POST /api/credits — purchase path not implemented", {
      callerUserId,
      amountCents,
    });
    return NextResponse.json(
      {
        error:
          "Self-service purchase grants are not implemented. Use the Stripe-backed checkout flow instead.",
        code: "purchase_not_implemented",
      },
      { status: 501 },
    );
  }

  // Bonus + referral: admin-only. requireAdmin returns either the admin
  // context or a Response (401/404). We keep the 404 path opaque so
  // non-admins can't probe the endpoint to enumerate users.
  const adminGate = await requireAdmin();
  if (adminGate instanceof Response) return adminGate;

  try {
    // Default target = the admin themselves (covers the common ops
    // case of self-granting test credits). Otherwise the admin can
    // grant to any userId.
    const recipientUserId = targetUserId ?? callerUserId;

    const balance = await addCredits(
      recipientUserId,
      amountCents,
      type,
      description ?? `${type} credits`,
    );

    // Audit-log the grant. Goes through the SHA-256 hash chain so
    // tampering is detectable.
    await auditLog({
      userId: callerUserId,
      action: "subscription.change",
      resource: "credits",
      details: {
        kind: "admin_grant",
        type,
        amountCents,
        recipientUserId,
        description: description ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      newBalance: balance.balanceCents,
      displayBalance: `$${(balance.balanceCents / 100).toFixed(2)}`,
      added: amountCents,
      recipient: recipientUserId,
    });
  } catch (err) {
    log.error("POST /api/credits failed", err as Record<string, unknown>);
    return NextResponse.json({ error: "Failed to add credits" }, { status: 500 });
  }
}
