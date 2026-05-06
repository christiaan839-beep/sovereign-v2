import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { usage, tenants } from "@/db/schema";
import { sql, gte, eq, desc } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-tenant-costs");

/**
 * GET /api/_admin/tenant-costs
 *
 * Operator-only. Aggregates `usage.cost_cents` per tenant for the
 * last N days (default 30). Powers the "what is each customer
 * actually costing me?" dashboard.
 *
 * Backed by `usage.tenant_id` (added in
 * drizzle/0023_deployment_profile.sql). Legacy rows with NULL
 * tenant_id surface in the "unattributed" bucket so the operator
 * sees them and can decide whether to backfill.
 *
 * Query params:
 *   ?days=30  window in days, 1..365 (clamped). Default 30.
 *   ?limit=50 max rows returned. 1..500. Default 50.
 *
 * Failure modes:
 *   - usage.tenant_id missing (migration 0023 not applied) → 503
 *     with the "apply MIGRATIONS-RUNME.sql" hint.
 *   - usage table missing → 503 same.
 *   - any other DB error → log + 500.
 */

export const runtime = "nodejs";

interface TenantCostRow {
  tenantId: string | null;
  nodeId: string | null;
  deploymentProfile: string | null;
  totalTokens: number;
  totalCostCents: number;
  callCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
}

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 500;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const url = new URL(req.url);
  const days = clamp(
    Number.parseInt(url.searchParams.get("days") ?? "", 10) || DEFAULT_DAYS,
    1,
    MAX_DAYS,
  );
  const limit = clamp(
    Number.parseInt(url.searchParams.get("limit") ?? "", 10) || DEFAULT_LIMIT,
    1,
    MAX_LIMIT,
  );

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    // Aggregate per tenant. LEFT JOIN to tenants so we surface the
    // node_id + deployment_profile alongside the cost — operators
    // mostly recognise customers by node_id, not raw uuid.
    const rows = (await db
      .select({
        tenantId: usage.tenantId,
        nodeId: tenants.nodeId,
        deploymentProfile: tenants.deploymentProfile,
        totalTokens: sql<number>`coalesce(sum(${usage.tokensUsed}), 0)::int`,
        totalCostCents: sql<number>`coalesce(sum(${usage.costCents}), 0)::int`,
        callCount: sql<number>`count(*)::int`,
        firstSeen: sql<string>`min(${usage.createdAt})::text`,
        lastSeen: sql<string>`max(${usage.createdAt})::text`,
      })
      .from(usage)
      .leftJoin(tenants, eq(tenants.id, usage.tenantId))
      .where(gte(usage.createdAt, since))
      .groupBy(usage.tenantId, tenants.nodeId, tenants.deploymentProfile)
      .orderBy(desc(sql`coalesce(sum(${usage.costCents}), 0)`))
      .limit(limit)) as TenantCostRow[];

    const totals = rows.reduce(
      (acc, r) => ({
        tokens: acc.tokens + r.totalTokens,
        costCents: acc.costCents + r.totalCostCents,
        calls: acc.calls + r.callCount,
      }),
      { tokens: 0, costCents: 0, calls: 0 },
    );

    log.info("tenant-costs aggregated", {
      days,
      limit,
      tenantCount: rows.length,
      totalCostCents: totals.costCents,
      adminUserId: gate.userId,
    });

    return NextResponse.json({
      windowDays: days,
      generatedAt: new Date().toISOString(),
      totals,
      rows: rows.map((r) => ({
        // null tenantId = legacy / public-surface rows.
        tenantId: r.tenantId,
        nodeId: r.nodeId,
        deploymentProfile: r.deploymentProfile ?? null,
        totalTokens: r.totalTokens,
        totalCostCents: r.totalCostCents,
        // Pre-computed convenience for dashboards.
        totalCostUsd: (r.totalCostCents / 100).toFixed(2),
        callCount: r.callCount,
        firstSeen: r.firstSeen,
        lastSeen: r.lastSeen,
        bucket: r.tenantId ? "tenant" : "unattributed",
      })),
    });
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42703" || pgCode === "42P01") {
      return NextResponse.json(
        {
          error:
            "Database migration 0023 is not applied. Paste " +
            "MIGRATIONS-RUNME.sql into Neon Console and try again.",
        },
        { status: 503 },
      );
    }
    log.error("tenant-costs aggregation failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
