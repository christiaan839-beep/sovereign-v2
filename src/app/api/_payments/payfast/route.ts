import { NextResponse } from "next/server";
import crypto from "crypto";

/**
 * PAYFAST PAYMENT GATEWAY — South African payment processing.
 * 
 * Plans:
 * - Node Plan:   R4,997/mo  (500 agent calls/day)
 * - Array Plan:  R9,997/mo  (2,000 agent calls/day)
 * - Cartel Plan: R49,997/mo (Unlimited + white-label)
 * 
 * Env vars needed:
 * - PAYFAST_MERCHANT_ID
 * - PAYFAST_MERCHANT_KEY
 * - PAYFAST_PASSPHRASE (for signature validation)
 * 
 * Flow: POST /api/payments/payfast → redirect to PayFast → ITN callback confirms
 */

interface Plan {
  id: string;
  name: string;
  amount: number;
  description: string;
  agents_per_day: number;
}

const PLANS: Plan[] = [
  { id: "node", name: "Node Plan", amount: 4997, description: "500 agent calls/day, 41 NIM models, email support", agents_per_day: 500 },
  { id: "array", name: "Array Plan", amount: 9997, description: "2,000 agent calls/day, all agents, priority support, 6 verticals", agents_per_day: 2000 },
  { id: "cartel", name: "Cartel Plan", amount: 49997, description: "Unlimited calls, white-label, dedicated infra, 24/7 support", agents_per_day: -1 },
];

export async function POST(request: Request) {
  try {
    const { plan_id, email, first_name, last_name } = await request.json();

    if (!plan_id || !email) {
      return NextResponse.json({ error: "plan_id and email are required.", plans: PLANS }, { status: 400 });
    }

    const plan = PLANS.find(p => p.id === plan_id);
    if (!plan) {
      return NextResponse.json({ error: `Plan '${plan_id}' not found.`, available: PLANS.map(p => p.id) }, { status: 404 });
    }

    const merchantId = process.env.PAYFAST_MERCHANT_ID;
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY;
    const passphrase = process.env.PAYFAST_PASSPHRASE;

    if (!merchantId || !merchantKey) {
      // Return demo checkout URL when PayFast isn't configured
      return NextResponse.json({
        success: true,
        mode: "demo",
        plan,
        message: "PayFast credentials not configured. Set PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY in Vercel env vars.",
        demo_checkout_url: `https://sandbox.payfast.co.za/eng/process?merchant_id=10000100&merchant_key=46f0cd694581a&amount=${plan.amount / 100}&item_name=${encodeURIComponent(plan.name)}`,
      });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    // Build PayFast payment data
    const paymentData: Record<string, string> = {
      merchant_id: merchantId,
      merchant_key: merchantKey,
      return_url: `${baseUrl}/payment/success`,
      cancel_url: `${baseUrl}/payment/cancel`,
      notify_url: `${baseUrl}/api/payments/payfast/itn`,
      name_first: first_name || "Client",
      name_last: last_name || "",
      email_address: email,
      m_payment_id: `SM-${plan.id}-${Date.now()}`,
      amount: (plan.amount / 100).toFixed(2),
      item_name: `Sovereign Matrix — ${plan.name}`,
      item_description: plan.description,
      subscription_type: "1",
      recurring_amount: (plan.amount / 100).toFixed(2),
      frequency: "3", // Monthly
      cycles: "0", // Indefinite
    };

    // Generate signature
    if (passphrase) {
      const signatureString = Object.entries(paymentData)
        .map(([key, val]) => `${key}=${encodeURIComponent(val.trim())}`)
        .join("&") + `&passphrase=${encodeURIComponent(passphrase.trim())}`;

      paymentData.signature = crypto.createHash("md5").update(signatureString).digest("hex");
    }

    // Build form URL
    const isLive = process.env.PAYFAST_MODE === "live";
    const payfastUrl = isLive ? "https://www.payfast.co.za/eng/process" : "https://sandbox.payfast.co.za/eng/process";

    const formParams = new URLSearchParams(paymentData).toString();

    return NextResponse.json({
      success: true,
      mode: isLive ? "live" : "sandbox",
      plan,
      checkout_url: `${payfastUrl}?${formParams}`,
      payment_id: paymentData.m_payment_id,
    });
  } catch (error) {
    return NextResponse.json({ error: "Payment error", details: String(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "PayFast Payment Gateway — Active",
    plans: PLANS,
    mode: process.env.PAYFAST_MODE === "live" ? "LIVE" : "SANDBOX",
    configured: !!(process.env.PAYFAST_MERCHANT_ID && process.env.PAYFAST_MERCHANT_KEY),
  });
}
