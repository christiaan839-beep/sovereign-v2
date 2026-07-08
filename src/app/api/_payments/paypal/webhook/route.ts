import { NextResponse } from "next/server";
import {
  extractCustomId,
  getConfig,
  isPaymentCompletedEvent,
  isSubscriptionActivatedEvent,
  type WebhookEvent,
  verifyWebhookSignature,
} from "@/lib/paypal";
import { alreadyProcessed, unmarkProcessed } from "@/lib/idempotency";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { PLANS, normalizePlanId } from "@/lib/plans";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Activate a tier-plan subscription from a completed PayPal capture.
 * Mirrors the crypto webhook's one-time model: a paid order grants the
 * plan for 30 days; getUserPlan's currentPeriodEnd check downgrades it
 * afterwards unless renewed. Closes the gap where `intent === "plan"`
 * captures fell through to "no provisioning hook" and left the paying
 * customer un-upgraded (BACKLOG paypal-plan).
 */
async function activatePaypalPlan(
  userId: string,
  itemId: string,
  capturedUsd: number,
  eventId: string,
): Promise<void> {
  const plan = normalizePlanId(itemId);
  if (plan === "free") {
    log.warn("PayPal plan capture with unrecognized plan id", {
      itemId,
      userId,
      eventId,
    });
    return;
  }
  // Defense against a tampered custom_id / amount: the captured USD must
  // be within a tolerance band of the plan's canonical price.
  const expectedUsd = (PLANS[plan].priceUsdCents ?? 0) / 100;
  if (
    expectedUsd > 0 &&
    capturedUsd > 0 &&
    Math.abs(capturedUsd - expectedUsd) / expectedUsd > 0.5
  ) {
    log.error("PayPal plan amount far from expected — refusing upgrade", {
      capturedUsd,
      expectedUsd,
      plan,
      userId,
      eventId,
    });
    return;
  }

  const periodEnd = new Date(Date.now() + THIRTY_DAYS_MS);
  const ref = `pp_${eventId}`;
  await db
    .insert(subscriptions)
    .values({
      userId,
      plan,
      status: "active",
      stripeCustomerId: ref,
      stripeSubscriptionId: ref,
      currentPeriodEnd: periodEnd,
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: {
        plan,
        status: "active",
        stripeCustomerId: ref,
        stripeSubscriptionId: ref,
        currentPeriodEnd: periodEnd,
        updatedAt: new Date(),
      },
    });
  log.info("PayPal plan subscription activated", {
    userId,
    plan,
    periodEnd: periodEnd.toISOString(),
  });
}

/**
 * /api/_payments/paypal/webhook — Cook 177.
 *
 * Receives PayPal webhook events. Verifies the signature server-side
 * via PayPal's verify-webhook-signature endpoint, deduplicates by
 * event id, and provisions the SKU on PAYMENT.CAPTURE.COMPLETED or
 * BILLING.SUBSCRIPTION.ACTIVATED.
 *
 * The custom_id field encodes `<intent>:<itemId>:<userId>` set on
 * the original order in /paypal/checkout — round-trips cleanly so
 * the webhook knows what to provision.
 *
 * Rate-limited at 120 req/min/IP to cap the cost-amplification
 * from the PayPal verify-webhook-signature outbound API call.
 */

const log = createLogger("paypal-webhook");
const limiter = rateLimit({ interval: 60, limit: 120 });

export async function POST(req: Request) {
  if (!getConfig()) {
    return NextResponse.json(
      { error: "PayPal not configured" },
      { status: 503 },
    );
  }

  const limited = await limiter.check(req);
  if (limited) return limited;

  const body = await req.text();

  // Collect the headers PayPal includes on the signature challenge.
  const headers: Record<string, string | undefined> = {
    "paypal-auth-algo": req.headers.get("paypal-auth-algo") ?? undefined,
    "paypal-cert-url": req.headers.get("paypal-cert-url") ?? undefined,
    "paypal-transmission-id":
      req.headers.get("paypal-transmission-id") ?? undefined,
    "paypal-transmission-sig":
      req.headers.get("paypal-transmission-sig") ?? undefined,
    "paypal-transmission-time":
      req.headers.get("paypal-transmission-time") ?? undefined,
  };

  const verified = await verifyWebhookSignature({ headers, body });
  if (!verified) {
    log.error("PayPal webhook signature failed");
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  let event: WebhookEvent;
  try {
    event = JSON.parse(body) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (await alreadyProcessed("paypal:event", event.id)) {
    log.info("Duplicate PayPal event skipped", { eventId: event.id });
    return NextResponse.json({ received: true, duplicate: true });
  }

  const customId = extractCustomId(event);
  const intent = customId?.split(":")[0] ?? null;
  const itemId = customId?.split(":")[1] ?? null;
  const userId = customId?.split(":")[2] ?? null;

  try {
    if (isPaymentCompletedEvent(event.event_type)) {
      if (intent === "addon" && itemId && userId) {
        const { provisionAddOn } = await import("@/lib/add-on-provisioner");
        const result = provisionAddOn({
          skuId: itemId,
          userId,
          eventId: event.id,
        });
        // Mirror the Stripe webhook pattern — log the full result
        // envelope so downstream operators see seats / pack flag /
        // meter id alongside the family.
        log.info("PayPal add-on provisioned", {
          userId,
          ...result,
          seatCount: result.seats?.length ?? 0,
        });
      } else if (
        (intent === "plan" || intent === "starter-pack") &&
        itemId &&
        userId
      ) {
        const resource = event.resource as { amount?: { value?: string } };
        const capturedUsd = Number(resource?.amount?.value ?? 0);
        await activatePaypalPlan(userId, itemId, capturedUsd, event.id);
      } else {
        log.info("PayPal payment completed (no provisioning hook)", {
          eventId: event.id,
          intent,
          itemId,
          userId,
        });
      }
    } else if (isSubscriptionActivatedEvent(event.event_type)) {
      // Recurring PayPal subscription activation — the plan id rides on
      // custom_id the same way one-time orders do.
      if (intent === "plan" && itemId && userId) {
        await activatePaypalPlan(userId, itemId, 0, event.id);
      } else {
        log.info("PayPal subscription activated (no provisioning hook)", {
          eventId: event.id,
          intent,
          itemId,
          userId,
        });
      }
    } else {
      log.info("PayPal event acknowledged (no handler)", {
        eventId: event.id,
        eventType: event.event_type,
      });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    // Release the marker so PayPal's retry reprocesses (BACKLOG webhook-idempotency).
    await unmarkProcessed("paypal:event", event.id);
    log.error("PayPal webhook handler failed", {
      err: err instanceof Error ? err.message : String(err),
      eventId: event.id,
    });
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}
