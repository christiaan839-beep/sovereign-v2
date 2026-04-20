import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { initializePaystack, PLANS, PlanId } from "@/lib/payments";
import { createLogger } from "@/lib/logger";
import { getPublicUrl } from "@/lib/base-url";
import { guardLegacyCheckout } from "@/lib/legacy-payment-guard";
const log = createLogger("paystack-checkout");

/**
 * Paystack Checkout — RETIRED for new signups as of v10.
 * Stripe-only USD billing now. Existing subscribers keep their
 * transactions via the webhook. Re-enable with
 * LEGACY_PAYMENT_PROVIDERS=1 for admin migration cutovers.
 */
export async function POST(req: Request) {
  const legacyGuard = guardLegacyCheckout("paystack");
  if (legacyGuard) return legacyGuard;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { plan } = await req.json();

    if (!plan || !PLANS[plan as PlanId]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const baseUrl = getPublicUrl();
    const result = await initializePaystack(plan as PlanId, email, baseUrl);

    if (!result) {
      return NextResponse.json(
        { error: "Paystack not configured. Add PAYSTACK_SECRET_KEY to env vars." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
      plan: PLANS[plan as PlanId],
    });
  } catch (err) {
    log.error("Paystack checkout error", err as Record<string, unknown>);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
