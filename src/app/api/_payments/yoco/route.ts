import { NextResponse } from "next/server";
import { persistAppend } from "@/lib/persist";
import { getPublicUrl } from "@/lib/base-url";

/**
 * YOCO PAYMENT GATEWAY — South African card + QR payment processing.
 * 
 * Yoco offers 24-48hr approval, no monthly fees.
 * Supports card, QR code, and tap-to-pay.
 * 
 * Required env vars: YOCO_SECRET_KEY, YOCO_PUBLIC_KEY
 * 
 * GET: Returns gateway status
 * POST: Creates a Yoco checkout session
 */

import { PLANS as CANONICAL_PLANS, normalizePlanId } from "@/lib/plans";

// Derive Yoco amounts from canonical plans.ts
function getYocoAmount(planId: string): { name: string; amountCents: number } | null {
  const id = normalizePlanId(planId);
  const plan = CANONICAL_PLANS[id];
  if (!plan || !plan.purchasable) return null;
  return { name: plan.name, amountCents: plan.priceZarCents };
}

export async function GET() {
  const configured = !!process.env.YOCO_SECRET_KEY;
  return NextResponse.json({
    provider: "yoco",
    status: configured ? "configured" : "not_configured",
    methods: ["card", "qr", "apple_pay"],
    currency: "ZAR",
    approval_speed: "24-48 hours",
    monthly_fee: "R0",
    setup: configured ? null : {
      step1: "Sign up at https://www.yoco.com/za/online-payments/",
      step2: "Get your API keys from the Yoco Portal → Developer section",
      step3: "Add YOCO_SECRET_KEY and YOCO_PUBLIC_KEY to your Vercel env vars",
    },
  });
}

export async function POST(req: Request) {
  const secretKey = process.env.YOCO_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: "Yoco not configured. Add YOCO_SECRET_KEY to env vars." }, { status: 503 });
  }

  try {
    const { plan, email, name } = await req.json();

    const planData = getYocoAmount(plan);
    if (!plan || !planData) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    const baseUrl = getPublicUrl();

    // Create Yoco checkout session
    const res = await fetch("https://payments.yoco.com/api/checkouts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: planData.amountCents,
        currency: "ZAR",
        successUrl: `${baseUrl}/payment/success`,
        cancelUrl: `${baseUrl}/payment/cancel`,
        failureUrl: `${baseUrl}/payment/cancel`,
        metadata: {
          plan,
          planName: planData.name,
          email: email || "unknown",
          customerName: name || "unknown",
        },
      }),
    });

    const data = await res.json();

    if (data.redirectUrl) {
      await persistAppend("yoco-checkouts", {
        plan,
        email,
        checkoutId: data.id,
        amount: planData.amountCents,
        timestamp: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        redirectUrl: data.redirectUrl,
        checkoutId: data.id,
        plan: planData,
      });
    }

    return NextResponse.json({ error: "Failed to create Yoco checkout", details: data }, { status: 500 });
  } catch {
    return NextResponse.json({ error: "Yoco checkout failed" }, { status: 500 });
  }
}
