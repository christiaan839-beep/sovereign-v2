import { NextResponse } from "next/server";
import {
  verifyYocoWebhook,
  getYocoPayment,
  getYocoCheckout,
} from "@/lib/payments";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import { auditLog } from "@/lib/audit-log";
import { alreadyProcessed } from "@/lib/idempotency";

const log = createLogger("yoco-webhook");

/**
 * Yoco Webhook — Handles payment confirmations from Yoco.
 *
 * Uses the Standard Webhooks format (https://www.standardwebhooks.com/):
 *   Headers: webhook-id, webhook-timestamp, webhook-signature
 *
 * Supports two payload shapes:
 *   1. PaymentCreated (new API): { business_id, event_type, order_id, payment_id }
 *      → Requires API lookup to resolve metadata (plan, email).
 *   2. Legacy: { type: "payment.succeeded", payload: { metadata: {...} } }
 *      → Metadata is inline in the payload.
 */
export async function POST(req: Request) {
  if (!process.env.YOCO_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Yoco webhook not configured" },
      { status: 503 },
    );
  }

  const body = await req.text();
  const id = req.headers.get("webhook-id") || "";
  const timestamp = req.headers.get("webhook-timestamp") || "";
  const signature = req.headers.get("webhook-signature") || "";

  if (!verifyYocoWebhook(body, { id, timestamp, signature })) {
    log.error("Yoco webhook signature verification failed", { id, timestamp });
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  // Idempotency. Yoco follows Standard Webhooks
  // (https://www.standardwebhooks.com/) and `webhook-id` is the
  // canonical unique event identifier. Without this guard a duplicate
  // delivery (Yoco retries on any non-2xx for up to 24h) would
  // re-upsert the subscription row and re-fire the audit log entry.
  // The DB upsert is technically idempotent, but the audit row isn't,
  // and a duplicate "subscription.change" entry is a real legibility
  // problem when reading the audit trail post-incident.
  if (id && (await alreadyProcessed("yoco", id))) {
    log.info("Skipping duplicate Yoco webhook", { id });
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const event = JSON.parse(body) as {
      type?: string;
      event_type?: string;
      business_id?: string;
      order_id?: string;
      payment_id?: string;
      payload?: {
        metadata?: Record<string, string>;
        amount?: number;
        currency?: string;
      };
    };

    // Normalize event type between legacy (`type`) and new (`event_type`).
    const eventType = event.event_type || event.type || "";
    const isSuccess =
      eventType === "payment.succeeded" || eventType === "payment.created";

    if (!isSuccess) {
      log.info("Yoco webhook received (ignored)", { eventType });
      return NextResponse.json({ received: true, ignored: true });
    }

    // Resolve metadata: inline (legacy) or via API lookup (new format).
    let metadata: Record<string, string> = event.payload?.metadata || {};
    if (!metadata.email && event.payment_id) {
      const payment = await getYocoPayment(event.payment_id);
      metadata = { ...(payment?.metadata || {}), ...metadata };
    }
    if (!metadata.email && event.order_id) {
      const checkout = await getYocoCheckout(event.order_id);
      metadata = { ...(checkout?.metadata || {}), ...metadata };
    }

    const email = metadata.email;
    const plan = metadata.plan || "node";

    if (!email) {
      log.error("Yoco webhook missing email metadata", {
        eventType,
        paymentId: event.payment_id,
        orderId: event.order_id,
      });
      // Return 200 so Yoco doesn't retry — this is a config issue, not transient.
      return NextResponse.json({
        received: true,
        warning: "No email in metadata",
      });
    }

    await db
      .insert(subscriptions)
      .values({
        userId: email,
        plan,
        status: "active",
      })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: { plan, status: "active", updatedAt: new Date() },
      });

    await auditLog({
      userId: email,
      action: "subscription.change",
      resource: plan,
      details: {
        provider: "yoco",
        event: eventType,
        paymentId: event.payment_id,
        orderId: event.order_id,
      },
    });

    log.info("Yoco payment succeeded", {
      email,
      plan,
      paymentId: event.payment_id,
    });
    return NextResponse.json({ received: true });
  } catch (err) {
    log.error("Yoco webhook processing failed", err as Record<string, unknown>);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
