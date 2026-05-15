/**
 * POST /api/payments/crypto/checkout
 *
 * Creates a Coinbase Commerce hosted-checkout charge for a plan and
 * returns the URL the buyer should be sent to. Symmetric to the Stripe
 * `/api/payments/stripe/checkout` route — same auth, same shape, same
 * rate limit. The pricing page picks whichever the buyer clicked.
 *
 * Coinbase Commerce charges are one-time (no recurring billing
 * primitive on-chain). We treat each successful charge as "30 days of
 * <plan>"; the webhook handler stamps a `expiresAt` 30 days out, and
 * /lib/plan-enforcement.ts flips the user back to free past that.
 * Buyers who want continuous access pay again before expiry.
 *
 * If `COINBASE_COMMERCE_API_KEY` isn't set, we return 503 with a
 * setup_guide link — never crash, never expose internal state.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createCommerceCharge } from "@/lib/coinbase-commerce";
import { getPublicUrl } from "@/lib/base-url";
import { PLANS, type PlanId } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("crypto-checkout");

const limiter = rateLimit({ interval: 60, limit: 20 });

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let plan: PlanId | undefined;
  try {
    const body = (await req.json()) as { plan?: PlanId };
    plan = body.plan;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Use own-property check rather than `in` — prevents pollution from
  // prototype keys like "__proto__" or "constructor" being treated as
  // valid plan ids.
  if (!plan || !Object.prototype.hasOwnProperty.call(PLANS, plan)) {
    return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
  }

  const planDef = PLANS[plan];
  if (!planDef.purchasable || planDef.priceUsdCents === 0) {
    return NextResponse.json(
      { error: "Plan not purchasable via crypto" },
      { status: 400 },
    );
  }

  const appUrl = getPublicUrl();
  const amountUsd = (planDef.priceUsdCents / 100).toFixed(2);

  try {
    const charge = await createCommerceCharge({
      name: `Sovereign — ${planDef.name}`,
      description: `${planDef.name} plan, 30 days of access. Pay with BTC, ETH, USDC, DAI, LTC, DOGE or other supported assets via Coinbase Commerce.`,
      amount: amountUsd,
      currency: "USD",
      metadata: { userId, plan },
      redirectUrl: `${appUrl}/dashboard?checkout=crypto-pending&plan=${plan}`,
      cancelUrl: `${appUrl}/pricing?checkout=cancelled`,
    });

    if (!charge) {
      return NextResponse.json(
        {
          error:
            "Crypto checkout not configured. Add COINBASE_COMMERCE_API_KEY to enable.",
          setup_guide: "https://beta.commerce.coinbase.com/",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      url: charge.hosted_url,
      chargeId: charge.id,
      chargeCode: charge.code,
    });
  } catch (err) {
    log.error("Crypto checkout failed", {
      userId,
      plan,
      error: (err as Error).message,
    });
    return NextResponse.json(
      { error: "Unable to start crypto checkout. Please try again." },
      { status: 500 },
    );
  }
}
