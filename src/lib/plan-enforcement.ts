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
import { playbookRuns, subscriptions } from "@/db/schema";
import { eq, gte, and, sql } from "drizzle-orm";
import { PLANS, normalizePlanId, type PlanId } from "@/lib/plans";
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
 * Get the user's current plan from the subscriptions table.
 * Falls back to founder check, then free tier.
 */
async function getUserPlan(userId: string): Promise<PlanId> {
  // 1. Check subscriptions table for active Stripe subscription
  try {
    const [sub] = await db
      .select({ plan: subscriptions.plan, status: subscriptions.status })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, "active"),
        ),
      )
      .limit(1);

    if (sub?.plan) {
      const planId = normalizePlanId(sub.plan);
      if (planId !== "free") return planId;
    }
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode !== "42P01" && !msg.includes("does not exist")) {
      log.error("Failed to check subscription", { error: msg, userId });
    }
    // Table doesn't exist or DB error — fall through to founder check
  }

  // 2. Check for founder status (first 10 users)
  try {
    // The founders route module may export a `founders` Set in some
    // builds; the dynamic-import shape isn't statically typed so we
    // narrow at runtime.
    const mod = (await import("@/app/api/_misc/founders/route")) as {
      founders?: { has?: (id: string) => boolean };
    };
    const founders = mod.founders;
    if (typeof founders?.has === "function" && founders.has(userId)) {
      return "founder";
    }
  } catch {
    // founders route may not exist, skip
  }

  return "free";
}

/**
 * Count the user's playbook runs in the current calendar month.
 */
async function getMonthlyUsage(userId: string): Promise<number> {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(playbookRuns)
      .where(
        and(
          eq(playbookRuns.userId, userId),
          gte(playbookRuns.createdAt, monthStart),
        ),
      );

    return Number(result?.count ?? 0);
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      // Table doesn't exist yet — no usage
      return 0;
    }
    log.error("Failed to check usage", { error: msg, userId });
    return 0; // Fail open — don't block users if DB is down
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
  const used = await getMonthlyUsage(userId);
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
    const used = await getMonthlyUsage(userId);
    const pct =
      plan.runsPerMonth === Infinity ? 0 : (used / plan.runsPerMonth) * 100;

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
