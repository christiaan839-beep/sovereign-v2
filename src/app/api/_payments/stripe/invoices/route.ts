import { NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("stripe-invoices");

/**
 * GET /api/payments/stripe/invoices — the caller's Stripe invoice history.
 *
 * Replaces the retired /api/_billing/invoices (untyped SDK, unroutable
 * behind the webpackIgnore proxy). Feeds the Payment History table on
 * /dashboard/billing.
 *
 * SECURITY: Caller must be authenticated; the Stripe customer is resolved
 * from THEIR subscriptions row — a client-supplied customerId is never
 * accepted (IDOR).
 *
 * Response: { invoices: [{ id, date, amount, currency, status, pdfUrl, description }] }
 * - date: ISO string, amount: integer cents. Display formatting is the UI's job.
 * - No subscription / no customer / missing table → { invoices: [] } (empty state, not an error).
 */

const limiter = rateLimit({ interval: 60, limit: 10 });

export async function GET(req: Request) {
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
    const [sub] = await db
      .select({ stripeCustomerId: subscriptions.stripeCustomerId })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (!sub?.stripeCustomerId) {
      return NextResponse.json({ invoices: [] });
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-04-30.basil" as Stripe.LatestApiVersion,
    });

    const result = await stripe.invoices.list({
      customer: sub.stripeCustomerId,
      limit: 20,
    });

    const invoices = result.data.map((inv) => ({
      id: inv.id,
      date: new Date(inv.created * 1000).toISOString(),
      amount: inv.amount_paid,
      currency: inv.currency,
      status: inv.status ?? "unknown",
      pdfUrl: inv.invoice_pdf ?? null,
      description:
        inv.description ??
        inv.lines?.data?.[0]?.description ??
        "Sovereign Matrix subscription",
    }));

    return NextResponse.json({ invoices });
  } catch (error) {
    // Graceful handling when subscriptions table doesn't exist yet (42P01)
    if ((error as { code?: string })?.code === "42P01") {
      return NextResponse.json({ invoices: [] });
    }
    log.error("Invoice fetch failed", {
      userId,
      error: (error as Error).message,
    });
    return NextResponse.json(
      { error: "Unable to fetch invoices" },
      { status: 500 },
    );
  }
}
