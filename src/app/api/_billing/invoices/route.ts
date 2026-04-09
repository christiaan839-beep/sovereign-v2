import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";
import { createLogger } from "@/lib/logger";

const log = createLogger("billing-invoices");

/**
 * GET /api/billing/invoices
 * Returns the authenticated user's Stripe invoice history.
 *
 * Response: { invoices: [{ id, date, amount, currency, status, pdfUrl, description }] }
 *
 * Graceful degradation:
 * - No STRIPE_SECRET_KEY → 503
 * - No subscription / no stripeCustomerId → empty array
 * - Stripe API error → 502
 * - Missing subscriptions table → empty array (pre-migration)
 */
export async function GET() {
  try {
    // ── Auth ────────────────────────────────────
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required." },
        { status: 401 }
      );
    }

    // ── Stripe availability ─────────────────────
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Billing is not configured. Stripe keys are missing." },
        { status: 503 }
      );
    }

    // ── Lookup stripeCustomerId ─────────────────
    let customerId: string | null = null;
    try {
      const rows = await db
        .select({ stripeCustomerId: subscriptions.stripeCustomerId })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);

      customerId = rows[0]?.stripeCustomerId ?? null;
    } catch (dbErr: unknown) {
      // Handle missing table gracefully (pre-migration)
      const pgCode = (dbErr as { code?: string })?.code;
      if (pgCode === "42P01") {
        log.warn("subscriptions table does not exist yet", {
          hint: "Run drizzle migration to create it",
        });
        return NextResponse.json({ invoices: [] });
      }
      throw dbErr;
    }

    if (!customerId) {
      // User exists but has no Stripe customer — return empty
      return NextResponse.json({ invoices: [] });
    }

    // ── Fetch invoices from Stripe ──────────────
    let stripeInvoices;
    try {
      stripeInvoices = await stripe.invoices.list({
        customer: customerId,
        limit: 20,
      });
    } catch (stripeErr: unknown) {
      const msg =
        stripeErr instanceof Error ? stripeErr.message : "Unknown Stripe error";
      log.error("Stripe invoices.list failed", { customerId, error: msg });
      return NextResponse.json(
        { error: "Failed to fetch invoices from Stripe." },
        { status: 502 }
      );
    }

    // ── Format response ─────────────────────────
    const invoices = stripeInvoices.data.map(
      (inv: {
        id: string;
        created: number;
        amount_paid: number;
        currency: string;
        status: string | null;
        invoice_pdf: string | null;
        description: string | null;
        lines?: { data?: Array<{ description?: string | null }> };
      }) => ({
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
      })
    );

    return NextResponse.json({ invoices });
  } catch (err) {
    log.error("Billing invoices error", err as Record<string, unknown>);
    return NextResponse.json(
      { error: "Failed to retrieve invoices." },
      { status: 500 }
    );
  }
}
