import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createCheckoutSession } from "@/lib/stripe";
import { createLogger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/base-url";
const log = createLogger("billing-checkout");

/**
 * POST /api/billing/checkout
 * Creates a Stripe Checkout session for upgrading to a paid plan.
 */

const PRICE_MAP: Record<string, string | undefined> = {
  node: process.env.STRIPE_PRICE_NODE,
  array: process.env.STRIPE_PRICE_ARRAY,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
};

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = await request.json();
    const planId = body.planId as string;

    if (!planId || !PRICE_MAP[planId]) {
      return NextResponse.json(
        { error: `Invalid plan. Choose one of: ${Object.keys(PRICE_MAP).join(", ")}` },
        { status: 400 }
      );
    }

    const priceId = PRICE_MAP[planId];
    if (!priceId) {
      return NextResponse.json(
        {
          error: `Stripe price not configured for plan "${planId}". Set STRIPE_PRICE_${planId.toUpperCase()} env var.`,
        },
        { status: 503 }
      );
    }

    const origin = getBaseUrl();

    const url = await createCheckoutSession({
      priceId,
      customerEmail: body.email || "",
      successUrl: `${origin}/dashboard/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/dashboard/billing`,
    });

    if (!url) {
      return NextResponse.json(
        { error: "Stripe is not configured. Set STRIPE_SECRET_KEY in your environment." },
        { status: 503 }
      );
    }

    return NextResponse.json({ url });
  } catch (err) {
    log.error("Billing checkout error", err as Record<string, unknown>);
    return NextResponse.json({ error: "Failed to create checkout session." }, { status: 500 });
  }
}
