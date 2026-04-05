import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getPublicUrl } from "@/lib/base-url";

/**
 * STRIPE CUSTOMER PORTAL — Lets users manage their subscription.
 * Change plan, update payment method, cancel, view invoices.
 */

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion });
  const { customerId } = await req.json();

  if (!customerId) {
    return NextResponse.json({ error: "Customer ID required" }, { status: 400 });
  }

  const appUrl = getPublicUrl();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/dashboard/billing`,
  });

  return NextResponse.json({ url: session.url });
}
