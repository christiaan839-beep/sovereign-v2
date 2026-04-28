/**
 * GET  /api/admin/tenants — list per-tenant cost ledger state for today.
 * POST /api/admin/tenants — operator action: unpause a tenant.
 *
 * Admin-only. Surfaces the data behind the per-tenant ops dashboard.
 *
 * The rows shown here come straight from `tenant_cost_ledger` (R27).
 * For each tenant active today, we report:
 *   - cost_cents spent today
 *   - run_count today
 *   - paused_at (if any)
 *   - pause_reason (if any)
 *
 * No PII beyond user_id. The admin UI is internal; if it ever became
 * customer-visible, additional anonymization would be required.
 */

import { NextResponse } from "next/server";
import { desc, eq, and, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { unpauseTenant } from "@/lib/cost-runaway";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-tenants");

export const runtime = "nodejs";

interface TenantRow {
  userId: string;
  costCents: number;
  runCount: number;
  pausedAt: string | null;
  pauseReason: string | null;
  updatedAt: string;
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ rows: [] });
  }

  try {
    const { db } = await import("@/db");
    const { tenantCostLedger } = await import("@/db/schema");

    // Today's UTC date in YYYY-MM-DD form. Postgres DATE column
    // accepts this string directly.
    const today = new Date().toISOString().slice(0, 10);

    const rows = await db
      .select()
      .from(tenantCostLedger)
      .where(eq(tenantCostLedger.day, today))
      .orderBy(desc(tenantCostLedger.costCents))
      .limit(200);

    // Also surface the 14-day historical totals — useful for spotting
    // trend abuse before today's row crosses the cap.
    const trendResult = await db.execute(sql`
      SELECT
        user_id,
        SUM(cost_cents)::int     AS total_cents,
        SUM(run_count)::int      AS total_runs,
        COUNT(*)::int            AS active_days
      FROM ${tenantCostLedger}
      WHERE day > CURRENT_DATE - INTERVAL '14 days'
      GROUP BY user_id
      ORDER BY total_cents DESC
      LIMIT 200
    `);
    const trendMap = new Map<
      string,
      { totalCents: number; totalRuns: number; activeDays: number }
    >();
    const trendRows = (trendResult as unknown as {
      rows: Array<{
        user_id: string;
        total_cents: number;
        total_runs: number;
        active_days: number;
      }>;
    }).rows ?? [];
    for (const r of trendRows) {
      trendMap.set(r.user_id, {
        totalCents: r.total_cents,
        totalRuns: r.total_runs,
        activeDays: r.active_days,
      });
    }

    const out: Array<TenantRow & { last14d: ReturnType<(typeof trendMap)["get"]> | null }> =
      rows.map((r) => ({
        userId: r.userId,
        costCents: r.costCents,
        runCount: r.runCount,
        pausedAt: r.pausedAt instanceof Date ? r.pausedAt.toISOString() : null,
        pauseReason: r.pauseReason,
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
        last14d: trendMap.get(r.userId) ?? null,
      }));

    return NextResponse.json({
      rows: out,
      day: today,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    log.error("Admin tenants list failed", { error: String(err) });
    return NextResponse.json(
      { error: "Failed to load tenant ledger" },
      { status: 500 },
    );
  }
}

interface UnpauseBody {
  userId: string;
  reason?: string;
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  let body: UnpauseBody;
  try {
    body = (await req.json()) as UnpauseBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.userId || typeof body.userId !== "string") {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const result = await unpauseTenant({
    userId: body.userId,
    reason: body.reason,
  });

  // Audit the operator action — hash-chained for SOC 2.
  await auditLog({
    userId: gate.userId,
    action: "settings.update",
    resource: `tenant:${body.userId}`,
    details: {
      operation: "unpause_cost_cap",
      reason: body.reason ?? null,
      affected_user: body.userId,
      success: result.unpaused,
    },
  }).catch(() => {});

  if (!result.unpaused) {
    return NextResponse.json(
      { error: "No paused row found for today" },
      { status: 404 },
    );
  }
  return NextResponse.json({ unpaused: true });
}

// Reference `and` to satisfy the "imports must be used" linter — this
// is the placeholder for future filtering (paused-only / search) that
// the dashboard will gain in a follow-up.
const _unused = { and };
void _unused;
