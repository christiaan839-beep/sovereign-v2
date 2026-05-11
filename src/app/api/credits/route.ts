/**
 * CREDITS API — GET /api/credits  |  POST /api/credits
 *
 * GET  → returns current balance + recent transaction history
 * POST → add credits (purchase verified via Stripe / admin-only bonus & referral)
 *
 * A2E hires happen internally via src/lib/a2e.ts — not through this endpoint.
 *
 * SECURITY: Purchase credits require a Stripe PaymentIntent ID. The intent
 * must be `succeeded`, owned by the caller (metadata.userId), and have an
 * amount that matches the requested credit amount. Each intent can only be
 * consumed once (idempotency). Bonus and referral grants require admin role.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getCreditBalance, addCredits, getCreditHistory } from "@/lib/a2e";
import { getStripe } from "@/lib/stripe";
import { isAdmin } from "@/lib/admin-auth";
import { alreadyProcessed } from "@/lib/idempotency";
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
    return NextResponse.json(
      { error: "Failed to fetch credits" },
      { status: 500 },
    );
  }
}

// ── POST /api/credits ─────────────────────────────────────────────────────

const ADD_SCHEMA = z.object({
  amountCents: z.number().int().min(1).max(100_000),
  type: z.enum(["purchase", "bonus", "referral"]),
  description: z.string().max(200).optional(),
  /** Required for `type: "purchase"` — the Stripe PaymentIntent that paid for these credits. */
  paymentIntentId: z.string().startsWith("pi_").optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId || "";

  try {
    const body = await req.json();
    const parsed = ADD_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { amountCents, type, description, paymentIntentId } = parsed.data;

    if (type === "purchase") {
      if (!paymentIntentId) {
        return NextResponse.json(
          { error: "paymentIntentId is required for purchase credits" },
          { status: 400 },
        );
      }

      const stripe = getStripe();
      if (!stripe) {
        log.error("Purchase blocked: Stripe is not configured");
        return NextResponse.json(
          { error: "Billing is not configured" },
          { status: 503 },
        );
      }

      // Replay protection — each PaymentIntent can only be consumed once.
      // Idempotency check happens BEFORE the Stripe API call so a successful
      // first redemption can't be replayed even if the PI is still queryable.
      if (await alreadyProcessed("credits:payment_intent", paymentIntentId)) {
        log.warn("Payment intent already redeemed", {
          userId,
          paymentIntentId,
        });
        return NextResponse.json(
          { error: "This payment has already been credited" },
          { status: 409 },
        );
      }

      let intent;
      try {
        intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      } catch (err) {
        log.warn("Payment intent retrieval failed", {
          userId,
          paymentIntentId,
          error: String(err),
        });
        return NextResponse.json(
          { error: "Invalid payment intent" },
          { status: 400 },
        );
      }

      // Reject any non-USD intent — credits are denominated in cents of USD.
      // Without this check a 5000 JPY (~$32) payment would mint $50 of credits.
      const expectedCurrency = "usd";
      if (
        typeof intent.currency === "string" &&
        intent.currency.toLowerCase() !== expectedCurrency
      ) {
        log.error("Payment intent currency mismatch", {
          userId,
          paymentIntentId,
          currency: intent.currency,
        });
        return NextResponse.json(
          { error: "Payment currency does not match credit denomination" },
          { status: 400 },
        );
      }

      if (intent.status !== "succeeded") {
        log.warn("Payment intent not succeeded", {
          userId,
          paymentIntentId,
          status: intent.status,
        });
        return NextResponse.json(
          { error: `Payment is not complete (status: ${intent.status})` },
          { status: 402 },
        );
      }

      // Bind the intent to the caller — prevents one user from redeeming
      // another user's PaymentIntent.
      const intentUserId = (intent.metadata && intent.metadata.userId) || null;
      if (intentUserId !== userId) {
        log.error("Payment intent userId mismatch", {
          callerUserId: userId,
          intentUserId,
          paymentIntentId,
        });
        return NextResponse.json(
          { error: "Payment intent does not belong to this user" },
          { status: 403 },
        );
      }

      // Bind the intent amount — prevents a small payment from minting large credit grants.
      if (Number(intent.amount) !== amountCents) {
        log.error("Payment intent amount mismatch", {
          userId,
          paymentIntentId,
          intentAmount: intent.amount,
          requestedAmount: amountCents,
        });
        return NextResponse.json(
          { error: "Payment amount does not match requested credit amount" },
          { status: 400 },
        );
      }
    } else {
      // `bonus` and `referral` are admin-only operations. They can only be
      // granted by a platform admin, never self-served via the API.
      if (!isAdmin(userId)) {
        log.warn("Non-admin attempted to grant non-purchase credits", {
          userId,
          type,
        });
        // Deliberately vague — match the admin-auth pattern.
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }

    const balance = await addCredits(
      userId,
      amountCents,
      type,
      description ?? `${type} credits`,
    );

    await auditLog({
      userId,
      action: type === "purchase" ? "credits.purchase" : "credits.grant",
      resource: paymentIntentId ?? `credits:${type}`,
      details: {
        amountCents,
        type,
        paymentIntentId,
        newBalance: balance.balanceCents,
      },
    });

    return NextResponse.json({
      success: true,
      newBalance: balance.balanceCents,
      displayBalance: `$${(balance.balanceCents / 100).toFixed(2)}`,
      added: amountCents,
    });
  } catch (err) {
    log.error("POST /api/credits failed", err as Record<string, unknown>);
    return NextResponse.json(
      { error: "Failed to add credits" },
      { status: 500 },
    );
  }
}
