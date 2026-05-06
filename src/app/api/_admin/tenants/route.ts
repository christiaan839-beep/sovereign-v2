import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { desc } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-tenants-list");

/**
 * GET /api/_admin/tenants
 *
 * Operator-only. Returns every tenant with the new operational
 * columns surfaced — deployment_profile (migration 0023) and
 * suspension state (migration 0024). The /admin/tenants page is
 * the consumer; nothing else relies on the response shape, so
 * we're free to extend it.
 *
 * Lightweight by design: no joins, no aggregations. The cost
 * dashboard is a separate endpoint at /api/_admin/tenant-costs;
 * keeping concerns split means a slow cost query can't take down
 * the tenant-management page.
 */

export const runtime = "nodejs";

const DEFAULT_LIMIT = 200;

export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const url = new URL(req.url);
  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const limit =
    Number.isFinite(limitParam) && limitParam > 0 && limitParam <= 1000
      ? limitParam
      : DEFAULT_LIMIT;

  try {
    const rows = await db
      .select({
        id: tenants.id,
        nodeId: tenants.nodeId,
        clerkUserId: tenants.clerkUserId,
        plan: tenants.plan,
        deploymentProfile: tenants.deploymentProfile,
        isSuspended: tenants.isSuspended,
        suspensionReason: tenants.suspensionReason,
        suspendedAt: tenants.suspendedAt,
        welcomeFirstName: tenants.welcomeFirstName,
        welcomeFirstDelivery: tenants.welcomeFirstDelivery,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .orderBy(desc(tenants.createdAt))
      .limit(limit);

    log.info("Tenants list fetched", {
      adminUserId: gate.userId,
      count: rows.length,
    });

    return NextResponse.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      count: rows.length,
      tenants: rows.map((t) => ({
        id: t.id,
        nodeId: t.nodeId,
        clerkUserId: t.clerkUserId,
        plan: t.plan,
        deploymentProfile: t.deploymentProfile ?? "cloud",
        isSuspended: t.isSuspended ?? false,
        suspensionReason: t.suspensionReason ?? null,
        suspendedAt: t.suspendedAt ? t.suspendedAt.toISOString() : null,
        firstName: t.welcomeFirstName ?? null,
        firstDelivery: t.welcomeFirstDelivery ?? null,
        createdAt: t.createdAt ? t.createdAt.toISOString() : null,
      })),
    });
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01" || pgCode === "42703") {
      return NextResponse.json(
        {
          error:
            "Database migrations 0023/0024 are not applied. Paste " +
            "MIGRATIONS-RUNME.sql into Neon Console and try again.",
        },
        { status: 503 },
      );
    }
    log.error("Tenants list failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
