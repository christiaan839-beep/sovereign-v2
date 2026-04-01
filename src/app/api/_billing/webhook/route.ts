import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/db";
import { subscriptions, tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";
const log = createLogger("stripe-webhook");

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
          customer: string;
          subscription: string;
          customer_email: string | null;
          metadata?: Record<string, string>;
          client_reference_id?: string | null;
        };

        const userId = session.client_reference_id || session.metadata?.userId || "";
        const plan = session.metadata?.plan || "node";

        // Upsert subscription
        const existing = userId
          ? await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1)
          : [];

        if (existing.length > 0) {
          await db
            .update(subscriptions)
            .set({
              stripeCustomerId: session.customer as string,
              stripeSubscriptionId: session.subscription as string,
              plan,
              status: "active",
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.userId, userId));
        } else if (userId) {
          await db.insert(subscriptions).values({
            userId,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
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
          resource: session.subscription as string,
          details: { event: "checkout.session.completed", plan, customerId: session.customer },
        });

        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as {
          id: string;
          customer: string;
          status: string;
          current_period_end: number;
          metadata?: Record<string, string>;
        };

        const plan = sub.metadata?.plan || "node";

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
          userId: sub.customer as string,
          action: "subscription.change",
          resource: sub.id,
          details: { event: "customer.subscription.updated", plan, status: sub.status },
        });

        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as { id: string; customer: string };

        await db
          .update(subscriptions)
          .set({
            plan: "free",
            status: "canceled",
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.stripeSubscriptionId, sub.id));

        // Downgrade tenant to free
        const subRow = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.stripeCustomerId, sub.customer as string))
          .limit(1);

        if (subRow[0]?.userId) {
          await db
            .update(tenants)
            .set({ plan: "free" })
            .where(eq(tenants.clerkUserId, subRow[0].userId));
        }

        await auditLog({
          userId: subRow[0]?.userId || sub.customer as string,
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
