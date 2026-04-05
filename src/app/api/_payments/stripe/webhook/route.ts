import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("stripe-webhook");

/**
 * STRIPE WEBHOOK — Handles subscription lifecycle events from Stripe.
 *
 * Setup:
 * 1. In Stripe dashboard → Developers → Webhooks
 * 2. Add endpoint: https://sovereignmatrix.agency/api/payments/stripe/webhook
 * 3. Select events: checkout.session.completed, customer.subscription.updated,
 *    customer.subscription.deleted, invoice.payment_succeeded, invoice.payment_failed
 * 4. Copy signing secret to .env.local: STRIPE_WEBHOOK_SECRET=whsec_...
 */

/**
 * Extract a Stripe resource ID from a field that may be `string | ExpandedObject | null`.
 * Never use `.toString()` on Stripe objects — it returns "[object Object]".
 */
function stripeId<T extends { id: string }>(field: string | T | null | undefined): string | null {
  if (!field) return null;
  return typeof field === "string" ? field : field.id;
}

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

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const plan = session.metadata?.plan || "node";
        const userId = session.metadata?.userId;
        const customerId = stripeId(session.customer);
        const subscriptionId = stripeId(session.subscription);
        if (userId) {
          await db.insert(subscriptions).values({
            userId,
            plan,
            status: "active",
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
          }).onConflictDoUpdate({
            target: subscriptions.userId,
            set: {
              plan,
              status: "active",
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              updatedAt: new Date(),
            },
          });
          log.info("Subscription activated", { userId, plan });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = stripeId(sub.customer);
        if (stripeCustomerId) {
          await db.update(subscriptions).set({
            status: sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : "inactive",
            updatedAt: new Date(),
          }).where(eq(subscriptions.stripeCustomerId, stripeCustomerId));
          log.info("Subscription updated", { stripeCustomerId, status: sub.status });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = stripeId(sub.customer);
        if (stripeCustomerId) {
          await db.update(subscriptions).set({
            status: "cancelled",
            plan: "free",
            updatedAt: new Date(),
          }).where(eq(subscriptions.stripeCustomerId, stripeCustomerId));
          log.info("Subscription cancelled — downgraded to free", { stripeCustomerId });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = stripeId(invoice.customer);
        if (stripeCustomerId) {
          await db.update(subscriptions).set({
            status: "past_due",
            updatedAt: new Date(),
          }).where(eq(subscriptions.stripeCustomerId, stripeCustomerId));
          log.error("Payment failed", { stripeCustomerId, invoiceId: invoice.id });
        }
        break;
      }
    }
  } catch (err) {
    log.error("Webhook handler error", { eventType: event.type, error: (err as Error).message });
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
