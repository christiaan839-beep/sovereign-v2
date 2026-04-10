import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPublicUrl } from "@/lib/base-url";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("stripe-portal");

/**
 * STRIPE CUSTOMER PORTAL — Lets users manage their subscription.
 * Change plan, update payment method, cancel, view invoices.
 *
 * SECURITY: Caller must be authenticated. We look up their stripeCustomerId
 * from the subscriptions table — NEVER trust a client-supplied customerId
 * (that would be an IDOR vulnerability).
 */

const limiter = rateLimit({ interval: 60, limit: 10 });

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 },
    );
  }

  try {
    // Look up the caller's own Stripe customer ID — never trust the request body.
    const [sub] = await db
      .select({ stripeCustomerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (!sub?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 },
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
    });
    const appUrl = getPublicUrl();

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${appUrl}/dashboard/billing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    // Graceful handling when subscriptions table doesn't exist yet (42P01)
    if ((error as { code?: string })?.code === "42P01") {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 },
      );
    }
    log.error("Portal session creation failed", {
      userId,
      error: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Unable to open billing portal" },
      { status: 500 },
    );
  }
}
