import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";

/**
 * STRIPE CHECKOUT — Creates a Stripe Checkout session for plan upgrades.
 *
 * Setup required (by your collaborator):
 * 1. Create a Stripe account at stripe.com
 * 2. Create 3 products + prices in Stripe dashboard
 * 3. Add to .env.local:
 *    STRIPE_SECRET_KEY=sk_live_...
 *    STRIPE_PRICE_NODE=price_...
 *    STRIPE_PRICE_ARRAY=price_...
 *    STRIPE_PRICE_ENTERPRISE=price_...
 *    NEXT_PUBLIC_APP_URL=https://sovereignmatrix.agency
 * 4. Set up webhook endpoint in Stripe: /api/payments/stripe/webhook
 */

const PLAN_PRICES: Record<string, string | undefined> = {
  node: process.env.STRIPE_PRICE_NODE,
  array: process.env.STRIPE_PRICE_ARRAY,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

export async function POST(req: Request) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({
        error: "Stripe not configured. Add STRIPE_SECRET_KEY to .env.local",
        setup_guide: "https://dashboard.stripe.com/apikeys",
      }, { status: 503 });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion });
    const { plan } = await req.json();
    const priceId = PLAN_PRICES[plan];

    if (!priceId) {
      return NextResponse.json({ error: `No Stripe price configured for plan: ${plan}` }, { status: 400 });
    }

    const { userId } = await auth();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sovereignmatrix.agency";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?checkout=success&plan=${plan}`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      metadata: { plan, userId: userId || "anonymous" },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
