import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { getPublicUrl } from "@/lib/base-url";
import { getStripePriceId } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("stripe-checkout");

/**
 * STRIPE CHECKOUT — Creates a Stripe Checkout session for plan upgrades.
 *
 * SECURITY:
 * - Caller must be authenticated. No "anonymous" fallback — that corrupted
 *   the subscriptions table by inserting orphan rows with userId="anonymous".
 * - Raw Stripe error messages are never returned to the client (could leak
 *   price IDs, key prefixes, or other internal state). We log server-side
 *   and return a generic error.
 *
 * Setup required:
 * 1. STRIPE_SECRET_KEY in .env.local
 * 2. STRIPE_PRICE_STARTER / NODE / ARRAY / ENTERPRISE price IDs
 * 3. Webhook endpoint configured at /api/payments/stripe/webhook
 */

const limiter = rateLimit({ interval: 60, limit: 20 });

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json(
        {
          error: "Stripe not configured. Add STRIPE_SECRET_KEY to .env.local",
          setup_guide: "https://dashboard.stripe.com/apikeys",
        },
        { status: 503 },
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
    });
    const { plan } = await req.json();
    const priceId = getStripePriceId(plan);

    if (!priceId) {
      return NextResponse.json(
        { error: `No Stripe price configured for plan: ${plan}` },
        { status: 400 },
      );
    }

    const appUrl = getPublicUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?checkout=success&plan=${plan}`,
      cancel_url: `${appUrl}/pricing?checkout=cancelled`,
      metadata: { plan, userId },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    log.error("Checkout session creation failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Unable to start checkout. Please try again." },
      { status: 500 },
    );
  }
}
