/**
 * SOVEREIGN MATRIX — Stripe Connect onboarding (Cook 83)
 *
 * Marketplace developers onboard a Stripe Connect Express account so
 * Sovereign can pay out their share of marketplace revenue (Cook 62
 * split, 70% to developer by default).
 *
 * POST /api/_marketplace/connect
 *   → 200 { url: "https://connect.stripe.com/setup/..." }
 *
 * The route uses the existing getStripe() singleton. Without Stripe
 * configured the route returns 503. Account ids are stamped in the
 * audit log; persistence to a developer account row lands when
 * migration 0021 brings the developers table online.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getStripe } from "@/lib/stripe";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("marketplace/connect");

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId || "";

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured" },
      { status: 503 },
    );
  }

  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!origin) {
    return NextResponse.json(
      { error: "App URL not configured" },
      { status: 503 },
    );
  }

  try {
    // Create a Connect Express account for this developer. In
    // production we'd look up an existing account id from a
    // `developer_accounts` table and reuse it; with persistence
    // pending we create-or-replay on every request.
    const account = await stripe.accounts.create({
      type: "express",
      metadata: { sovereignUserId: userId },
      capabilities: {
        transfers: { requested: true },
      },
    });

    const link = await stripe.accountLinks.create({
      account: account.id,
      type: "account_onboarding",
      return_url: `${origin}/marketplace/admin?connect=success`,
      refresh_url: `${origin}/marketplace/admin?connect=refresh`,
    });

    await auditLog({
      userId,
      action: "marketplace.connect",
      resource: `stripe-account:${account.id}`,
      details: { accountId: account.id },
    });

    return NextResponse.json({
      url: link.url,
      accountId: account.id,
    });
  } catch (err) {
    log.error(
      "POST /api/_marketplace/connect failed",
      err as Record<string, unknown>,
    );
    return NextResponse.json(
      { error: "Failed to create Connect account" },
      { status: 500 },
    );
  }
}
