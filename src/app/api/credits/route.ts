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
import { getCreditBalance, addCredits, getCreditHistory } from "@/lib/a2e";
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

const ADD_SCHEMA = z.object({
  amountCents: z.number().int().min(1).max(100_000),
  type: z.enum(["purchase", "bonus", "referral"]),
  description: z.string().max(200).optional(),
  // In production: purchaseToken or Stripe payment intent ID goes here
});

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId || "";

  try {
    const body = await req.json();
    const parsed = ADD_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const { amountCents, type, description } = parsed.data;

    // TODO: For "purchase" type, verify Stripe payment intent before adding credits
    // For now, bonus/referral credits are admin-controlled

    const balance = await addCredits(userId, amountCents, type, description ?? `${type} credits`);

    return NextResponse.json({
      success: true,
      newBalance: balance.balanceCents,
      displayBalance: `$${(balance.balanceCents / 100).toFixed(2)}`,
      added: amountCents,
    });
  } catch (err) {
    log.error("POST /api/credits failed", err as Record<string, unknown>);
    return NextResponse.json({ error: "Failed to add credits" }, { status: 500 });
  }
}
