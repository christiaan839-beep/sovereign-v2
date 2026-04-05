import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { subscriptions, tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";
const log = createLogger("stripe-webhook");

/**
 * Extract a Stripe resource ID from a field that may be `string | ExpandedObject | null`.
 * Never use `.toString()` on Stripe objects — it returns "[object Object]" and silently
 * breaks DB queries. Also protects against accidentally adding `expand: [...]` later.
 */
function stripeId<T extends { id: string }>(field: string | T | null | undefined): string | null {
  if (!field) return null;
  return typeof field === "string" ? field : field.id;
}

/**
 * POST /api/billing/webhook
 * Handles incoming Stripe webhook events.
 *
 * Events handled:
 * - checkout.session.completed  -> create/update subscription record, upgrade tenant plan
 * - customer.subscription.updated -> sync plan changes
 * - customer.subscription.deleted -> downgrade to free
 */
export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    log.error("Signature verification failed", err as Record<string, unknown>);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as {
          customer: string | { id: string } | null;
          subscription: string | { id: string } | null;
          customer_email: string | null;
          metadata?: Record<string, string>;
          client_reference_id?: string | null;
        };

        const userId = session.client_reference_id || session.metadata?.userId || "";
        const plan = session.metadata?.plan || "node";
        const customerId = stripeId(session.customer);
        const subscriptionId = stripeId(session.subscription);

        // Upsert subscription
        const existing = userId
          ? await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1)
          : [];

        if (existing.length > 0) {
          await db
            .update(subscriptions)
            .set({
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              plan,
              status: "active",
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.userId, userId));
        } else if (userId) {
          await db.insert(subscriptions).values({
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            plan,
            status: "active",
          });
        }

        // Update tenant plan if applicable
        if (userId) {
          await db
            .update(tenants)
            .set({ plan })
            .where(eq(tenants.clerkUserId, userId));
        }

        await auditLog({
          userId: userId || "unknown",
          action: "subscription.change",
          resource: subscriptionId || "unknown",
          details: { event: "checkout.session.completed", plan, customerId },
        });

        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as {
          id: string;
          customer: string | { id: string } | null;
          status: string;
          current_period_end: number;
          metadata?: Record<string, string>;
        };

        const plan = sub.metadata?.plan || "node";
        const customerId = stripeId(sub.customer);

        await db
          .update(subscriptions)
          .set({
            plan,
            status: sub.status,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.stripeSubscriptionId, sub.id));

        await auditLog({
          userId: customerId || "unknown",
          action: "subscription.change",
          resource: sub.id,
          details: { event: "customer.subscription.updated", plan, status: sub.status },
        });

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as { id: string; customer: string | { id: string } | null };
        const customerId = stripeId(sub.customer);

        await db
          .update(subscriptions)
          .set({
            plan: "free",
            status: "canceled",
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.stripeSubscriptionId, sub.id));

        // Downgrade tenant to free
        const subRow = customerId
          ? await db
              .select()
              .from(subscriptions)
              .where(eq(subscriptions.stripeCustomerId, customerId))
              .limit(1)
          : [];

        if (subRow[0]?.userId) {
          await db
            .update(tenants)
            .set({ plan: "free" })
            .where(eq(tenants.clerkUserId, subRow[0].userId));
        }

        await auditLog({
          userId: subRow[0]?.userId || customerId || "unknown",
          action: "subscription.change",
          resource: sub.id,
          details: { event: "customer.subscription.deleted", plan: "free", status: "canceled" },
        });

        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    log.error("Processing error", err as Record<string, unknown>);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
