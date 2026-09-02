/**
 * SOVEREIGN MATRIX — /api/_admin/plan route
 *
 * The only code path that can write a non-checkout tier into the
 * `subscriptions` table. Stripe checkout can only ever provision the
 * purchasable tiers; `founder` comes from the founders allowlist and
 * `sovereign` (contract, price-on-application) had no writer at all, so
 * the top tier had never actually executed in production. This closes
 * that gap: after a Calendly call and a manual Stripe invoice, an admin
 * stamps the tier here and plan-enforcement resolves it like any other.
 *
 * Admin-only — guarded by `requireAuth()` + `isAdmin()`, same shape as
 * /api/_admin/grant.
 *
 * POST { userId, planId, currentPeriodEnd, invoiceRef? }
 *   → 200 { ok: true, userId, plan, currentPeriodEnd }
 *
 * `currentPeriodEnd` is required but nullable: an ISO timestamp stamps a
 * contract end date that plan-enforcement's expiry check honours, while
 * an explicit null means an open-ended recurring arrangement.
 * `invoiceRef` is recorded on the audit-log entry rather than on the row
 * — there is no invoice column on `subscriptions` and inventing one is
 * not this route's job.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { isAdmin } from "@/lib/admin-auth";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PLANS, type PlanId } from "@/lib/plans";
import { z } from "zod";

const log = createLogger("admin-plan");

const PLAN_IDS = Object.keys(PLANS) as [PlanId, ...PlanId[]];

const SCHEMA = z.object({
  userId: z.string().min(1).max(128),
  planId: z.enum(PLAN_IDS),
  currentPeriodEnd: z.string().datetime().nullable(),
  invoiceRef: z.string().min(1).max(128).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!isAdmin(auth.userId)) {
    log.warn("Non-admin attempted /api/_admin/plan", { userId: auth.userId });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const body = await req.json();
    const parsed = SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { userId, planId, currentPeriodEnd, invoiceRef } = parsed.data;
    const periodEnd = currentPeriodEnd ? new Date(currentPeriodEnd) : null;

    // Read-then-write rather than .onConflictDoUpdate({ target:
    // subscriptions.userId }). The UNIQUE constraint that upsert needs
    // ships in migration 0025, which is applied by hand in the Neon
    // console — on a database that hasn't had it applied yet the upsert
    // fails with 42P10. This path works with or without the constraint.
    const [existing] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    if (existing) {
      await db
        .update(subscriptions)
        .set({
          plan: planId,
          status: "active",
          currentPeriodEnd: periodEnd,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.userId, userId));
    } else {
      await db.insert(subscriptions).values({
        userId,
        plan: planId,
        status: "active",
        currentPeriodEnd: periodEnd,
      });
    }

    await auditLog({
      userId: auth.userId,
      action: "admin.provision",
      resource: `subscriptions:${userId}`,
      details: {
        target: userId,
        plan: planId,
        currentPeriodEnd: periodEnd?.toISOString() ?? null,
        invoiceRef: invoiceRef ?? null,
        by: auth.userId,
      },
    });

    log.info("Plan provisioned", { target: userId, plan: planId });

    return NextResponse.json({
      ok: true,
      userId,
      plan: planId,
      currentPeriodEnd: periodEnd?.toISOString() ?? null,
    });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      log.warn("subscriptions table missing — cannot provision plan");
      return NextResponse.json(
        { error: "Subscriptions table not provisioned" },
        { status: 503 },
      );
    }
    log.error("POST /api/_admin/plan failed", err as Record<string, unknown>);
    return NextResponse.json({ error: "Failed to set plan" }, { status: 500 });
  }
}
