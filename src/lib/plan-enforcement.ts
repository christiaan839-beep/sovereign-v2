/**
 * SOVEREIGN MATRIX — Plan Enforcement
 *
 * Guards playbook/agent execution against plan limits.
 * Counts runs in the current calendar month and compares
 * against the user's plan tier from plans.ts.
 *
 * Usage:
 *   const check = await checkPlanLimits(userId);
 *   if (!check.allowed) return NextResponse.json({ error: check.message }, { status: 429 });
 *   // ... execute the run ...
 *   await incrementUsage(userId);
 */

import { db } from "@/db";
import { playbookRuns } from "@/db/schema";
import { eq, gte, and, sql } from "drizzle-orm";
import { PLANS, type PlanId } from "@/lib/plans";
import { createLogger } from "@/lib/logger";

const log = createLogger("plan-enforcement");

export interface PlanCheck {
  allowed: boolean;
  plan: PlanId;
  planName: string;
  used: number;
  limit: number;
  remaining: number;
  message?: string;
  upgradeUrl?: string;
}

/**
 * Get the user's current plan. For now, defaults to "free".
 * TODO: Read from subscriptions table once Stripe is wired.
 */
async function getUserPlan(userId: string): Promise<PlanId> {
  try {
    // Check for founder status (first 10 users)
    const { founders } = await import("@/app/api/_misc/founders/route");
    if (typeof founders?.has === "function" && founders.has(userId)) {
      return "founder";
    }
  } catch {
    // founders route may not exist, skip
  }

  // TODO: Check subscriptions table for active Stripe subscription
  // For now, everyone without a subscription is on free tier
  return "free";
}

/**
 * Count the user's playbook runs in the current calendar month.
 */
/**
 * Sentinel returned by getMonthlyUsage when the DB is down but the table
 * DOES exist — we fail CLOSED in that case to protect revenue. A missing
 * table (42P01) still fails open because that's the pre-migration bootstrap
 * window where we want users to be able to try the product.
 */
const USAGE_UNAVAILABLE = Symbol("usage-unavailable");

async function getMonthlyUsage(userId: string): Promise<number | typeof USAGE_UNAVAILABLE> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(playbookRuns)
      .where(
        and(
          eq(playbookRuns.userId, userId),
          gte(playbookRuns.createdAt, monthStart)
        )
      );

    return Number(result?.count ?? 0);
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      // Bootstrap window: migrations not yet applied. Fail OPEN so the app
      // can be used while the operator runs migrations.
      log.warn("playbook_runs table missing — run drizzle migrations", { userId });
      return 0;
    }
    // DB is reachable but the count query failed for another reason
    // (network blip, schema mismatch, bad connection). Fail CLOSED so a
    // free-tier user can't bypass their limit by triggering errors.
    log.error("Failed to check usage — denying run", { error: msg, userId });
    return USAGE_UNAVAILABLE;
  }
}

/**
 * Check whether a user can execute another run.
 *
 * Returns { allowed: true } if under their plan limit,
 * or { allowed: false, message, upgradeUrl } if they've hit the cap.
 */
export async function checkPlanLimits(userId: string): Promise<PlanCheck> {
  const planId = await getUserPlan(userId);
  const plan = PLANS[planId];
  const usageResult = await getMonthlyUsage(userId);

  // Fail-closed when the usage layer is unavailable (DB error, not missing table).
  if (usageResult === USAGE_UNAVAILABLE) {
    return {
      allowed: false,
      plan: planId,
      planName: plan.name,
      used: 0,
      limit: plan.runsPerMonth,
      remaining: 0,
      message: "Usage tracking is temporarily unavailable. Please try again in a moment.",
      upgradeUrl: "/pricing",
    };
  }

  const used = usageResult;
  const limit = plan.runsPerMonth;
  const remaining = Math.max(0, limit - used);

  if (limit !== Infinity && used >= limit) {
    log.warn("plan limit reached", { userId, plan: planId, used, limit });
    return {
      allowed: false,
      plan: planId,
      planName: plan.name,
      used,
      limit,
      remaining: 0,
      message: `You've used ${used}/${limit} runs this month on the ${plan.name} plan. Upgrade to continue.`,
      upgradeUrl: "/pricing",
    };
  }

  return {
    allowed: true,
    plan: planId,
    planName: plan.name,
    used,
    limit,
    remaining,
  };
}

/**
 * Increment the user's usage count.
 * Called AFTER a successful run creation — the run record itself IS the counter,
 * so this is a no-op. The count is derived from the playbook_runs table.
 *
 * Exists as an explicit function for:
 * 1. Future: Write to a fast Redis counter for real-time checks
 * 2. Logging/alerting when approaching limits
 */
export async function incrementUsage(userId: string): Promise<void> {
  // The run insertion itself IS the increment (we count rows).
  // But log when users approach their limit.
  try {
    const planId = await getUserPlan(userId);
    const plan = PLANS[planId];
    const usageResult = await getMonthlyUsage(userId);
    if (usageResult === USAGE_UNAVAILABLE) return; // DB down — skip warning logs
    const used = usageResult;
    const pct = plan.runsPerMonth === Infinity ? 0 : (used / plan.runsPerMonth) * 100;

    if (pct >= 90) {
      log.warn("user approaching plan limit", {
        userId,
        plan: planId,
        used,
        limit: plan.runsPerMonth,
        percentUsed: Math.round(pct),
      });
    }
  } catch {
    // Non-critical — don't crash if logging fails
  }
}
