import { NextResponse } from "next/server";
import Stripe from "stripe";
import { db } from "@/db";
import { subscriptions, affiliates, referrals } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { alreadyProcessed } from "@/lib/idempotency";
import { PLANS, type PlanId, normalizePlanId } from "@/lib/plans";

const log = createLogger("stripe-webhook");

// Reject events older than 5 minutes (replay protection).
const MAX_EVENT_AGE_SECONDS = 5 * 60;

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
function stripeId<T extends { id: string }>(
  field: string | T | null | undefined,
): string | null {
  if (!field) return null;
  return typeof field === "string" ? field : field.id;
}

export async function POST(req: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook not configured" },
      { status: 503 },
    );
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
  });
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

  // Replay protection: reject events significantly older than now.
  const eventAgeSeconds = Math.floor(Date.now() / 1000) - event.created;
  if (eventAgeSeconds > MAX_EVENT_AGE_SECONDS) {
    log.error("Stale Stripe event rejected", {
      eventId: event.id,
      ageSeconds: eventAgeSeconds,
    });
    return NextResponse.json({ error: "Stale event" }, { status: 400 });
  }

  // Idempotency: Stripe retries events on 5xx, so dedup by event.id.
  if (await alreadyProcessed("stripe:event", event.id)) {
    log.info("Duplicate Stripe event skipped", { eventId: event.id });
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const plan = session.metadata?.plan || "node";
        const userId = session.metadata?.userId;
        const referrerUserId = session.metadata?.referrerUserId;
        const customerId = stripeId(session.customer);
        const subscriptionId = stripeId(session.subscription);
        if (userId) {
          await db
            .insert(subscriptions)
            .values({
              userId,
              plan,
              status: "active",
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
            })
            .onConflictDoUpdate({
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

          // ── Affiliate attribution: if a valid referrer was carried through
          // checkout metadata, credit the referral. Idempotent per (affiliate, referredUser).
          if (referrerUserId && referrerUserId !== userId) {
            try {
              const [affiliate] = await db
                .select()
                .from(affiliates)
                .where(eq(affiliates.userId, referrerUserId))
                .limit(1);

              if (affiliate) {
                // Compute monthly revenue in cents from plans.ts (single source of truth)
                const planId = normalizePlanId(plan) as PlanId;
                const monthlyCents = PLANS[planId]?.priceUsdCents ?? 0;
                const commissionCents = Math.floor(
                  (monthlyCents * (affiliate.commissionRate || 20)) / 100,
                );

                // Idempotent insert: unique index on (affiliate_id, referred_user_id)
                // means a Stripe replay past the event-id window cannot double-credit.
                // .returning() yields zero rows on conflict, so we only bump
                // aggregates when this is genuinely the first credit.
                const customerEmail = session.customer_details?.email || "";
                const inserted = await db
                  .insert(referrals)
                  .values({
                    affiliateId: affiliate.id,
                    referredUserId: userId,
                    referredEmail: customerEmail,
                    plan,
                    revenue: monthlyCents,
                    status: "active",
                    convertedAt: new Date(),
                  })
                  .onConflictDoNothing({
                    target: [referrals.affiliateId, referrals.referredUserId],
                  })
                  .returning({ id: referrals.id });

                if (inserted.length > 0) {
                  await db
                    .update(affiliates)
                    .set({
                      totalReferrals: sql`${affiliates.totalReferrals} + 1`,
                      totalEarnings: sql`${affiliates.totalEarnings} + ${commissionCents}`,
                    })
                    .where(eq(affiliates.id, affiliate.id));

                  log.info("Referral credited", {
                    affiliateId: affiliate.id,
                    referredUserId: userId,
                    plan,
                    commissionCents,
                  });
                } else {
                  log.info("Referral already credited (idempotent skip)", {
                    affiliateId: affiliate.id,
                    referredUserId: userId,
                  });
                }
              } else {
                log.warn("Referrer userId not found in affiliates table", {
                  referrerUserId,
                });
              }
            } catch (err) {
              // Webhook must always 200; affiliate is non-critical to subscription creation
              log.error("Affiliate attribution failed (non-fatal)", {
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = stripeId(sub.customer);
        if (stripeCustomerId) {
          await db
            .update(subscriptions)
            .set({
              status:
                sub.status === "active"
                  ? "active"
                  : sub.status === "past_due"
                    ? "past_due"
                    : "inactive",
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.stripeCustomerId, stripeCustomerId));
          log.info("Subscription updated", {
            stripeCustomerId,
            status: sub.status,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const stripeCustomerId = stripeId(sub.customer);
        if (stripeCustomerId) {
          await db
            .update(subscriptions)
            .set({
              status: "cancelled",
              plan: "free",
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.stripeCustomerId, stripeCustomerId));
          log.info("Subscription cancelled — downgraded to free", {
            stripeCustomerId,
          });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeCustomerId = stripeId(invoice.customer);
        if (stripeCustomerId) {
          await db
            .update(subscriptions)
            .set({
              status: "past_due",
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.stripeCustomerId, stripeCustomerId));
          log.error("Payment failed", {
            stripeCustomerId,
            invoiceId: invoice.id,
          });
        }
        break;
      }
    }
  } catch (err) {
    log.error("Webhook handler error", {
      eventType: event.type,
      error: (err as Error).message,
    });
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
