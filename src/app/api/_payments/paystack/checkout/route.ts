import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { initializePaystack, PLANS, PlanId } from "@/lib/payments";

/**
 * Paystack Checkout — initializes a transaction and returns the authorization URL.
 */
export async function POST(req: Request) {
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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://sovereignmatrix.agency");
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
    console.error("[Paystack Checkout] Error:", err);
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
