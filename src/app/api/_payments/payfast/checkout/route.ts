import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { generatePayFastForm, PLANS, PlanId } from "@/lib/payments";

/**
 * PayFast Checkout — generates a form that redirects to PayFast.
 * The user submits this form to start a PayFast subscription.
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
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
    const formHtml = generatePayFastForm(plan as PlanId, email, baseUrl);

    if (!formHtml) {
      return NextResponse.json(
        { error: "PayFast not configured. Add PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY to env vars." },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, formHtml, plan: PLANS[plan as PlanId] });
  } catch {
    return NextResponse.json({ error: "Failed to create checkout" }, { status: 500 });
  }
}
