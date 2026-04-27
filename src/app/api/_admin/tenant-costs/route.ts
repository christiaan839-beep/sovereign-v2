import { NextResponse } from "next/server";
import { db } from "@/db";
import { usage, subscriptions } from "@/db/schema";
import { sql, gte } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { PLANS, type PlanId, normalizePlanId } from "@/lib/plans";
import {
  tokenCostMicros,
  microsToUsdString,
  DEFAULT_TOKENS_PER_CALL,
} from "@/lib/model-rate-card";
import { handleDBError } from "@/lib/db-error";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-tenant-costs");

/**
 * GET /api/_admin/tenant-costs?days=30
 *
 * Per-tenant infra spend + subscription revenue + gross margin for the
 * trailing window. Aggregates from the `usage` table by (userId, model)
 * and applies the model rate card. This is the answer enterprise buyers
 * (and the operator) ask first: "what does each customer ACTUALLY cost
 * to serve, and what's the margin?"
 *
 * Auth: requireAdmin (ADMIN_USER_IDS allowlist; returns 404 to non-admins).
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

  let rows: Array<{ userId: string; model: string; calls: number }>;
  try {
    rows = await db
      .select({
        userId: usage.userId,
        model: usage.model,
        calls: sql<number>`count(*)::int`,
      })
      .from(usage)
      .where(gte(usage.createdAt, since))
      .groupBy(usage.userId, usage.model);
  } catch (err) {
    return handleDBError(err, {
      route: "/api/_admin/tenant-costs",
      emptyOnMissing: { tenants: [] },
    });
  }

  let subs: Array<{ userId: string; plan: string }>;
  try {
    subs = await db
      .select({ userId: subscriptions.userId, plan: subscriptions.plan })
      .from(subscriptions);
  } catch (err) {
    return handleDBError(err, {
      route: "/api/_admin/tenant-costs",
      emptyOnMissing: { tenants: [] },
    });
  }

  // ── Aggregate ──
  const planByUser = new Map<string, string>();
  for (const s of subs) planByUser.set(s.userId, s.plan);

  interface TenantSummary {
    userId: string;
    plan: string;
    monthlyRevenueUsdMicros: number;
    totalCalls: number;
    infraCostUsdMicros: number;
    grossMarginUsdMicros: number;
    grossMarginPct: number;
    byModel: Array<{ model: string; calls: number; costUsd: string }>;
  }

  const summaryByUser = new Map<string, TenantSummary>();
  for (const row of rows) {
    const planName = planByUser.get(row.userId) || "free";
    const planId = normalizePlanId(planName) as PlanId;
    let s = summaryByUser.get(row.userId);
    if (!s) {
      s = {
        userId: row.userId,
        plan: planName,
        monthlyRevenueUsdMicros: (PLANS[planId]?.priceUsdCents ?? 0) * 10_000,
        totalCalls: 0,
        infraCostUsdMicros: 0,
        grossMarginUsdMicros: 0,
        grossMarginPct: 0,
        byModel: [],
      };
      summaryByUser.set(row.userId, s);
    }
    const cost =
      tokenCostMicros(row.model, DEFAULT_TOKENS_PER_CALL) * row.calls;
    s.totalCalls += row.calls;
    s.infraCostUsdMicros += cost;
    s.byModel.push({
      model: row.model,
      calls: row.calls,
      costUsd: microsToUsdString(cost),
    });
  }

  // Compute margin and convert to display strings.
  const tenants = Array.from(summaryByUser.values()).map((s) => {
    s.grossMarginUsdMicros = s.monthlyRevenueUsdMicros - s.infraCostUsdMicros;
    s.grossMarginPct =
      s.monthlyRevenueUsdMicros > 0
        ? Math.round(
            ((s.monthlyRevenueUsdMicros - s.infraCostUsdMicros) /
              s.monthlyRevenueUsdMicros) *
              1000,
          ) / 10
        : 0;
    return {
      userId: s.userId,
      plan: s.plan,
      monthlyRevenueUsd: microsToUsdString(s.monthlyRevenueUsdMicros),
      totalCalls: s.totalCalls,
      infraCostUsd: microsToUsdString(s.infraCostUsdMicros),
      grossMarginUsd: microsToUsdString(s.grossMarginUsdMicros),
      grossMarginPct: s.grossMarginPct,
      byModel: s.byModel.sort((a, b) => b.calls - a.calls),
    };
  });

  // Sort: highest infra cost first (most likely to surface concerning accounts)
  tenants.sort((a, b) => {
    const am = parseFloat(a.infraCostUsd.replace("$", ""));
    const bm = parseFloat(b.infraCostUsd.replace("$", ""));
    return bm - am;
  });

  // Platform totals
  const totalRevenueMicros = Array.from(summaryByUser.values()).reduce(
    (acc, s) => acc + s.monthlyRevenueUsdMicros,
    0,
  );
  const totalInfraMicros = Array.from(summaryByUser.values()).reduce(
    (acc, s) => acc + s.infraCostUsdMicros,
    0,
  );
  const blendedMargin =
    totalRevenueMicros > 0
      ? Math.round(
          ((totalRevenueMicros - totalInfraMicros) / totalRevenueMicros) * 1000,
        ) / 10
      : 0;

  log.info("tenant-costs computed", {
    days,
    tenantCount: tenants.length,
    blendedMarginPct: blendedMargin,
  });

  return NextResponse.json({
    windowDays: days,
    tenantCount: tenants.length,
    platformTotals: {
      revenueUsd: microsToUsdString(totalRevenueMicros),
      infraCostUsd: microsToUsdString(totalInfraMicros),
      grossMarginUsd: microsToUsdString(totalRevenueMicros - totalInfraMicros),
      blendedMarginPct: blendedMargin,
    },
    tenants,
  });
}
