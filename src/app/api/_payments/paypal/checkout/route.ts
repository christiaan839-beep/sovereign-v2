import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { createOrder, getConfig } from "@/lib/paypal";
import { resolveOrderPricing } from "@/lib/paypal-pricing";
import { getPublicUrl } from "@/lib/base-url";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

/**
 * /api/_payments/paypal/checkout — the sole payment entry point.
 *
 * Creates a PayPal v2 order for a tier plan, an add-on SKU, or a starter
 * pack. Returns the PayPal approval URL the visitor is redirected to.
 *
 * The price and description are resolved server-side from the canonical
 * catalogs — the client only names the item, never the amount, so a tampered
 * body cannot buy a plan cheaply. The custom_id (`<intent>:<itemId>:<userId>`)
 * round-trips back on capture + the webhook for provisioning.
 */

const log = createLogger("paypal-checkout");
const limiter = rateLimit({ interval: 60, limit: 10 });

const BODY = z.object({
  intent: z.enum(["plan", "addon", "starter-pack"]),
  itemId: z.string().min(1).max(64),
});

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getConfig()) {
    return NextResponse.json(
      {
        error:
          "PayPal not configured. Set PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET + PAYPAL_WEBHOOK_ID.",
      },
      { status: 503 },
    );
  }

  let body: z.infer<typeof BODY>;
  try {
    body = BODY.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const pricing = resolveOrderPricing(body.intent, body.itemId);
  if (!pricing) {
    return NextResponse.json(
      { error: "Unknown or unavailable item" },
      { status: 400 },
    );
  }

  const appUrl = getPublicUrl();
  const customId = `${body.intent}:${body.itemId}:${userId}`;

  try {
    const { orderId, approvalUrl } = await createOrder({
      amountUsd: pricing.amountUsd,
      description: pricing.description,
      customId,
      // PayPal appends ?token=<orderId> — the capture route finalises the
      // order (Orders v2 requires an explicit capture) and provisioning then
      // happens via the PAYMENT.CAPTURE.COMPLETED webhook.
      returnUrl: `${appUrl}/api/payments/paypal/capture`,
      cancelUrl: `${appUrl}/pricing?paypal=cancelled`,
    });
    log.info("PayPal order created", {
      orderId,
      intent: body.intent,
      itemId: body.itemId,
      userId,
    });
    return NextResponse.json({ orderId, approvalUrl });
  } catch (err) {
    log.error("PayPal order create failed", {
      err: err instanceof Error ? err.message : String(err),
      userId,
    });
    return NextResponse.json(
      { error: "Could not start PayPal checkout. Please try again." },
      { status: 500 },
    );
  }
}
