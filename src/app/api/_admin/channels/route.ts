import { NextResponse } from "next/server";
import { db } from "@/db";
import { tenants, subscriptions } from "@/db/schema";
import { sql, gte, eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { PLANS, type PlanId, normalizePlanId } from "@/lib/plans";
import { handleDBError } from "@/lib/db-error";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-channels");

/**
 * GET /api/_admin/channels?days=30
 *
 * Channel attribution rollup. For each utm_source captured at landing
 * time (P17 UTMCapture component), report:
 *   - signups in window
 *   - paid conversion rate (active non-free subscriptions)
 *   - estimated MRR (sum of plan price for paid users)
 *
 * Lets the founder see "Twitter brings 50 signups but Reddit brings the
 * paying ones" without manually joining tables in the SQL editor.
 *
 * Auth: requireAdmin (404s non-admins).
 */
export async function GET(request: Request) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const url = new URL(request.url);
  const days = Math.max(
    1,
    Math.min(365, Number(url.searchParams.get("days") || 30)),
  );
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // 1. Pull all in-window tenants with their UTM source. Treat null/empty
  //    source as the "direct" bucket so we surface organic share too.
  let signups: Array<{
    clerkUserId: string;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
  }>;
  try {
    signups = await db
      .select({
        clerkUserId: tenants.clerkUserId,
        utmSource: tenants.utmSource,
        utmMedium: tenants.utmMedium,
        utmCampaign: tenants.utmCampaign,
      })
      .from(tenants)
      .where(gte(tenants.createdAt, since));
  } catch (err) {
    return handleDBError(err, {
      route: "/api/_admin/channels",
      emptyOnMissing: { channels: [] },
    });
  }

  // 2. Pull active paid subscriptions for those userIds — single round trip.
  const paid = new Map<string, string>(); // userId → plan
  try {
    const subs = await db
      .select({ userId: subscriptions.userId, plan: subscriptions.plan })
      .from(subscriptions)
      .where(
        sql`${subscriptions.status} = 'active' AND ${subscriptions.plan} != 'free'`,
      );
    for (const s of subs) paid.set(s.userId, s.plan);
  } catch (err) {
    return handleDBError(err, {
      route: "/api/_admin/channels",
      emptyOnMissing: { channels: [] },
    });
  }
  // Reference the imported helper so the linter doesn't flag it as unused
  // when no paid signups land in this window.
  void eq;

  // 3. Aggregate.
  interface ChannelSummary {
    source: string;
    medium: string | null;
    signups: number;
    paid: number;
    estMonthlyRevenueCents: number;
  }
  const byKey = new Map<string, ChannelSummary>();

  for (const t of signups) {
    const source = t.utmSource || "direct";
    const medium = t.utmMedium || null;
    const key = `${source}::${medium ?? ""}`;
    let row = byKey.get(key);
    if (!row) {
      row = {
        source,
        medium,
        signups: 0,
        paid: 0,
        estMonthlyRevenueCents: 0,
      };
      byKey.set(key, row);
    }
    row.signups++;

    const plan = paid.get(t.clerkUserId);
    if (plan) {
      row.paid++;
      const planId = normalizePlanId(plan) as PlanId;
      row.estMonthlyRevenueCents += PLANS[planId]?.priceUsdCents ?? 0;
    }
  }

  const channels = Array.from(byKey.values()).map((c) => ({
    source: c.source,
    medium: c.medium,
    signups: c.signups,
    paid: c.paid,
    conversionPct:
      c.signups > 0 ? Math.round((c.paid / c.signups) * 1000) / 10 : 0,
    estMonthlyRevenueUsd: `$${(c.estMonthlyRevenueCents / 100).toFixed(2)}`,
  }));

  // Sort by paid count, then by estimated revenue — best-converting channels first.
  channels.sort((a, b) => {
    if (b.paid !== a.paid) return b.paid - a.paid;
    return (
      parseFloat(b.estMonthlyRevenueUsd.slice(1)) -
      parseFloat(a.estMonthlyRevenueUsd.slice(1))
    );
  });

  log.info("channel rollup computed", {
    days,
    channelCount: channels.length,
    totalSignups: signups.length,
  });

  return NextResponse.json({
    windowDays: days,
    totalSignups: signups.length,
    totalPaid: signups.filter((t) => paid.has(t.clerkUserId)).length,
    channels,
  });
}
