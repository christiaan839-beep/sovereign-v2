/**
 * Tests for src/lib/billing-math.ts — Cook 52 annual billing math.
 *
 *   - bankersRound: half-to-even, no systemic bias.
 *   - annualPriceFor: explicit override wins; default 17 % discount.
 *   - quoteNewSubscription: monthly + annual flows.
 *   - prorateSwitch: upgrade owes, downgrade credits, days math is exact.
 *   - cancelRefund: opt-in policy.
 *   - addMonths: end-of-month clamping (Jan 31 → Feb 28/29).
 */

import { describe, it, expect } from "vitest";
import {
  bankersRound,
  annualPriceFor,
  effectiveDiscount,
  quoteNewSubscription,
  prorateSwitch,
  cancelRefund,
  addMonths,
  type PlanPricing,
} from "../billing-math";

const NODE: PlanPricing = { planId: "node", monthlyCents: 4_900 };
const ENTERPRISE: PlanPricing = { planId: "enterprise", monthlyCents: 49_900 };
const STARTER: PlanPricing = { planId: "starter", monthlyCents: 1_900 };

describe("bankersRound", () => {
  it("rounds halves to the nearest even integer (no systemic bias)", () => {
    expect(bankersRound(0.5)).toBe(0);
    expect(bankersRound(1.5)).toBe(2);
    expect(bankersRound(2.5)).toBe(2);
    expect(bankersRound(3.5)).toBe(4);
    expect(bankersRound(4.5)).toBe(4);
  });

  it("rounds non-halves the usual way", () => {
    expect(bankersRound(0.4)).toBe(0);
    expect(bankersRound(0.6)).toBe(1);
    expect(bankersRound(99.49)).toBe(99);
    expect(bankersRound(99.51)).toBe(100);
  });
});

describe("annualPriceFor", () => {
  it("uses explicit annualCents when provided", () => {
    expect(annualPriceFor({ ...NODE, annualCents: 49_000 })).toBe(49_000);
  });

  it("derives from monthly * 12 * (1 - 0.17) by default", () => {
    // 4900 * 12 * 0.83 = 48_804
    expect(annualPriceFor(NODE)).toBe(48_804);
  });

  it("honours a caller-supplied discount", () => {
    expect(annualPriceFor(NODE, 0)).toBe(58_800);
    expect(annualPriceFor(NODE, 0.5)).toBe(29_400);
  });

  it("rejects discounts outside [0, 1)", () => {
    expect(() => annualPriceFor(NODE, -0.1)).toThrow();
    expect(() => annualPriceFor(NODE, 1)).toThrow();
  });
});

describe("effectiveDiscount", () => {
  it("matches the configured discount when no override", () => {
    expect(effectiveDiscount(NODE, 0.2)).toBeCloseTo(0.2, 4);
  });

  it("computes from override price", () => {
    expect(effectiveDiscount({ ...NODE, annualCents: 29_400 })).toBeCloseTo(
      0.5,
      4,
    );
  });
});

describe("quoteNewSubscription", () => {
  const NOW = new Date(Date.UTC(2026, 4, 12, 10)); // 2026-05-12T10:00Z

  it("monthly subscription charges monthly today + monthly recurring", () => {
    const q = quoteNewSubscription(NODE, "monthly", NOW);
    expect(q.todayCents).toBe(4_900);
    expect(q.recurringCents).toBe(4_900);
    expect(q.effectiveDiscount).toBe(0);
    expect(new Date(q.nextBillingMs).toISOString()).toBe(
      "2026-06-12T10:00:00.000Z",
    );
  });

  it("annual subscription charges annual today + annual recurring", () => {
    const q = quoteNewSubscription(NODE, "annual", NOW);
    expect(q.todayCents).toBe(48_804);
    expect(q.recurringCents).toBe(48_804);
    expect(q.effectiveDiscount).toBeCloseTo(0.17, 2);
    expect(new Date(q.nextBillingMs).toISOString()).toBe(
      "2027-05-12T10:00:00.000Z",
    );
  });
});

describe("prorateSwitch", () => {
  it("upgrade charges the difference for the remaining days", () => {
    // 15 of 30 days remaining on monthly cadence.
    const q = prorateSwitch(NODE, ENTERPRISE, "monthly", 15, 30);
    // Credit: 4900 * 15/30 = 2450; Debit: 49_900 * 15/30 = 24_950; Net: 22_500
    expect(q.todayCents).toBe(22_500);
    expect(q.recurringCents).toBe(49_900);
  });

  it("downgrade emits a NEGATIVE charge (credit / refund)", () => {
    const q = prorateSwitch(ENTERPRISE, STARTER, "monthly", 10, 30);
    // Credit: 49_900 * 20/30 ≈ 33_267; Debit: 1_900 * 20/30 ≈ 1_267; Net: -32_000
    expect(q.todayCents).toBeLessThan(0);
  });

  it("annual cadence applies the annual price formula", () => {
    const q = prorateSwitch(NODE, ENTERPRISE, "annual", 30, 365);
    const oldAnnual = annualPriceFor(NODE);
    const newAnnual = annualPriceFor(ENTERPRISE);
    const credit = Math.round((oldAnnual * 335) / 365);
    const debit = Math.round((newAnnual * 335) / 365);
    expect(Math.abs(q.todayCents - (debit - credit))).toBeLessThanOrEqual(1);
  });

  it("clamps daysElapsed to [0, daysInPeriod]", () => {
    const a = prorateSwitch(NODE, ENTERPRISE, "monthly", -5, 30);
    const b = prorateSwitch(NODE, ENTERPRISE, "monthly", 0, 30);
    expect(a.todayCents).toBe(b.todayCents);
    const c = prorateSwitch(NODE, ENTERPRISE, "monthly", 1000, 30);
    expect(c.todayCents).toBe(0); // remaining=0 → no charge
  });

  it("rejects non-positive period length", () => {
    expect(() => prorateSwitch(NODE, ENTERPRISE, "monthly", 0, 0)).toThrow();
  });
});

describe("cancelRefund", () => {
  it("returns 0 by default (subscription not refundable)", () => {
    expect(cancelRefund(NODE, "monthly", 5, 30)).toBe(0);
  });

  it("refunds the unused portion when refundUnused=true", () => {
    expect(cancelRefund(NODE, "monthly", 6, 30, true)).toBe(
      Math.round((NODE.monthlyCents * 24) / 30),
    );
  });
});

describe("addMonths", () => {
  it("adds whole months in UTC", () => {
    const r = addMonths(new Date(Date.UTC(2026, 4, 12)), 3);
    expect(r.toISOString()).toBe("2026-08-12T00:00:00.000Z");
  });

  it("clamps to end-of-month when day doesn't exist (Jan 31 → Feb 28)", () => {
    const r = addMonths(new Date(Date.UTC(2026, 0, 31)), 1);
    expect(r.toISOString()).toBe("2026-02-28T00:00:00.000Z");
  });

  it("respects leap years (Jan 31 2024 → Feb 29 2024)", () => {
    const r = addMonths(new Date(Date.UTC(2024, 0, 31)), 1);
    expect(r.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  });

  it("handles year rollovers", () => {
    const r = addMonths(new Date(Date.UTC(2026, 11, 15)), 2);
    expect(r.toISOString()).toBe("2027-02-15T00:00:00.000Z");
  });
});
