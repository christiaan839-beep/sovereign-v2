import { NextResponse } from "next/server";
import {
  extractCustomId,
  getConfig,
  isPaymentCompletedEvent,
  isSubscriptionActivatedEvent,
  type WebhookEvent,
  verifyWebhookSignature,
} from "@/lib/paypal";
import { alreadyProcessed } from "@/lib/idempotency";
import { createLogger } from "@/lib/logger";

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
 */

const log = createLogger("paypal-webhook");

export async function POST(req: Request) {
  if (!getConfig()) {
    return NextResponse.json(
      { error: "PayPal not configured" },
      { status: 503 },
    );
  }

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
        log.info("PayPal add-on provisioned", {
          itemId,
          userId,
          eventId: event.id,
          family: result.family,
        });
      } else {
        log.info("PayPal payment completed (no provisioning hook)", {
          eventId: event.id,
          intent,
          itemId,
          userId,
        });
      }
    } else if (isSubscriptionActivatedEvent(event.event_type)) {
      log.info("PayPal subscription activated", {
        eventId: event.id,
        intent,
        itemId,
        userId,
      });
    } else {
      log.info("PayPal event acknowledged (no handler)", {
        eventId: event.id,
        eventType: event.event_type,
      });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
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
