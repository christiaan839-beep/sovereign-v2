import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPublicUrl } from "@/lib/base-url";
import { getPaypalPlanId } from "@/lib/plans";
import { createSubscription } from "@/lib/paypal";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("paypal-checkout");

/**
 * PAYPAL CHECKOUT — Creates a PayPal subscription and returns the approval URL.
 *
 * Setup:
 * 1. PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET in env
 * 2. PAYPAL_PLAN_STARTER / ARRAY / NODE / ENTERPRISE Billing Plan IDs
 * 3. Webhook endpoint configured at /api/_payments/paypal/webhook
 */

const limiter = rateLimit({ interval: 60, limit: 20 });

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return NextResponse.json(
      {
        error:
          "PayPal not configured. Add PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET.",
        setup_guide: "https://developer.paypal.com/dashboard/applications",
      },
      { status: 503 },
    );
  }

  try {
    const { plan } = await req.json();
    const paypalPlanId = getPaypalPlanId(plan);

    if (!paypalPlanId) {
      return NextResponse.json(
        { error: `No PayPal plan configured for: ${plan}` },
        { status: 400 },
      );
    }

    const appUrl = getPublicUrl();
    const subscription = await createSubscription({
      planId: paypalPlanId,
      customId: userId,
      returnUrl: `${appUrl}/dashboard?checkout=success&plan=${plan}&gateway=paypal`,
      cancelUrl: `${appUrl}/pricing?checkout=cancelled`,
    });

    log.info("PayPal subscription created", {
      userId,
      plan,
      subId: subscription.id,
    });
    return NextResponse.json({ url: subscription.approveUrl });
  } catch (error) {
    log.error("PayPal checkout failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Unable to start PayPal checkout. Please try again." },
      { status: 500 },
    );
  }
}
