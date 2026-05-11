/**
 * GET /api/admin/spend
 *
 * Admin-only AI spend dashboard. Answers two questions in O(1):
 *   1. "Who's burning budget right now?" — top 25 users today by cost cents
 *   2. "How much have I spent in total today?" — platform-wide rollup
 *
 * Backed by the `usage` table populated by budget-controls.recordSpend
 * (or cost-ledger.recordLedgerEntry, which delegates to the same write).
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { usage } from "@/db/schema";
import { gte, sql } from "drizzle-orm";
import { getTopSpenders } from "@/lib/budget-controls";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-spend");

export const dynamic = "force-dynamic";

function dayStartUtc(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

function monthStartUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

interface PlatformTotals {
  todayCents: number;
  todayCalls: number;
  monthCents: number;
  monthCalls: number;
  uniqueUsersToday: number;
}

async function getPlatformTotals(): Promise<PlatformTotals> {
  try {
    const dayStart = dayStartUtc();
    const monthStart = monthStartUtc();

    const [todayRow] = await db
      .select({
        cents: sql<number>`COALESCE(SUM(${usage.costCents}), 0)::int`,
        calls: sql<number>`COUNT(*)::int`,
        users: sql<number>`COUNT(DISTINCT ${usage.userId})::int`,
      })
      .from(usage)
      .where(gte(usage.createdAt, dayStart));

    const [monthRow] = await db
      .select({
        cents: sql<number>`COALESCE(SUM(${usage.costCents}), 0)::int`,
        calls: sql<number>`COUNT(*)::int`,
      })
      .from(usage)
      .where(gte(usage.createdAt, monthStart));

    return {
      todayCents: Number(todayRow?.cents ?? 0),
      todayCalls: Number(todayRow?.calls ?? 0),
      monthCents: Number(monthRow?.cents ?? 0),
      monthCalls: Number(monthRow?.calls ?? 0),
      uniqueUsersToday: Number(todayRow?.users ?? 0),
    };
  } catch (err) {
    log.warn("getPlatformTotals failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      todayCents: 0,
      todayCalls: 0,
      monthCents: 0,
      monthCalls: 0,
      uniqueUsersToday: 0,
    };
  }
}

async function getProviderBreakdown(): Promise<
  Array<{ provider: string; cents: number; calls: number }>
> {
  try {
    const rows = await db
      .select({
        provider: usage.provider,
        cents: sql<number>`COALESCE(SUM(${usage.costCents}), 0)::int`,
        calls: sql<number>`COUNT(*)::int`,
      })
      .from(usage)
      .where(gte(usage.createdAt, dayStartUtc()))
      .groupBy(usage.provider);

    return rows
      .map((r) => ({
        provider: String(r.provider ?? "unknown"),
        cents: Number(r.cents ?? 0),
        calls: Number(r.calls ?? 0),
      }))
      .sort((a, b) => b.cents - a.cents);
  } catch (err) {
    log.warn("getProviderBreakdown failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const [totals, topSpenders, byProvider] = await Promise.all([
    getPlatformTotals(),
    getTopSpenders(25),
    getProviderBreakdown(),
  ]);

  return NextResponse.json(
    {
      totals,
      topSpenders,
      byProvider,
      generatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
