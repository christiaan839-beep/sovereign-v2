import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { tenants, auditLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { invalidateSuspensionCache } from "@/lib/tenant-suspension";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-suspend-tenant");

/**
 * POST /api/_admin/suspend-tenant
 *
 * Operator-only. Toggles `tenants.is_suspended`. The agent-factory
 * reads this on every authenticated request — flipping it true
 * locks the workspace out of every agent endpoint with a 423 Locked
 * response. Flipping it back to false restores execution.
 *
 * Body:
 *   - tenantId   UUID of the target tenant
 *   - suspend    boolean — true to suspend, false to lift
 *   - reason     required when suspend=true; surfaced in the 423
 *                response body so the customer knows what to do.
 *                Operator note for unsuspend is optional.
 *
 * Side effects:
 *   - Writes `audit_logs` row keyed to the operator's userId so we
 *     have a tamper-resistant trail of who suspended whom and why.
 *   - Invalidates the in-process suspension cache so the next
 *     agent request sees the new state without waiting for the
 *     30s TTL to expire.
 *
 * Failure modes:
 *   - Tenant not found → 404
 *   - Migration 0024 not applied (42703) → 503 with the
 *     "apply MIGRATIONS-RUNME.sql" hint.
 *   - audit_logs missing → suspension still applies; the audit
 *     write is logged as a warning but isn't blocking.
 */

const schema = z.object({
  tenantId: z.string().uuid(),
  suspend: z.boolean(),
  reason: z.string().min(1).max(500).optional(),
});

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { tenantId, suspend, reason } = parsed.data;

  if (suspend && !reason) {
    return NextResponse.json(
      {
        error:
          "A `reason` is required when suspending a tenant. The reason " +
          "is surfaced to the customer in the 423 response — don't ship " +
          "an empty one.",
      },
      { status: 422 },
    );
  }

  try {
    // Confirm the tenant exists before updating; surfaces a 404
    // instead of a silent no-op when an operator pastes the wrong
    // UUID. The .returning() call would also detect this but the
    // explicit check makes the intent obvious.
    const [existing] = await db
      .select({ id: tenants.id, isSuspended: tenants.isSuspended })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    if (!existing) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    await db
      .update(tenants)
      .set({
        isSuspended: suspend,
        suspensionReason: suspend ? (reason ?? null) : null,
        suspendedAt: suspend ? sql`now()` : null,
      })
      .where(eq(tenants.id, tenantId));

    // Push the cache so the next request sees the new state.
    invalidateSuspensionCache(tenantId);

    // Audit row — best-effort; never fails the suspension itself.
    try {
      await db.insert(auditLogs).values({
        userId: gate.userId,
        action: suspend ? "tenant.suspend" : "tenant.unsuspend",
        resource: tenantId,
        details: JSON.stringify({
          previousState: existing.isSuspended,
          reason: reason ?? null,
        }),
      });
    } catch (auditErr) {
      log.warn("audit_logs write failed; suspension still applied", {
        tenantId,
        error: auditErr instanceof Error ? auditErr.message : String(auditErr),
      });
    }

    log.info(suspend ? "Tenant suspended" : "Tenant unsuspended", {
      tenantId,
      adminUserId: gate.userId,
      reason: reason ?? null,
    });

    return NextResponse.json({
      ok: true,
      tenantId,
      isSuspended: suspend,
      suspensionReason: suspend ? (reason ?? null) : null,
    });
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42703" || pgCode === "42P01") {
      return NextResponse.json(
        {
          error:
            "Database migration 0024 is not applied. Paste " +
            "MIGRATIONS-RUNME.sql into Neon Console and try again.",
        },
        { status: 503 },
      );
    }
    log.error("Suspend-tenant failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
