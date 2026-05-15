/**
 * SOVEREIGN MATRIX — Annual billing math (Cook 52 / Tier 4 #19)
 *
 * Pure pricing primitives for monthly vs annual billing, prorated
 * upgrades / downgrades, and refund-on-cancel math. No I/O — the
 * caller wires Stripe / PayFast / Yoco on top.
 *
 * Contracts:
 *
 *   - All amounts are cents (integer). NEVER floats — float math
 *     drifts under aggregation and produces off-by-1 refunds.
 *   - Annual discount applied as a fraction; default 17 % (= "2
 *     months free"). The result is rounded with banker's rounding
 *     so half-cents fall to even, never to one side, eliminating
 *     systemic bias across years.
 *   - Proration uses ACTUAL days in the billing period (29 in Feb
 *     leap, 30/31 otherwise) — not the textbook 30. Stripe does the
 *     same.
 *   - Every function returns a `BillingBreakdown` so the UI can
 *     display "you owe X today, your next invoice is Y on Z".
 */

// ── Public types ──────────────────────────────────────────────────────────

export type Cadence = "monthly" | "annual";

export interface PlanPricing {
  /** Stable id (e.g. "node"). */
  planId: string;
  monthlyCents: number;
  /** Optional explicit annual price. If absent, derived from monthly * 12 * (1 - discount). */
  annualCents?: number;
}

export interface BillingBreakdown {
  /** Charge to send to the payment processor today. */
  todayCents: number;
  /** Next billing date (Unix ms). */
  nextBillingMs: number;
  /** Recurring amount per period after today's charge. */
  recurringCents: number;
  /** What the customer paid relative to retail price (0..1). */
  effectiveDiscount: number;
  /** Free-form audit log for the receipt. */
  details: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────

export const DEFAULT_ANNUAL_DISCOUNT = 0.17; // 17 % — "two months free"

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ── Pure helpers ──────────────────────────────────────────────────────────

/** Banker's rounding: half-to-even. Eliminates systemic bias over time. */
export function bankersRound(x: number): number {
  const floor = Math.floor(x);
  const diff = x - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  // Exactly .5 → round to even.
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Compute the annual price for a plan, honouring an explicit override. */
export function annualPriceFor(
  plan: PlanPricing,
  discount = DEFAULT_ANNUAL_DISCOUNT,
): number {
  if (plan.annualCents !== undefined) return plan.annualCents;
  if (discount < 0 || discount >= 1) {
    throw new Error("annualPriceFor: discount must be in [0, 1)");
  }
  return bankersRound(plan.monthlyCents * 12 * (1 - discount));
}

/** Effective discount fraction relative to monthly retail (annual price / monthly*12). */
export function effectiveDiscount(
  plan: PlanPricing,
  discount = DEFAULT_ANNUAL_DISCOUNT,
): number {
  const annual = annualPriceFor(plan, discount);
  const retail = plan.monthlyCents * 12;
  if (retail === 0) return 0;
  return 1 - annual / retail;
}

/** Days in the calendar month that contains `now`. UTC. */
function daysInMonth(now: Date): number {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
}

// ── New subscription ──────────────────────────────────────────────────────

/**
 * Price a fresh subscription. `now` is injected to keep the function pure.
 */
export function quoteNewSubscription(
  plan: PlanPricing,
  cadence: Cadence,
  now: Date = new Date(),
  discount = DEFAULT_ANNUAL_DISCOUNT,
): BillingBreakdown {
  if (cadence === "monthly") {
    return {
      todayCents: plan.monthlyCents,
      nextBillingMs: addMonths(now, 1).getTime(),
      recurringCents: plan.monthlyCents,
      effectiveDiscount: 0,
      details: [`Monthly subscription for plan ${plan.planId}`],
    };
  }
  const annual = annualPriceFor(plan, discount);
  return {
    todayCents: annual,
    nextBillingMs: addMonths(now, 12).getTime(),
    recurringCents: annual,
    effectiveDiscount: effectiveDiscount(plan, discount),
    details: [
      `Annual subscription for plan ${plan.planId}`,
      `Saved ${(effectiveDiscount(plan, discount) * 100) | 0}% vs monthly retail`,
    ],
  };
}

// ── Upgrade / downgrade with proration ────────────────────────────────────

/**
 * Compute the prorated charge to move from `from` → `to` partway
 * through the current billing period.
 *
 * Convention (mirrors Stripe):
 *   - `daysElapsed` are the days the customer USED of the old plan.
 *   - `daysRemaining` are the days they HAVEN'T used yet.
 *   - We credit the unused portion of the old plan, debit the same
 *     fraction of the new plan, and charge the difference today.
 *   - A NEGATIVE result means a refund / credit-balance entry.
 */
export function prorateSwitch(
  oldPlan: PlanPricing,
  newPlan: PlanPricing,
  cadence: Cadence,
  daysElapsed: number,
  daysInPeriod: number,
  discount = DEFAULT_ANNUAL_DISCOUNT,
): BillingBreakdown {
  if (daysInPeriod <= 0) {
    throw new Error("prorateSwitch: daysInPeriod must be > 0");
  }
  const elapsed = Math.max(0, Math.min(daysElapsed, daysInPeriod));
  const remaining = daysInPeriod - elapsed;
  const oldPeriod =
    cadence === "monthly"
      ? oldPlan.monthlyCents
      : annualPriceFor(oldPlan, discount);
  const newPeriod =
    cadence === "monthly"
      ? newPlan.monthlyCents
      : annualPriceFor(newPlan, discount);
  const credit = bankersRound((oldPeriod * remaining) / daysInPeriod);
  const debit = bankersRound((newPeriod * remaining) / daysInPeriod);
  const todayCents = debit - credit;
  return {
    todayCents,
    nextBillingMs:
      cadence === "monthly"
        ? addMonths(new Date(), 1).getTime()
        : addMonths(new Date(), 12).getTime(),
    recurringCents: newPeriod,
    effectiveDiscount:
      cadence === "annual" ? effectiveDiscount(newPlan, discount) : 0,
    details: [
      `Switch ${oldPlan.planId} → ${newPlan.planId} on ${cadence} cadence`,
      `Credit ${credit} cents (${remaining}/${daysInPeriod} unused days of old plan)`,
      `Debit ${debit} cents (same fraction of new plan)`,
      todayCents >= 0
        ? `Net charge today: ${todayCents} cents`
        : `Net refund / credit: ${-todayCents} cents`,
    ],
  };
}

// ── Cancellation refund ───────────────────────────────────────────────────

/**
 * Compute the refund owed when a customer cancels mid-period.
 * Returns 0 if `refundUnused=false` (default — most SaaS keeps the
 * remainder). Set true for consumer-grade refund policies.
 */
export function cancelRefund(
  plan: PlanPricing,
  cadence: Cadence,
  daysElapsed: number,
  daysInPeriod: number,
  refundUnused = false,
  discount = DEFAULT_ANNUAL_DISCOUNT,
): number {
  if (!refundUnused) return 0;
  if (daysInPeriod <= 0) {
    throw new Error("cancelRefund: daysInPeriod must be > 0");
  }
  const remaining = Math.max(0, daysInPeriod - Math.max(0, daysElapsed));
  const period =
    cadence === "monthly" ? plan.monthlyCents : annualPriceFor(plan, discount);
  return bankersRound((period * remaining) / daysInPeriod);
}

// ── Calendar math ─────────────────────────────────────────────────────────

/**
 * Add `n` months to a date, clamping to end-of-month when the target
 * doesn't exist (Jan 31 + 1 month = Feb 28 / 29). UTC.
 */
export function addMonths(date: Date, n: number): Date {
  const d = new Date(date.getTime());
  const targetMonth = d.getUTCMonth() + n;
  const targetYear = d.getUTCFullYear() + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  d.setUTCFullYear(targetYear, month, 1);
  const lastDay = new Date(Date.UTC(targetYear, month + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDay);
  d.setUTCDate(day);
  return d;
}

export { ONE_DAY_MS, daysInMonth };
