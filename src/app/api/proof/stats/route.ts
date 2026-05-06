import { NextResponse } from "next/server";
import { db } from "@/db";
import { tenants, customerDeliveries } from "@/db/schema";
import { isNotNull, sql, gte } from "drizzle-orm";
import { mondayOfWeek, mondayWeeksAgo } from "@/lib/delivery-week";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";
// 5-minute revalidate. The numbers don't change minute-to-minute and
// caching keeps Neon happy if the public /proof page goes viral.
export const revalidate = 300;

const log = createLogger("proof-stats");

/**
 * GET /api/proof/stats — public, no auth.
 *
 * Returns live counts from the same tables that power /admin/customers
 * and the Monday watchdog cron, with one twist: nothing here exposes
 * any single customer's identity. The numbers are aggregate.
 *
 * Aggregates surfaced:
 *   - activeCustomers          welcomed tenants count
 *   - totalDeliveriesShipped   all-time customer_deliveries rows
 *   - leadsDelivered           sum(lead_count) all-time
 *   - thisWeekShipped          customer_deliveries rows for this Monday
 *   - last4WeeksOnTimeRate     percentage of expected deliveries
 *                              that landed on Monday vs total expected
 *                              (4-week window). 100 means perfect.
 *   - generatedAt              ISO timestamp so the UI can show it
 *
 * Designed for the /proof page + future external embeds. Caches at
 * the Vercel edge for `revalidate` seconds.
 *
 * Failure modes:
 *   - 42P01 / 42703 (table or column missing) → returns zeros + a
 *     `migrationsApplied: false` flag rather than crashing. The
 *     page can render gracefully with "Setting up — check back soon."
 *   - Any other DB error → returns 503 so the page can show a friendly
 *     placeholder.
 */

interface ProofStats {
  activeCustomers: number;
  totalDeliveriesShipped: number;
  leadsDelivered: number;
  thisWeekShipped: number;
  last4WeeksOnTimeRate: number;
  migrationsApplied: boolean;
  generatedAt: string;
}

const ZERO: ProofStats = {
  activeCustomers: 0,
  totalDeliveriesShipped: 0,
  leadsDelivered: 0,
  thisWeekShipped: 0,
  last4WeeksOnTimeRate: 0,
  migrationsApplied: false,
  generatedAt: new Date(0).toISOString(),
};

export async function GET() {
  const thisMonday = mondayOfWeek();
  const fourMondaysAgo = mondayWeeksAgo(4);

  try {
    const [
      [{ count: activeCustomers = 0 } = { count: 0 }],
      [
        { count: totalDeliveriesShipped = 0, sum: leadsDelivered = 0 } = {
          count: 0,
          sum: 0,
        },
      ],
      [{ count: thisWeekShipped = 0 } = { count: 0 }],
      [{ count: last4Weeks = 0 } = { count: 0 }],
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tenants)
        .where(isNotNull(tenants.welcomeFirstName)),
      db
        .select({
          count: sql<number>`count(*)::int`,
          sum: sql<number>`coalesce(sum(${customerDeliveries.leadCount}),0)::int`,
        })
        .from(customerDeliveries),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(customerDeliveries)
        .where(sql`${customerDeliveries.deliveryDate} = ${thisMonday}`),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(customerDeliveries)
        .where(gte(customerDeliveries.deliveryDate, fourMondaysAgo)),
    ]);

    // On-time rate over the trailing 4 Mondays:
    //   numerator   = deliveries recorded across last 4 weeks
    //   denominator = expected = activeCustomers × 4
    // (We could be more precise per-customer using their first_delivery
    // date, but at this scale the aggregate is the honest number.)
    const denom = Math.max(activeCustomers * 4, 1);
    const last4WeeksOnTimeRate = Math.round((last4Weeks / denom) * 100);

    const stats: ProofStats = {
      activeCustomers,
      totalDeliveriesShipped,
      leadsDelivered,
      thisWeekShipped,
      last4WeeksOnTimeRate: Math.min(100, last4WeeksOnTimeRate),
      migrationsApplied: true,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    });
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01" || pgCode === "42703") {
      // Migrations 0019/0020 not applied yet. Return zeros so the
      // /proof page can still render rather than 503.
      return NextResponse.json(
        { ...ZERO, generatedAt: new Date().toISOString() },
        { status: 200 },
      );
    }
    log.error("Proof stats failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not fetch stats" },
      { status: 503 },
    );
  }
}
