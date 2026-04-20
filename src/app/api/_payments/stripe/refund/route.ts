import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import {
  extractIdempotencyKey,
  beginIdempotentStrict,
  commitIdempotent,
} from "@/lib/idempotency";

const log = createLogger("payments:refund");

/**
 * POST /api/_payments/stripe/refund
 *
 * 14-day unconditional refund eligibility check + automatic refund.
 *
 * Eligibility:
 *   - User is authenticated (Clerk)
 *   - Their first subscription invoice is within 14 days of submission
 *   - The subscription hasn't been refunded before (idempotency by
 *     checking existing refunds on the invoice)
 *
 * We refund the most recent invoice (full amount) and cancel the
 * subscription. A human-confirmation email goes to the founder's
 * inbox so the record is tracked outside Stripe.
 *
 * This endpoint is SELF-SERVE — users hit it from a dashboard button
 * OR they email refunds@sovereignmatrix.agency which triggers a
 * manual reply + this same flow.
 */

const REFUND_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Idempotency (STRICT) ──
  // Refunds are the canonical use case. A user double-clicking "Refund"
  // must not issue two refunds. We scope the idempotency key to
  // /refund + user.id so a given user can't replay another user's key.
  //
  // fail-CLOSED: if the idempotency store is down (table missing, DB
  // unreachable), we refuse to proceed rather than risk double-refund.
  // The client sees 503 and retries later.
  let idempotencyKey: string | null = null;
  const clientKey = extractIdempotencyKey(req.headers);
  if (clientKey) {
    const endpoint = `refund::${user.id}`;
    try {
      const result = await beginIdempotentStrict(clientKey, endpoint);
      idempotencyKey = result.key;
      if (result.replay && result.cached) {
        return NextResponse.json(result.cached.body, { status: result.cached.status });
      }
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "IDEMPOTENCY_STORE_DOWN") {
        log.error("Refund blocked: idempotency store down", { userId: user.id });
        return NextResponse.json(
          {
            error:
              "Refund temporarily unavailable. Please retry in a few minutes or email refunds@sovereignmatrix.agency.",
            code: "IDEMPOTENCY_STORE_DOWN",
          },
          { status: 503 },
        );
      }
      throw err;
    }
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json(
      { error: "Refunds are not yet wired in this environment. Email refunds@sovereignmatrix.agency to process manually." },
      { status: 503 },
    );
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion });

  // Find user's subscription
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, user.id))
    .limit(1);

  if (!sub || !sub.stripeCustomerId || !sub.stripeSubscriptionId) {
    return NextResponse.json({ error: "No active subscription found for this account." }, { status: 404 });
  }

  // Check first-invoice age via Stripe (source of truth, not our DB)
  let stripeSub: Stripe.Subscription;
  try {
    stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  } catch (err) {
    log.error("Stripe subscription retrieve failed", { userId: user.id, error: (err as Error).message });
    return NextResponse.json({ error: "Unable to verify subscription. Email refunds@sovereignmatrix.agency." }, { status: 502 });
  }

  // `start_date` is the subscription's creation timestamp (Unix seconds)
  const startedAtMs = stripeSub.start_date * 1000;
  const ageMs = Date.now() - startedAtMs;

  if (ageMs > REFUND_WINDOW_MS) {
    return NextResponse.json({
      error: "Your subscription is outside the 14-day refund window. You can still cancel anytime from Settings → Billing to avoid future charges.",
      eligibleUntil: new Date(startedAtMs + REFUND_WINDOW_MS).toISOString(),
      ageDays: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
    }, { status: 400 });
  }

  // Find the most recent paid invoice on this subscription
  let invoices: Stripe.Invoice[];
  try {
    const list = await stripe.invoices.list({
      customer: sub.stripeCustomerId,
      subscription: sub.stripeSubscriptionId,
      status: "paid",
      limit: 1,
    });
    invoices = list.data;
  } catch (err) {
    log.error("Stripe invoices list failed", { userId: user.id, error: (err as Error).message });
    return NextResponse.json({ error: "Unable to list invoices." }, { status: 502 });
  }

  if (invoices.length === 0) {
    return NextResponse.json(
      { error: "No paid invoice found to refund. You may not have been charged yet." },
      { status: 404 },
    );
  }

  const invoice = invoices[0];

  // Stripe 2025-04-30 API moved payment_intent off the Invoice shape into
  // a separate payments list. Expand `payments` on the invoice retrieval
  // or list its payments.
  let paymentIntentId: string | null = null;
  try {
    const payments = await stripe.invoicePayments.list({ invoice: invoice.id, limit: 1 });
    const paid = payments.data.find((p) => p.status === "paid");
    const pi = paid?.payment?.payment_intent;
    paymentIntentId = typeof pi === "string" ? pi : pi?.id ?? null;
  } catch (err) {
    log.warn("Could not resolve payment intent via invoicePayments.list", { error: (err as Error).message });
  }

  if (!paymentIntentId) {
    return NextResponse.json(
      { error: "Invoice has no linked payment intent. Email refunds@sovereignmatrix.agency." },
      { status: 502 },
    );
  }

  // Idempotency: check if this payment was already refunded
  try {
    const existingRefunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 1 });
    if (existingRefunds.data.length > 0) {
      return NextResponse.json(
        {
          error: "A refund was already processed for this subscription.",
          refundId: existingRefunds.data[0].id,
        },
        { status: 409 },
      );
    }
  } catch (err) {
    log.warn("refund-idempotency check failed; proceeding", { error: (err as Error).message });
  }

  // Fire the refund
  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: "requested_by_customer",
      metadata: {
        userId: user.id,
        source: "14-day-unconditional",
      },
    });
  } catch (err) {
    log.error("Stripe refund create failed", { userId: user.id, error: (err as Error).message });
    return NextResponse.json({ error: "Refund processing failed. Email refunds@sovereignmatrix.agency." }, { status: 502 });
  }

  // Cancel the subscription at period end (customer keeps access for the
  // remainder of what they paid for — they got their money back, we
  // don't yank access mid-period).
  try {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: true });
  } catch (err) {
    log.warn("Subscription cancel-at-period-end failed after refund", { error: (err as Error).message });
  }

  // Update our local subscription row
  try {
    await db
      .update(subscriptions)
      .set({ status: "refunded", updatedAt: new Date() })
      .where(eq(subscriptions.userId, user.id));
  } catch (err) {
    log.warn("Local subscription update after refund failed", { error: (err as Error).message });
  }

  log.info("Refund processed", {
    userId: user.id,
    refundId: refund.id,
    amount: refund.amount,
    currency: refund.currency,
  });

  const successBody = {
    ok: true,
    refundId: refund.id,
    amountRefunded: refund.amount,
    currency: refund.currency,
    status: refund.status,
    note: "Refund submitted to your original payment method. Most banks process within 5 business days. Your account access continues until the end of the current billing period.",
  };

  // Persist the response into the idempotency record so a retry with
  // the same key returns this exact payload instead of re-triggering
  // Stripe.
  if (idempotencyKey) {
    await commitIdempotent(idempotencyKey, 200, successBody);
  }

  return NextResponse.json(successBody);
}
