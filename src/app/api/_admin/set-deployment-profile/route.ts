import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { tenants, auditLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  DEPLOYMENT_PROFILES,
  type DeploymentProfile,
} from "@/lib/deployment-profile";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-set-deployment-profile");

/**
 * POST /api/_admin/set-deployment-profile
 *
 * Operator-only. Flips a tenant between cloud / byo-gpu / air-gapped.
 * Tightens (or relaxes) which AI providers may serve their requests.
 *
 * The deployment-profile module caches the row for 60s; the cache is
 * keyed on tenant id, so a profile change propagates within that
 * window automatically. We don't expose a public invalidation hook
 * here because:
 *   1. 60s is fine for an operator workflow.
 *   2. Forcing immediate propagation would risk a race where a
 *      half-completed write is read.
 *
 * Body:
 *   - tenantId  UUID of the target tenant
 *   - profile   "cloud" | "byo-gpu" | "air-gapped"
 *
 * Side effects:
 *   - audit_logs row scoped to the operator with the previous + new
 *     profile so a rollback is always possible.
 */

const schema = z.object({
  tenantId: z.string().uuid(),
  profile: z.enum(DEPLOYMENT_PROFILES as readonly [string, ...string[]]),
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

  const { tenantId, profile } = parsed.data;

  try {
    const [existing] = await db
      .select({
        id: tenants.id,
        deploymentProfile: tenants.deploymentProfile,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (existing.deploymentProfile === profile) {
      return NextResponse.json({
        ok: true,
        tenantId,
        profile,
        unchanged: true,
      });
    }

    await db
      .update(tenants)
      .set({ deploymentProfile: profile as DeploymentProfile })
      .where(eq(tenants.id, tenantId));

    // Audit row — best-effort.
    try {
      await db.insert(auditLogs).values({
        userId: gate.userId,
        action: "tenant.deployment_profile.update",
        resource: tenantId,
        details: JSON.stringify({
          previous: existing.deploymentProfile,
          next: profile,
        }),
      });
    } catch (auditErr) {
      log.warn("audit_logs write failed; profile change still applied", {
        tenantId,
        error: auditErr instanceof Error ? auditErr.message : String(auditErr),
      });
    }

    log.info("Tenant deployment profile updated", {
      tenantId,
      previous: existing.deploymentProfile,
      next: profile,
      adminUserId: gate.userId,
    });

    return NextResponse.json({
      ok: true,
      tenantId,
      profile,
      previous: existing.deploymentProfile,
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
    if (pgCode === "23514") {
      // CHECK constraint — caller passed a non-enum value past Zod
      // somehow. Defensive 422 instead of leaking 500.
      return NextResponse.json(
        { error: `Invalid profile: ${profile}` },
        { status: 422 },
      );
    }
    log.error("Set-deployment-profile failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
