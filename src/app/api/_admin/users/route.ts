import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { desc, like, eq, or } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-users");

/**
 * GET /api/_admin/users?q=<search>&limit=50
 *
 * Admin user browser. Supports:
 *   - q: search by userId OR stripeCustomerId prefix
 *   - limit: cap results (default 50, max 500)
 *
 * Returns only columns the founder needs to support a customer:
 * ids, plan, status, period-end, founder-network badge. Intentionally
 * excludes PII that isn't already in Clerk — we don't want a breach
 * of this endpoint to leak more than the Clerk user directory already
 * exposes.
 */
export async function GET(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));

  try {
    const query = db
      .select({
        userId: subscriptions.userId,
        plan: subscriptions.plan,
        status: subscriptions.status,
        stripeCustomerId: subscriptions.stripeCustomerId,
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        founderNetworkSlot: subscriptions.founderNetworkSlot,
        founderNetworkJoinedAt: subscriptions.founderNetworkJoinedAt,
        createdAt: subscriptions.createdAt,
      })
      .from(subscriptions)
      .orderBy(desc(subscriptions.createdAt))
      .limit(limit);

    const rows = q
      ? await query.where(
          or(
            like(subscriptions.userId, `${q}%`),
            like(subscriptions.stripeCustomerId, `${q}%`),
          ),
        )
      : await query;

    return NextResponse.json({ users: rows, count: rows.length });
  } catch (err) {
    log.error("admin user list failed", { error: String(err) });
    return NextResponse.json(
      { error: "Failed to list users" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/_admin/users
 *
 * Admin user modification — SAFE subset only:
 *   - Change plan (e.g. promote to "enterprise")
 *   - Change status (active / suspended / refunded)
 *   - Toggle Founder Network membership
 *
 * Never lets the admin change the userId itself (that's immutable)
 * or touch Stripe fields directly (that must flow through Stripe).
 *
 * Every mutation is logged with the admin's userId for audit trail.
 */
export async function PATCH(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;
  const { userId: adminId } = gate;

  let body: {
    targetUserId?: string;
    plan?: string;
    status?: string;
    founderNetwork?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { targetUserId, plan, status, founderNetwork } = body;
  if (!targetUserId) {
    return NextResponse.json({ error: "Missing targetUserId" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (plan !== undefined) {
    const validPlans = ["free", "starter", "growth", "node", "enterprise", "founder"];
    if (!validPlans.includes(plan)) {
      return NextResponse.json(
        { error: `Invalid plan. Must be one of: ${validPlans.join(", ")}` },
        { status: 400 },
      );
    }
    updates.plan = plan;
  }
  if (status !== undefined) {
    const validStatuses = ["active", "past_due", "cancelled", "refunded", "suspended"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 },
      );
    }
    updates.status = status;
  }
  if (founderNetwork === true) {
    updates.founderNetworkJoinedAt = new Date();
  } else if (founderNetwork === false) {
    updates.founderNetworkJoinedAt = null;
    updates.founderNetworkSlot = null;
  }

  try {
    const result = await db
      .update(subscriptions)
      .set(updates)
      .where(eq(subscriptions.userId, targetUserId))
      .returning({ userId: subscriptions.userId, plan: subscriptions.plan, status: subscriptions.status });

    if (result.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Audit log — admin actions must be traceable.
    log.info("admin mutation", {
      adminId,
      targetUserId,
      updates: Object.keys(updates).filter((k) => k !== "updatedAt"),
    });

    return NextResponse.json({ ok: true, user: result[0] });
  } catch (err) {
    log.error("admin user patch failed", { error: String(err) });
    return NextResponse.json(
      { error: "Update failed" },
      { status: 500 },
    );
  }
}
