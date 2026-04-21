import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db";
import { subscriptions, stripeEvents } from "@/db/schema";
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

  // ─── Two-state idempotency (received → completed) ──────────────────
  // Single-state dedup has a race: insert-then-crash would cause a retry
  // to hit the duplicate path and silently skip the unprocessed event.
  // We INSERT with status='received' first, process, then UPDATE to
  // status='completed'. A duplicate-insert checks status to decide
  // whether to skip or re-process.
  //
  // Stale-received window: 5 minutes. If we see a "received" row older
  // than that, we assume the original attempt crashed and re-process.
  const STALE_RECEIVED_MS = 5 * 60 * 1000;

  let isDuplicate = false;
  try {
    await db.insert(stripeEvents).values({
      eventId: event.id,
      type: event.type,
      status: "received",
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "23505") {
      // Unique-violation — event already seen. Look up its status.
      isDuplicate = true;
      const [existing] = await db
        .select({ status: stripeEvents.status, receivedAt: stripeEvents.receivedAt })
        .from(stripeEvents)
        .where(eq(stripeEvents.eventId, event.id))
        .limit(1);

      if (!existing || existing.status === "completed") {
        log.info("Duplicate Stripe event — already completed", { eventId: event.id });
        return NextResponse.json({ received: true, duplicate: true });
      }

      // A prior attempt left the row in 'failed'. Always re-process
      // immediately — Stripe is retrying because WE told it to, and
      // the failure was ours (handler crashed). We do NOT want to
      // send Stripe a 202 here; that just rate-limits the recovery.
      if (existing.status === "failed") {
        log.warn("Re-processing failed Stripe event", { eventId: event.id });
        // Fall through to the handler.
      } else {
        // status === 'received' — a prior attempt is potentially still
        // in-flight OR crashed silently (no catch path executed).
        const receivedAt = existing.receivedAt.getTime();
        if (Date.now() - receivedAt < STALE_RECEIVED_MS) {
          // Fresh 'received' row → concurrent processing. Defer so
          // Stripe retries after the stale window elapses.
          log.info("Stripe event in-flight — deferring", { eventId: event.id });
          return NextResponse.json({ received: true, deferred: true }, { status: 202 });
        }
        // Stale 'received' row → the original attempt crashed before
        // catch-to-failed could run. Re-process.
        log.warn("Re-processing stale received Stripe event", {
          eventId: event.id,
          receivedAgoMs: Date.now() - receivedAt,
        });
      }
    } else if (code === "42P01") {
      log.warn("stripe_events table missing — run migration 0004", { eventId: event.id });
      // Continue processing; bootstrap mode.
    } else {
      log.error("Failed to record Stripe event", { eventId: event.id, error: (err as Error).message });
      // Don't block — risk a dup over losing a payment.
    }
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

          // ─── Credits: grant the plan's monthly allocation ───
          // Phase 1.5 — every successful checkout deposits
          // planDef.monthlyCreditsCents into the user's balance. The
          // `stripeEventId` in the metadata makes this idempotent if
          // Stripe retries — the credits ledger stores one row per
          // webhook delivery so duplicate topUp calls on the same
          // event_id would create a duplicate ledger row but no
          // duplicate balance increment (the stripe_events dedup
          // above short-circuits before we get here on retry).
          try {
            const { getPlan, normalizePlanId } = await import("@/lib/plans");
            const { topUp } = await import("@/lib/credits");
            const planDef = getPlan(normalizePlanId(plan));
            const cents = planDef.monthlyCreditsCents;
            if (cents > 0) {
              await topUp(userId, cents, "topup", {
                stripeEventId: event.id,
                stripeSubscriptionId: subscriptionId,
                plan,
              });
              log.info("Credits topped up on checkout", { userId, cents, plan });
            }
          } catch (creditErr) {
            // Never fail the webhook on a credits error — the
            // subscription row is already set; credits can be repaired
            // by an admin via /api/_misc/admin/credits/repair.
            log.error("Credit top-up failed (subscription activated anyway)", {
              userId,
              error: (creditErr as Error).message,
            });
          }
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
    // Handler failed mid-processing. Mark the row 'failed' so the next
    // retry treats it as a fresh attempt (after the stale window).
    const message = (err as Error).message;
    log.error("Webhook handler error", { eventType: event.type, error: message });
    try {
      await db.update(stripeEvents)
        .set({ status: "failed", errorMessage: message })
        .where(eq(stripeEvents.eventId, event.id));
    } catch {
      // Best-effort; if the table is missing we're already in bootstrap.
    }
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  // Mark completed on success. Stripe retries stop once we return 200.
  try {
    await db.update(stripeEvents)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(stripeEvents.eventId, event.id));
  } catch {
    // Bootstrap mode or concurrent race — safe to ignore.
  }

  return NextResponse.json({ received: true, duplicate: isDuplicate });
}
