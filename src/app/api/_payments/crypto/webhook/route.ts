/**
 * POST /api/payments/crypto/webhook
 *
 * Coinbase Commerce webhook handler. The flow:
 *
 *   1. Verify HMAC-SHA256 over the RAW request body using
 *      `COINBASE_COMMERCE_WEBHOOK_SECRET`. Reject with 400 on mismatch
 *      — without verification, anyone with our URL can mint subs.
 *
 *   2. Parse the event. We only act on `charge:confirmed` (final
 *      on-chain confirmation). `charge:pending` is informational —
 *      buyer paid but we wait for N confirmations before granting
 *      access. Other event types are acknowledged with 200 so
 *      Coinbase doesn't retry.
 *
 *   3. Dedup by event.id via `alreadyProcessed`. Coinbase can fire
 *      duplicate "confirmed" events on rare chain reorgs.
 *
 *   4. Upsert the subscriptions row. Crypto charges are one-time, so
 *      we stamp `currentPeriodEnd = now + 30 days`. The plan-enforcement
 *      lib reads that and downgrades back to free after expiry.
 *
 * Setup:
 *   1. Commerce dashboard → Settings → Notifications → Add endpoint
 *   2. Endpoint URL: https://<your-host>/api/payments/crypto/webhook
 *   3. Copy the "Shared secret" into COINBASE_COMMERCE_WEBHOOK_SECRET
 *   4. Subscribe to events: charge:confirmed (required), charge:failed
 *      (optional, for audit-log entries).
 *
 * What we DON'T persist: the buyer's wallet address, the specific
 * crypto they paid in, the exchange rate at settlement. Coinbase
 * Commerce shows these in their dashboard — we just need the boolean
 * "did they pay?" to flip the sub on.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import { alreadyProcessed } from "@/lib/idempotency";
import { rateLimit } from "@/lib/rate-limit";
import {
  verifyCommerceWebhookSignature,
  fetchCommerceCharge,
  type CommerceWebhookEvent,
} from "@/lib/coinbase-commerce";
import { PLANS, type PlanId } from "@/lib/plans";

const log = createLogger("coinbase-commerce-webhook");

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// Pre-signature rate limit — blunts forged-signature spam without
// burning DB writes on attacker traffic. Generous limit because real
// Coinbase webhooks can burst.
const limiter = rateLimit({ interval: 60, limit: 60 });

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const rawBody = await req.text();
  const signature = req.headers.get("x-cc-webhook-signature");

  if (!verifyCommerceWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: CommerceWebhookEvent & { event?: CommerceWebhookEvent };
  try {
    const parsed = JSON.parse(rawBody);
    // Coinbase wraps the actual event under `{ event: {...} }` on send.
    event = parsed.event ?? parsed;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!event?.id || !event?.type) {
    return NextResponse.json({ error: "Malformed event" }, { status: 400 });
  }

  if (await alreadyProcessed("coinbase:event", event.id)) {
    log.info("Duplicate Coinbase event skipped", { eventId: event.id });
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Only act on confirmed. Acknowledge other types so Coinbase doesn't
  // retry them.
  if (event.type !== "charge:confirmed") {
    log.info("Coinbase event acknowledged (no action)", {
      eventId: event.id,
      type: event.type,
    });
    return NextResponse.json({ received: true });
  }

  const { metadata, id: chargeId, pricing } = event.data;
  const userId = metadata?.userId;
  const plan = metadata?.plan;

  if (!userId || !plan) {
    log.error("Coinbase charge missing metadata", {
      eventId: event.id,
      chargeId,
      metadata,
    });
    return NextResponse.json({ received: true, warning: "missing metadata" });
  }

  // SECURITY: validate the plan id against our whitelist using a safe
  // own-property check (not `in`, which traverses the prototype chain
  // and would treat "__proto__"/"constructor" as valid plans).
  if (!Object.prototype.hasOwnProperty.call(PLANS, plan)) {
    log.error("Coinbase charge has unknown plan", {
      eventId: event.id,
      chargeId,
      plan,
    });
    return NextResponse.json({ received: true, warning: "unknown plan" });
  }
  const planDef = PLANS[plan as PlanId];

  // SECURITY: the metadata is buyer-supplied. Without validating the
  // paid amount matches the canonical plan price, a buyer could create
  // a charge with `metadata.plan = "enterprise"` but pay only $1.
  // Coinbase Commerce fixes the local_price at charge-creation time,
  // so this also catches a forged webhook claiming a higher plan than
  // the charge actually was.
  const expectedUsd = (planDef.priceUsdCents / 100).toFixed(2);
  const paidAmount = pricing?.local?.amount;
  const paidCurrency = pricing?.local?.currency;
  if (paidCurrency !== "USD" || paidAmount !== expectedUsd) {
    log.error("Coinbase charge amount mismatch — possible tampering", {
      eventId: event.id,
      chargeId,
      plan,
      expectedUsd,
      paidAmount,
      paidCurrency,
    });
    return NextResponse.json(
      { received: true, warning: "amount mismatch" },
      { status: 200 },
    );
  }

  // DEFENSE-IN-DEPTH: refetch the charge using our API key. If the
  // event was forged with a leaked webhook secret pointing at a charge
  // created on a different merchant account, this returns null and we
  // refuse to honor the activation.
  const liveCharge = await fetchCommerceCharge(chargeId);
  if (!liveCharge) {
    log.error("Coinbase charge not found via API — refusing activation", {
      eventId: event.id,
      chargeId,
    });
    return NextResponse.json(
      { received: true, warning: "charge not found" },
      { status: 200 },
    );
  }

  try {
    const periodEnd = new Date(Date.now() + THIRTY_DAYS_MS);
    await db
      .insert(subscriptions)
      .values({
        userId,
        plan,
        status: "active",
        // We re-use stripeCustomerId for the Commerce charge code so a
        // single user lookup works for both providers. Prefix it so
        // there's no collision with a real Stripe ID.
        stripeCustomerId: `cb_${chargeId}`,
        stripeSubscriptionId: `cb_${chargeId}`,
        currentPeriodEnd: periodEnd,
      })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: {
          plan,
          status: "active",
          stripeCustomerId: `cb_${chargeId}`,
          stripeSubscriptionId: `cb_${chargeId}`,
          currentPeriodEnd: periodEnd,
          updatedAt: new Date(),
        },
      });
    log.info("Crypto subscription activated", {
      userId,
      plan,
      chargeId,
      periodEnd: periodEnd.toISOString(),
    });
  } catch (err) {
    log.error("Crypto webhook handler error", {
      eventId: event.id,
      error: (err as Error).message,
    });
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
