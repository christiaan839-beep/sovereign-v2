import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { alreadyProcessed } from "@/lib/idempotency";
import { verifyWebhook, type PaypalWebhookEvent } from "@/lib/paypal";
import { planIdFromPaypalPlanId } from "@/lib/plans";

const log = createLogger("paypal-webhook");

// Reject events older than 5 minutes (replay protection).
const MAX_EVENT_AGE_SECONDS = 5 * 60;

/**
 * PAYPAL WEBHOOK — Handles subscription lifecycle events from PayPal.
 *
 * Setup:
 * 1. PayPal Developer Dashboard → My Apps → Webhooks → Add Webhook
 * 2. URL: https://sovereignmatrix.agency/api/_payments/paypal/webhook
 * 3. Subscribe to:
 *    - BILLING.SUBSCRIPTION.ACTIVATED
 *    - BILLING.SUBSCRIPTION.UPDATED
 *    - BILLING.SUBSCRIPTION.CANCELLED
 *    - BILLING.SUBSCRIPTION.EXPIRED
 *    - PAYMENT.SALE.COMPLETED
 * 4. Copy the Webhook ID into PAYPAL_WEBHOOK_ID env var
 */
export async function POST(req: Request) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    return NextResponse.json(
      { error: "PayPal webhook not configured" },
      { status: 503 },
    );
  }

  const rawBody = await req.text();
  const headers = {
    authAlgo: req.headers.get("paypal-auth-algo") || "",
    certUrl: req.headers.get("paypal-cert-url") || "",
    transmissionId: req.headers.get("paypal-transmission-id") || "",
    transmissionSig: req.headers.get("paypal-transmission-sig") || "",
    transmissionTime: req.headers.get("paypal-transmission-time") || "",
  };

  if (
    !headers.authAlgo ||
    !headers.certUrl ||
    !headers.transmissionId ||
    !headers.transmissionSig ||
    !headers.transmissionTime
  ) {
    return NextResponse.json(
      { error: "Missing PayPal signature headers" },
      { status: 400 },
    );
  }

  const verified = await verifyWebhook({ headers, rawBody, webhookId });
  if (!verified) {
    log.error("PayPal signature verification failed", {
      transmissionId: headers.transmissionId,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: PaypalWebhookEvent;
  try {
    event = JSON.parse(rawBody) as PaypalWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Replay protection (PayPal create_time is ISO-8601).
  const createdMs = Date.parse(event.create_time);
  if (Number.isFinite(createdMs)) {
    const ageSeconds = Math.floor((Date.now() - createdMs) / 1000);
    if (ageSeconds > MAX_EVENT_AGE_SECONDS) {
      log.error("Stale PayPal event rejected", {
        eventId: event.id,
        ageSeconds,
      });
      return NextResponse.json({ error: "Stale event" }, { status: 400 });
    }
  }

  if (await alreadyProcessed("paypal:event", event.id)) {
    log.info("Duplicate PayPal event skipped", { eventId: event.id });
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.event_type) {
      case "BILLING.SUBSCRIPTION.ACTIVATED": {
        const userId = event.resource.custom_id;
        const subId = event.resource.id;
        const planId = planIdFromPaypalPlanId(event.resource.plan_id);
        const nextBilling = event.resource.billing_info?.next_billing_time;
        if (!userId || !planId || !subId) {
          log.warn("Activation missing fields", {
            userId,
            planId,
            subId,
            paypalPlanId: event.resource.plan_id,
          });
          break;
        }
        await db
          .insert(subscriptions)
          .values({
            userId,
            plan: planId,
            status: "active",
            // Reuse the stripeSubscriptionId column for the PayPal subscription
            // ID. PayPal IDs start with "I-" (e.g. I-BW452GLLEP1G), Stripe IDs
            // start with "sub_" — no collision. Adds a new column would require
            // a migration; we explicitly avoided that for this ship.
            stripeSubscriptionId: subId,
            currentPeriodEnd: nextBilling ? new Date(nextBilling) : null,
          })
          .onConflictDoUpdate({
            target: subscriptions.userId,
            set: {
              plan: planId,
              status: "active",
              stripeSubscriptionId: subId,
              currentPeriodEnd: nextBilling ? new Date(nextBilling) : null,
              updatedAt: new Date(),
            },
          });
        log.info("PayPal subscription activated", { userId, plan: planId });
        break;
      }

      case "BILLING.SUBSCRIPTION.UPDATED": {
        const subId = event.resource.id;
        const status = event.resource.status?.toLowerCase();
        const nextBilling = event.resource.billing_info?.next_billing_time;
        if (!subId) break;
        await db
          .update(subscriptions)
          .set({
            status:
              status === "active"
                ? "active"
                : status === "suspended"
                  ? "past_due"
                  : "inactive",
            currentPeriodEnd: nextBilling ? new Date(nextBilling) : null,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.stripeSubscriptionId, subId));
        log.info("PayPal subscription updated", { subId, status });
        break;
      }

      case "BILLING.SUBSCRIPTION.CANCELLED":
      case "BILLING.SUBSCRIPTION.EXPIRED": {
        const subId = event.resource.id;
        if (!subId) break;
        await db
          .update(subscriptions)
          .set({
            status: "cancelled",
            plan: "free",
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.stripeSubscriptionId, subId));
        log.info("PayPal subscription cancelled — downgraded to free", {
          subId,
        });
        break;
      }

      case "PAYMENT.SALE.COMPLETED": {
        // Subscriptions are the source of truth; we only log payment events.
        log.info("PayPal payment completed", {
          eventId: event.id,
          resourceId: event.resource.id,
        });
        break;
      }
    }
  } catch (err) {
    log.error("PayPal webhook handler error", {
      eventType: event.event_type,
      error: (err as Error).message,
    });
    // Always 200 — let PayPal stop retrying. We've already deduped on event.id
    // so a retry on transient DB failure isn't going to help.
    return NextResponse.json({ received: true, handled: false });
  }

  return NextResponse.json({ received: true });
}
