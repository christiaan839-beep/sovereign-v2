import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { initializeYoco, PLANS, PlanId } from "@/lib/payments";
import { createLogger } from "@/lib/logger";
import { getPublicUrl } from "@/lib/base-url";

const log = createLogger("yoco-checkout");

/**
 * Yoco Checkout — Creates a checkout session and returns the redirect URL.
 * SA's biggest card payment processor. Supports cards, SnapScan, EFT.
 */
export async function POST(req: Request) {
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
