import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createPortalSession } from "@/lib/stripe";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
const log = createLogger("billing-portal");

/**
 * POST /api/billing/portal
 * Creates a Stripe Customer Portal session so users can manage their subscription.
 */
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    // Look up the Stripe customer ID from subscriptions table
    const rows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    const sub = rows[0];
    if (!sub?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found. Subscribe to a plan first." },
        { status: 404 }
      );
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const url = await createPortalSession(sub.stripeCustomerId, `${origin}/dashboard/billing`);

    if (!url) {
      return NextResponse.json(
        { error: "Stripe is not configured. Set STRIPE_SECRET_KEY in your environment." },
        { status: 503 }
      );
    }

    return NextResponse.json({ url });
  } catch (err) {
    log.error("Billing portal error", err as Record<string, unknown>);
    return NextResponse.json({ error: "Failed to create portal session." }, { status: 500 });
  }
}
