import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { createOrder, getConfig } from "@/lib/paypal";
import { getPublicUrl } from "@/lib/base-url";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

/**
 * /api/_payments/paypal/checkout — Cook 177.
 *
 * Creates a PayPal v2 order for either a tier plan or an add-on SKU.
 * Returns the PayPal approval URL the visitor is redirected to.
 *
 * Mirrors /api/_payments/stripe/checkout in shape — same auth gate,
 * same rate limit, same metadata contract (the custom_id field on
 * the PayPal order round-trips back via the webhook for provisioning).
 */

const log = createLogger("paypal-checkout");
const limiter = rateLimit({ interval: 60, limit: 10 });

const BODY = z.object({
  intent: z.enum(["plan", "addon", "starter-pack"]),
  itemId: z.string().min(1).max(64),
  amountUsd: z.number().positive().max(1_000_000),
  description: z.string().min(1).max(127),
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

  const appUrl = getPublicUrl();
  const customId = `${body.intent}:${body.itemId}:${userId}`;

  try {
    const { orderId, approvalUrl } = await createOrder({
      amountUsd: body.amountUsd,
      description: body.description,
      customId,
      returnUrl: `${appUrl}/dashboard?paypal=success&intent=${body.intent}`,
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
