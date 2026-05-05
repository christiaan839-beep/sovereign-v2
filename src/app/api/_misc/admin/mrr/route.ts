import { NextResponse } from "next/server";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { getPlan, normalizePlanId } from "@/lib/plans";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin:mrr");

/**
 * GET /api/_misc/admin/mrr
 *
 * Admin-only revenue snapshot. Aggregates the `subscriptions` table
 * by plan, multiplies by the canonical price from `plans.ts`, and
 * returns total MRR + per-plan breakdown.
 *
 * Designed for the "make money this month" loop — the operator can
 * curl this endpoint or hit it from a custom dashboard widget without
 * spinning up a full analytics tool.
 *
 *   curl -H "Cookie: __session=…" https://sovereignmatrix.agency/api/_misc/admin/mrr
 *
 * Returns:
 *   {
 *     ok: true,
 *     mrrCents: 12345,
 *     mrrUsd: 123.45,
 *     activeSubscribers: 7,
 *     byPlan: { starter: { count: 4, mrrCents: 7600 }, ... },
 *     timestamp: "2026-05-05T18:30:00.000Z"
 *   }
 */
export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  try {
    const rows = await db
      .select({
        plan: subscriptions.plan,
        count: sql<number>`count(*)`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"))
      .groupBy(subscriptions.plan);

    let mrrCents = 0;
    let activeSubscribers = 0;
    const byPlan: Record<string, { count: number; mrrCents: number }> = {};

    for (const row of rows) {
      const planId = normalizePlanId(row.plan);
      const def = getPlan(planId);
      const count = Number(row.count ?? 0);
      const planMrr = def.priceUsdCents * count;
      activeSubscribers += count;
      mrrCents += planMrr;
      byPlan[planId] = { count, mrrCents: planMrr };
    }

    return NextResponse.json({
      ok: true,
      mrrCents,
      mrrUsd: mrrCents / 100,
      activeSubscribers,
      byPlan,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01") {
      return NextResponse.json({
        ok: true,
        mrrCents: 0,
        mrrUsd: 0,
        activeSubscribers: 0,
        byPlan: {},
        note: "subscriptions table not yet migrated",
        timestamp: new Date().toISOString(),
      });
    }
    log.error("MRR query failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "MRR query failed" }, { status: 500 });
  }
}
