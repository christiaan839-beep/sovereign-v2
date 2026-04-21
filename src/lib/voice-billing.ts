/**
 * voice-billing.ts — settles a voice session hold to actual usage.
 *
 * Pricing (matches the session endpoint's hold):
 *   15¢ per minute (or partial minute — we bill on ceiling)
 *   $0.75 = 5-minute ceiling. Longer sessions get force-closed by
 *   the WS runner so we never need to bill above the hold cap.
 *
 * Settlement algorithm:
 *   chargeCents = min(ceil(secondsUsed / 60) * PRICE_PER_MINUTE, holdCents)
 *   if chargeCents == 0           → releaseHold  (free tier / zero-length call)
 *   if chargeCents == holdCents   → captureHold  (used full 5 minutes)
 *   else                          → captureHold + topUp(refund=diff, "refund")
 *
 * Why capture-then-refund instead of one "partial capture" primitive?
 * Reuses existing Plan 1 primitives — no schema change, no new
 * transaction type. The ledger shows the capture as the original
 * charge and the refund as a separate positive entry, which reads
 * cleanly in the user's billing history.
 */

import { captureHold, releaseHold, topUp } from "@/lib/credits";
import { db } from "@/db";
import { creditTransactions } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import type { PlanId } from "@/lib/plans";

export const VOICE_PRICE_CENTS_PER_MINUTE = 15;
export const FREE_TIER_MINUTES_PER_MONTH = 5;

/**
 * Plans that get unlimited free voice — founders + enterprise. For these
 * users the session endpoint skips the credit hold entirely (no 75¢
 * debit, no settle/refund dance).
 */
const UNLIMITED_VOICE_PLANS: ReadonlySet<PlanId> = new Set(["founder", "enterprise"]);

export function isUnlimitedVoicePlan(plan: PlanId): boolean {
  return UNLIMITED_VOICE_PLANS.has(plan);
}

/**
 * Compute how many cents a session used, capped by the hold ceiling.
 * Pure function — testable without touching the DB. Flat-rate: ignores
 * free-tier allowance and plan.
 */
export function computeVoiceCharge(
  secondsUsed: number,
  holdCents: number,
): number {
  if (secondsUsed <= 0) return 0;
  const minutes = Math.ceil(secondsUsed / 60);
  const raw = minutes * VOICE_PRICE_CENTS_PER_MINUTE;
  return Math.min(raw, holdCents);
}

/**
 * Plan-aware charge. Free-tier users burn their 5-min monthly allowance
 * before paid minutes kick in; founder/enterprise pay zero; every other
 * tier pays the flat per-minute rate.
 *
 * Pure — call with the already-fetched `minutesUsedThisMonth`.
 *
 * Examples (PRICE=15, FREE=5):
 *   plan=free, used=0, new=3min  → 0¢ (all 3 within free allowance)
 *   plan=free, used=4, new=3min  → 2 × 15 = 30¢ (1 free + 2 paid)
 *   plan=free, used=7, new=3min  → 3 × 15 = 45¢ (already past free)
 *   plan=growth, used=0, new=3min → 3 × 15 = 45¢ (no free allowance)
 *   plan=founder, used=*, new=*  → 0¢
 */
export function computeVoiceChargeForPlan(opts: {
  plan: PlanId;
  minutesUsedThisMonth: number;
  secondsUsed: number;
  holdCents: number;
}): number {
  const { plan, minutesUsedThisMonth, secondsUsed, holdCents } = opts;
  if (secondsUsed <= 0) return 0;
  if (isUnlimitedVoicePlan(plan)) return 0;

  const newMinutes = Math.ceil(secondsUsed / 60);

  // Paid plans bill every minute.
  if (plan !== "free") {
    return Math.min(newMinutes * VOICE_PRICE_CENTS_PER_MINUTE, holdCents);
  }

  // Free plan — consume allowance first.
  const freeRemaining = Math.max(0, FREE_TIER_MINUTES_PER_MONTH - minutesUsedThisMonth);
  const billableMinutes = Math.max(0, newMinutes - freeRemaining);
  return Math.min(billableMinutes * VOICE_PRICE_CENTS_PER_MINUTE, holdCents);
}

/**
 * Sum up voice minutes consumed by this user in the current calendar
 * month. Reads from the ledger — `voice_usage` marker entries written
 * by settleVoiceSession below.
 *
 * Returns 0 on DB miss/error — fail open on the COUNT, because a free
 * user getting a free extra minute is less bad than a paying user
 * getting a spurious 402.
 */
export async function getVoiceMinutesThisMonth(userId: string): Promise<number> {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  try {
    const rows = await db
      .select({
        totalMinutes: sql<number>`COALESCE(SUM((${creditTransactions.metadata} ->> 'minutes')::int), 0)::int`,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.userId, userId),
          gte(creditTransactions.createdAt, monthStart),
          sql`${creditTransactions.metadata} ->> 'type' = 'voice_usage'`,
        ),
      );
    return rows[0]?.totalMinutes ?? 0;
  } catch {
    return 0;
  }
}

export interface SettleVoiceOptions {
  /** Null when the user was on an unlimited plan — no hold was placed. */
  holdId: string | null;
  userId: string;
  secondsUsed: number;
  holdCents: number;
  /** Optional — when provided, applies plan-aware free-tier logic. */
  plan?: PlanId;
  /** Optional — pre-fetched minutes used this month. */
  minutesUsedThisMonth?: number;
}

/**
 * Close out a voice session. Returns the actual charge + refund so the
 * caller (WS handler, metrics) can log or emit analytics.
 *
 * Three-path policy (unchanged for paid plans):
 *   charge == 0              → releaseHold
 *   charge == holdCents      → captureHold
 *   0 < charge < holdCents   → captureHold + topUp(refund="refund")
 *
 * Plan-aware free-tier:
 *   When opts.plan === "free" AND opts.minutesUsedThisMonth is provided,
 *   charge is computed via computeVoiceChargeForPlan so the user burns
 *   their 5-min allowance before paid minutes kick in.
 *
 * Unlimited plans (founder, enterprise):
 *   holdId === null  → skip all credit calls, just write the usage marker.
 *   Honors the session endpoint's no-hold path for these plans.
 *
 * Usage marker:
 *   A zero-delta `voice_usage` ledger entry gets written on every close
 *   so getVoiceMinutesThisMonth() can roll up the free-tier counter.
 *
 * Partial-capture failure mode: if captureHold succeeds but topUp fails,
 * user is over-charged by up to 60¢. Logged but not retried inline —
 * fewer concerns than leaving money un-captured.
 */
export async function settleVoiceSession(opts: SettleVoiceOptions): Promise<{
  charged: number;
  refunded: number;
}> {
  const { holdId, userId, secondsUsed, holdCents, plan, minutesUsedThisMonth } = opts;

  // Compute the charge — plan-aware when plan is provided.
  const chargeCents = plan
    ? computeVoiceChargeForPlan({
        plan,
        minutesUsedThisMonth: minutesUsedThisMonth ?? 0,
        secondsUsed,
        holdCents,
      })
    : computeVoiceCharge(secondsUsed, holdCents);

  const minutesUsedThisSession = Math.ceil(Math.max(0, secondsUsed) / 60);

  // Unlimited plan (no hold was placed) — just record usage + return.
  if (holdId === null) {
    await recordVoiceUsageMarker(userId, {
      chargeCents: 0,
      minutes: minutesUsedThisSession,
      secondsUsed,
      plan: plan ?? "unknown",
      holdId: null,
    });
    return { charged: 0, refunded: 0 };
  }

  let charged = 0;
  let refunded = 0;

  // Case 1: nothing to charge → full release.
  if (chargeCents === 0) {
    await releaseHold(holdId);
    refunded = holdCents;
  }
  // Case 2: used the whole ceiling → full capture.
  else if (chargeCents >= holdCents) {
    await captureHold(holdId);
    charged = holdCents;
  }
  // Case 3: partial. Capture full hold, refund the unused portion.
  else {
    const refundCents = holdCents - chargeCents;
    await captureHold(holdId);
    await topUp(userId, refundCents, "refund", {
      stage: "voice_partial_refund",
      holdId,
      secondsUsed,
      chargeCents,
    });
    charged = chargeCents;
    refunded = refundCents;
  }

  await recordVoiceUsageMarker(userId, {
    chargeCents: charged,
    minutes: minutesUsedThisSession,
    secondsUsed,
    plan: plan ?? "unknown",
    holdId,
  });

  return { charged, refunded };
}

/**
 * Fire-and-forget zero-delta ledger entry that marks a voice session
 * for monthly rollup queries. Swallows errors — failure to write this
 * only breaks the free-tier meter for one session, which is survivable.
 */
async function recordVoiceUsageMarker(
  userId: string,
  meta: {
    chargeCents: number;
    minutes: number;
    secondsUsed: number;
    plan: string;
    holdId: string | null;
  },
): Promise<void> {
  try {
    await db.insert(creditTransactions).values({
      userId,
      deltaCents: 0,
      reason: "agent_run",
      holdId: meta.holdId ?? undefined,
      metadata: {
        type: "voice_usage",
        minutes: meta.minutes,
        chargeCents: meta.chargeCents,
        secondsUsed: meta.secondsUsed,
        plan: meta.plan,
      },
    });
  } catch {
    // Best-effort — ledger miss just under-counts free minutes.
  }
}

/**
 * Builds the billOnClose callback consumed by handleVoiceWs.
 *
 * Fetches the plan + month-to-date minutes at close time so the
 * free-tier allowance applies correctly. Handles the unlimited-plan
 * case (holdId === "none") by passing null down.
 */
export function makeVoiceBillOnClose(holdCents: number) {
  return async function billOnClose(
    payload: { userId: string; holdId: string; personaId: string },
    secondsUsed: number,
  ): Promise<void> {
    // Dynamic import avoids pulling plan-enforcement into non-voice
    // paths of voice-billing (keeps the call-graph narrow).
    const { getUserPlan } = await import("@/lib/plan-enforcement");

    const [plan, minutesUsedThisMonth] = await Promise.all([
      getUserPlan(payload.userId).catch(() => "free" as PlanId),
      getVoiceMinutesThisMonth(payload.userId),
    ]);

    await settleVoiceSession({
      // "none" is the sentinel hold ID the session endpoint returns
      // when the user was on an unlimited plan (no hold was placed).
      holdId: payload.holdId === "none" ? null : payload.holdId,
      userId: payload.userId,
      secondsUsed,
      holdCents,
      plan,
      minutesUsedThisMonth,
    });
  };
}
