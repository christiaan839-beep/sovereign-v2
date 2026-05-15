import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getPublicUrl } from "@/lib/base-url";
import { ADD_ONS, isKnownAddOn, stripePriceId } from "@/lib/add-ons";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("stripe-addon-checkout");

/**
 * STRIPE ADD-ON CHECKOUT (Cook 143)
 *
 * Creates a Stripe Checkout session for add-on SKUs defined in
 * src/lib/add-ons.ts — Auditor Replay Seats, regulatory packs,
 * and crypto-receipt overage bundles.
 *
 * SECURITY:
 *   - Caller must be authenticated (no anonymous orphans).
 *   - Quantity bounded to 1..50 to defeat trivial DoS on Stripe
 *     and accidental "buy 10,000 seats" mistakes.
 *   - Unknown SKU ids → 400; SKU without env price → 503.
 *   - Stripe error messages NEVER returned to caller (we log
 *     server-side and surface a generic message).
 *
 * Side channel: the resulting subscription's metadata.skuId is the
 * canonical hook the webhook handler uses to provision the actual
 * add-on (seat issuance for auditor-replay, feature-flag flip for
 * regulatory packs, meter-binding for receipt overage). All of that
 * logic lives in the webhook, not here.
 */

const limiter = rateLimit({ interval: 60, limit: 10 });

const BODY = z.object({
  skuId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(50).default(1),
});

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: z.infer<typeof BODY>;
  try {
    parsed = BODY.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request body. Expected { skuId, quantity? }." },
      { status: 400 },
    );
  }

  if (!isKnownAddOn(parsed.skuId)) {
    return NextResponse.json(
      { error: `Unknown SKU: ${parsed.skuId}` },
      { status: 400 },
    );
  }

  const sku = ADD_ONS[parsed.skuId];
  if (!sku.selfServe) {
    return NextResponse.json(
      {
        error:
          "This SKU requires a sales conversation. Use /contact?addon=" +
          encodeURIComponent(parsed.skuId),
      },
      { status: 400 },
    );
  }

  const priceId = stripePriceId(parsed.skuId);
  if (!priceId) {
    return NextResponse.json(
      { error: "Add-on pricing is not configured in this environment." },
      { status: 503 },
    );
  }

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

  try {
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
    });

    const appUrl = getPublicUrl();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: parsed.quantity }],
      success_url: `${appUrl}/dashboard?addon=success&sku=${encodeURIComponent(parsed.skuId)}`,
      cancel_url: `${appUrl}/pricing?addon=cancelled`,
      metadata: {
        skuId: parsed.skuId,
        family: sku.family,
        userId,
        quantity: String(parsed.quantity),
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url, skuId: parsed.skuId });
  } catch (error) {
    log.error("Add-on checkout session creation failed", {
      userId,
      skuId: parsed.skuId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Unable to start checkout. Please try again." },
      { status: 500 },
    );
  }
}
