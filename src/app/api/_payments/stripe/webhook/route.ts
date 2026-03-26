import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * STRIPE WEBHOOK — Handles subscription events from Stripe.
 *
 * Setup:
 * 1. In Stripe dashboard → Developers → Webhooks
 * 2. Add endpoint: https://sovereignmatrix.agency/api/payments/stripe/webhook
 * 3. Select events: checkout.session.completed, customer.subscription.updated,
 *    customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed
 * 4. Copy signing secret to .env.local: STRIPE_WEBHOOK_SECRET=whsec_...
 */

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion });
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const plan = session.metadata?.plan || "node";
      const userId = session.metadata?.userId;
      console.log(`[Stripe] Checkout complete: ${userId} → ${plan} plan`);

      if (userId) {
        const customerId = typeof session.customer === "string"
          ? session.customer
          : session.customer?.id ?? null;

        // Upsert subscription: create if new, update if existing
        const existing = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, userId))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(subscriptions)
            .set({
              plan,
              status: "active",
              stripeCustomerId: customerId,
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.userId, userId));
        } else {
          await db.insert(subscriptions).values({
            userId,
            plan,
            status: "active",
            stripeCustomerId: customerId,
          });
        }
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      console.log(`[Stripe] Subscription updated: ${sub.id} → ${sub.status}`);

      // Sync subscription status and period end
      await db
        .update(subscriptions)
        .set({
          status: sub.status === "active" ? "active" : sub.status,
          currentPeriodEnd: sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : null,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, sub.id));
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      console.log(`[Stripe] Subscription cancelled: ${sub.id}`);

      // Downgrade to free plan
      await db
        .update(subscriptions)
        .set({
          plan: "free",
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, sub.id));
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string"
        ? invoice.customer
        : invoice.customer?.id ?? null;
      console.log(`[Stripe] Payment failed: ${customerId}`);

      // Mark subscription as past_due — downgrade happens on deletion
      if (customerId) {
        await db
          .update(subscriptions)
          .set({
            status: "past_due",
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.stripeCustomerId, customerId));
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
