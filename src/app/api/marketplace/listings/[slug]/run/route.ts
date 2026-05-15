/**
 * SOVEREIGN MATRIX — /api/marketplace/listings/[slug]/run (Cook 82)
 *
 * Invoke a published third-party marketplace agent. Composes:
 *
 *   - Cook 62 marketplace-core for state gating
 *   - Cook 19 banker's-rounding billing math (via splitRevenue)
 *   - existing /api/agents/<slug> for the actual run
 *
 * Pricing flow:
 *
 *   1. Listing must be `published`.
 *   2. Caller is charged `pricePerRunCents`.
 *   3. Platform takes 30%; developer gets the remainder. The split is
 *      written to the audit log; production wires Stripe Connect
 *      payout from the developer side.
 *   4. Run is dispatched via the platform's own /api/agents/<slug>
 *      so plan limits + safety pipeline + signed receipts apply.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { findBySlug } from "@/lib/marketplace-store";
import { splitRevenue } from "@/lib/marketplace-core";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("marketplace/run");

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId || "";

  const { slug } = await params;
  const listing = findBySlug(slug);
  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (listing.status !== "published") {
    return NextResponse.json(
      { error: "Listing is not available" },
      { status: 409 },
    );
  }

  let input: unknown;
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const split = splitRevenue(listing.pricePerRunCents);
  await auditLog({
    userId,
    action: "marketplace.run",
    resource: `listing:${listing.id}`,
    details: {
      slug: listing.slug,
      developer: listing.developerId,
      totalCents: split.totalCents,
      platformCents: split.platformCents,
      developerCents: split.developerCents,
    },
  });

  // Dispatch via the platform's own /api/agents/<slug>. This deliberately
  // reuses cookies + Authorization from the caller so plan limits +
  // tenant scope + safety pipeline apply — the marketplace listing is a
  // BILLING wrapper on top, not a separate execution path.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!origin) {
    log.error(
      "Marketplace run unavailable: no NEXT_PUBLIC_APP_URL / VERCEL_URL",
    );
    return NextResponse.json(
      { error: "Marketplace run unavailable" },
      { status: 503 },
    );
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";

  const res = await fetch(`${origin}/api/agents/${listing.slug}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    return NextResponse.json(
      {
        error: "Upstream agent returned non-2xx",
        status: res.status,
      },
      { status: res.status },
    );
  }
  const body = await res.json();
  return NextResponse.json({
    ok: true,
    listing: { slug: listing.slug, developer: listing.developerId },
    billing: split,
    result: body,
  });
}
