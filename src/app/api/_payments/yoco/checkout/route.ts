import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { initializeYoco, PLANS, PlanId } from "@/lib/payments";
import { createLogger } from "@/lib/logger";
import { getPublicUrl } from "@/lib/base-url";
import { guardLegacyCheckout } from "@/lib/legacy-payment-guard";

const log = createLogger("yoco-checkout");

/**
 * Yoco Checkout — RETIRED for new signups as of v10.
 * Sovereign Matrix now bills USD-only via Stripe. Existing Yoco
 * subscribers keep their subscription; their webhook at
 * /api/_payments/yoco/webhook stays functional. This route returns
 * 410 for new checkout attempts unless LEGACY_PAYMENT_PROVIDERS=1
 * is set (for admin-triggered migration cutovers).
 */
export async function POST(req: Request) {
  const legacyGuard = guardLegacyCheckout("yoco");
  if (legacyGuard) return legacyGuard;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { plan } = await req.json();

    if (!plan || !PLANS[plan as PlanId]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const baseUrl = getPublicUrl();

    const result = await initializeYoco(plan as PlanId, email, baseUrl);

    if (!result) {
      return NextResponse.json(
        { error: "Yoco not configured. Add YOCO_SECRET_KEY to env vars." },
        { status: 503 }
      );
    }

    log.info("Yoco checkout created", { email, plan });

    return NextResponse.json({
      success: true,
      redirectUrl: result.redirectUrl,
      checkoutId: result.checkoutId,
      plan: PLANS[plan as PlanId],
    });
  } catch (err) {
    log.error("Yoco checkout error", err as Record<string, unknown>);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
