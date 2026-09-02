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
 *
 * This module is also the single entitlement authority: getUserEntitlements()
 * resolves the caller's plan through the same subscriptions → founder → free
 * path as the quota check (including period-end expiry) and returns the
 * PlanEnterpriseFlags carried by that plan. requireEntitlement() is the guard
 * API routes call. paywall.ts derives its feature-slug tiers from the same
 * flags, so the two vocabularies cannot drift apart.
 */

import { db } from "@/db";
import { playbookRuns, subscriptions, usage } from "@/db/schema";
import { eq, gte, and, sql } from "drizzle-orm";
import {
  PLANS,
  cheapestPlanWith,
  normalizePlanId,
  type PlanEnterpriseFlags,
  type PlanId,
} from "@/lib/plans";
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
      .select({
        plan: subscriptions.plan,
        status: subscriptions.status,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.userId, userId),
          eq(subscriptions.status, "active"),
        ),
      )
      .limit(1);

    if (sub?.plan) {
      // Honour the paid period. One-time payments (crypto/Coinbase)
      // stamp currentPeriodEnd = now+30d; nothing flips the row to free
      // on expiry, so without this check a single payment granted the
      // tier forever (BACKLOG period-end). A null end means an
      // open-ended recurring sub — treat as valid.
      const expired =
        sub.currentPeriodEnd != null &&
        new Date(sub.currentPeriodEnd).getTime() < Date.now();
      if (!expired) {
        const planId = normalizePlanId(sub.plan);
        if (planId !== "free") return planId;
      }
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
    const mod = (await import("@/app/api/_misc/founders/route")) as unknown as {
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
 * Count the user's billable runs in the current calendar month.
 *
 * A "run" is anything the customer pays for: agent invocations live in the
 * `usage` table, playbook executions live in `playbook_runs`. Plans sell a
 * single quota ("X runs/mo"), so both counters must roll up to one number.
 * Without this, a Free user (50/mo) could fire 50 agents AND 50 playbooks,
 * silently doubling their effective quota.
 */
async function getMonthlyUsage(userId: string): Promise<number> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let agentCount = 0;
  let playbookCount = 0;

  try {
    // Sum RUN UNITS from the platform run-marker rows only (tokens_used
    // = +1 per run, -runs per referral bonus). A plain count(*) over the
    // usage table double-counted every run (one marker row + one or more
    // cost-telemetry rows) and treated bonus credits as consumption
    // (BACKLOG usage-count / bonus-runs). Must match free-tier's counter.
    const [row] = await db
      .select({
        used: sql<number>`COALESCE(SUM(${usage.tokensUsed}), 0)::int`,
      })
      .from(usage)
      .where(
        and(
          eq(usage.userId, userId),
          eq(usage.model, "platform"),
          gte(usage.createdAt, monthStart),
        ),
      );
    agentCount = Math.max(0, Number(row?.used ?? 0));
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode !== "42P01" && !msg.includes("does not exist")) {
      log.error("Failed to count agent usage", { error: msg, userId });
    }
    // Table missing in dev — treat as 0
  }

  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(playbookRuns)
      .where(
        and(
          eq(playbookRuns.userId, userId),
          gte(playbookRuns.createdAt, monthStart),
        ),
      );
    playbookCount = Number(row?.count ?? 0);
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode !== "42P01" && !msg.includes("does not exist")) {
      log.error("Failed to count playbook usage", { error: msg, userId });
    }
  }

  return agentCount + playbookCount;
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

// ── Entitlements ──

/** A single enterprise lever carried on a PlanDefinition. */
export type EntitlementFlag = keyof PlanEnterpriseFlags;

export interface EntitlementCheck {
  allowed: boolean;
  flag: EntitlementFlag;
  plan: PlanId;
  planName: string;
  /** Cheapest purchasable plan carrying the flag, or null if contract-only. */
  requiredPlan: PlanId | null;
  message?: string;
  upgradeUrl?: string;
}

/**
 * Resolve the caller's entitlement flags.
 *
 * Reuses getUserPlan() so there is exactly one plan resolution in the
 * codebase — subscriptions (active, not past currentPeriodEnd) → founder
 * allowlist → free. Fails CLOSED: any resolution failure yields the free
 * tier's flags (all off), so a DB outage or a missing subscriptions table
 * can never hand out an enterprise feature.
 */
export async function getUserEntitlements(
  userId: string,
): Promise<PlanEnterpriseFlags> {
  try {
    const planId = await getUserPlan(userId);
    // Copy, never the registry's own object: free / starter / array all
    // share the single DEFAULT_FLAGS instance, so handing the reference
    // out would let one caller's mutation grant a flag to every user on
    // this serverless instance.
    return Object.freeze({ ...PLANS[planId].enterprise });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("entitlement resolution failed — denying", {
      error: msg,
      userId,
    });
    return Object.freeze({ ...PLANS.free.enterprise });
  }
}

/**
 * Guard for an entitlement-gated route.
 *
 * Usage:
 *   const gate = await requireEntitlement(userId, "whiteLabel");
 *   if (!gate.allowed) {
 *     return NextResponse.json({ error: gate.message, upgradeUrl: gate.upgradeUrl }, { status: 402 });
 *   }
 */
export async function requireEntitlement(
  userId: string,
  flag: EntitlementFlag,
): Promise<EntitlementCheck> {
  let planId: PlanId = "free";
  try {
    planId = await getUserPlan(userId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("entitlement resolution failed — denying", {
      error: msg,
      userId,
    });
  }

  const plan = PLANS[planId];
  const requiredPlan = cheapestPlanWith(flag);

  if (plan.enterprise[flag]) {
    return {
      allowed: true,
      flag,
      plan: planId,
      planName: plan.name,
      requiredPlan: null,
    };
  }

  log.warn("entitlement denied", { userId, plan: planId, flag });
  const requiredName = requiredPlan
    ? `${PLANS[requiredPlan].name} plan (${PLANS[requiredPlan].priceDisplayUsd})`
    : "a Sovereign contract";
  return {
    allowed: false,
    flag,
    plan: planId,
    planName: plan.name,
    requiredPlan,
    message: `This feature requires ${requiredName}. You are on ${plan.name}.`,
    upgradeUrl: "/pricing",
  };
}
