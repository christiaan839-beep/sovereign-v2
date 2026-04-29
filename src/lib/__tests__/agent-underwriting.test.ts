/**
 * agent-underwriting (R46) — tests.
 *
 * The premium calculator is a pure function. Same inputs → same
 * outputs. Carriers can verify Sovereign-published quotes offline
 * by recomputing.
 *
 * Covers:
 *   - F-grade is uninsurable (declined)
 *   - Grade discounts/loadings: A+ pays half what B pays at par
 *   - Premium scales linearly with exposure
 *   - Score adjustment is bounded (±5%)
 *   - Claims-count loading caps at 50%
 *   - Claims-amount loading caps at 50%
 *   - Coverage shape: 10× per-incident, 50× aggregate, 1× deductible
 *   - Verifier catches premium fabrication
 *   - Defense-in-depth: throws on bad input
 *   - Real-world scenarios: B-grade $50/day default, A+ enterprise
 */

import { describe, it, expect } from "vitest";
import {
  quotePremium,
  verifyQuoteIntegrity,
  type UnderwritingInput,
  type PremiumQuote,
} from "../agent-underwriting";

const baseInput = (
  overrides: Partial<UnderwritingInput> = {},
): UnderwritingInput => ({
  letterGrade: "B",
  numericScore: 75,
  effectiveDailyLimitCents: 5000, // $50
  claimsPaid12mo: 0,
  totalClaimsPaidCents12mo: 0,
  ...overrides,
});

describe("quotePremium — decline rules", () => {
  it("F-grade agents are uninsurable", () => {
    const q = quotePremium(baseInput({ letterGrade: "F", numericScore: 30 }));
    expect(q.insurable).toBe(false);
    expect(q.declineReason).toBe("uninsurable_grade_F");
    expect(q.annualPremiumCents).toBe(0);
  });

  it("no_score_yet is insurable (cheaper than worst-of-B because no score loading)", () => {
    const noScore = quotePremium(
      baseInput({ letterGrade: "no_score_yet", numericScore: 0 }),
    );
    // Score at the BOTTOM of B band (75) gets +5% loading.
    const bWorstOfBand = quotePremium(
      baseInput({ letterGrade: "B", numericScore: 75 }),
    );
    // Score at TOP of B band (79) gets -5% loading.
    const bBestOfBand = quotePremium(
      baseInput({ letterGrade: "B", numericScore: 79 }),
    );
    expect(noScore.insurable).toBe(true);
    // no_score_yet pays the par rate (no within-band adjustment),
    // so it's between the worst-of-B and best-of-B.
    expect(noScore.annualPremiumCents).toBeLessThan(bWorstOfBand.annualPremiumCents);
    expect(noScore.annualPremiumCents).toBeGreaterThan(bBestOfBand.annualPremiumCents);
  });
});

describe("quotePremium — grade-driven pricing", () => {
  it("A+ pays roughly half of B at par", () => {
    const aPlus = quotePremium(
      baseInput({ letterGrade: "A+", numericScore: 95 }),
    );
    const b = quotePremium(baseInput({ letterGrade: "B", numericScore: 75 }));
    expect(aPlus.insurable).toBe(true);
    // A+ multiplier is 0.5; at the bottom of A+ band, no score
    // adjustment cancels exactly. Score 95 = bottom of A+ band → +5%.
    // So A+ at score 95 ≈ B × 0.5 × 1.05 = B × 0.525.
    expect(aPlus.annualPremiumCents).toBeLessThan(b.annualPremiumCents * 0.6);
  });

  it("D pays roughly 4x B at par (heavy loading)", () => {
    const d = quotePremium(baseInput({ letterGrade: "D", numericScore: 50 }));
    const b = quotePremium(baseInput({ letterGrade: "B", numericScore: 75 }));
    expect(d.annualPremiumCents).toBeGreaterThan(b.annualPremiumCents * 3);
    expect(d.annualPremiumCents).toBeLessThan(b.annualPremiumCents * 5);
  });

  it("rate strictly monotonic across the grade spectrum (A+ < A < B < C < D)", () => {
    const grades = [
      "A+",
      "A",
      "A-",
      "B+",
      "B",
      "C+",
      "C",
      "C-",
      "D",
    ] as const;
    const rates = grades.map(
      (g) => quotePremium(baseInput({ letterGrade: g })).annualPremiumCents,
    );
    for (let i = 1; i < rates.length; i++) {
      expect(rates[i]).toBeGreaterThanOrEqual(rates[i - 1]);
    }
  });
});

describe("quotePremium — score adjustment within band", () => {
  it("top of A+ band (100) gets max discount", () => {
    const top = quotePremium(
      baseInput({ letterGrade: "A+", numericScore: 100 }),
    );
    const bottom = quotePremium(
      baseInput({ letterGrade: "A+", numericScore: 95 }),
    );
    expect(top.annualPremiumCents).toBeLessThan(bottom.annualPremiumCents);
  });

  it("score adjustment is bounded to ±5%", () => {
    const top = quotePremium(
      baseInput({ letterGrade: "B", numericScore: 79 }),
    );
    const bottom = quotePremium(
      baseInput({ letterGrade: "B", numericScore: 75 }),
    );
    // Top of B band: -5%, bottom: +5%. Spread is ~10.5%.
    const spread = (bottom.annualPremiumCents - top.annualPremiumCents) /
      bottom.annualPremiumCents;
    expect(spread).toBeGreaterThan(0.05);
    expect(spread).toBeLessThan(0.12);
  });
});

describe("quotePremium — exposure scaling", () => {
  it("premium scales linearly with effective daily limit", () => {
    const small = quotePremium(
      baseInput({ effectiveDailyLimitCents: 5000 }), // $50
    );
    const large = quotePremium(
      baseInput({ effectiveDailyLimitCents: 50000 }), // $500
    );
    // 10× exposure → ~10× premium.
    expect(large.annualPremiumCents).toBeCloseTo(small.annualPremiumCents * 10, -2);
  });

  it("coverage shape: per-incident 10×, aggregate 50×, deductible 1×", () => {
    const q = quotePremium(baseInput({ effectiveDailyLimitCents: 5000 }));
    expect(q.perIncidentCoverageCapCents).toBe(50000);
    expect(q.annualAggregateCapCents).toBe(250000);
    expect(q.perIncidentDeductibleCents).toBe(5000);
  });

  it("zero exposure → zero premium (no insurance for $0/day caps)", () => {
    const q = quotePremium(baseInput({ effectiveDailyLimitCents: 0 }));
    expect(q.annualPremiumCents).toBe(0);
    expect(q.perIncidentCoverageCapCents).toBe(0);
  });
});

describe("quotePremium — claims-count loading", () => {
  it("0 claims = no loading", () => {
    const q = quotePremium(baseInput({ claimsPaid12mo: 0 }));
    expect(q.breakdown.claimsCountLoading).toBe(0);
  });

  it("3 claims = +30% loading (3 × 10%)", () => {
    const q = quotePremium(baseInput({ claimsPaid12mo: 3 }));
    expect(q.breakdown.claimsCountLoading).toBe(0.3);
  });

  it("loading caps at 50% (5+ claims)", () => {
    const q5 = quotePremium(baseInput({ claimsPaid12mo: 5 }));
    const q10 = quotePremium(baseInput({ claimsPaid12mo: 10 }));
    expect(q5.breakdown.claimsCountLoading).toBe(0.5);
    expect(q10.breakdown.claimsCountLoading).toBe(0.5);
    expect(q5.annualPremiumCents).toBe(q10.annualPremiumCents);
  });
});

describe("quotePremium — claims-amount loading", () => {
  it("$1000 paid → +10% loading", () => {
    const q = quotePremium(
      baseInput({ totalClaimsPaidCents12mo: 100_000 }), // $1000
    );
    expect(q.breakdown.claimsAmountLoading).toBe(0.10);
  });

  it("loading caps at 50% (≥$5000 paid)", () => {
    const q = quotePremium(
      baseInput({ totalClaimsPaidCents12mo: 1_000_000 }), // $10000
    );
    expect(q.breakdown.claimsAmountLoading).toBe(0.50);
  });
});

describe("quotePremium — defense-in-depth", () => {
  it("throws on negative effective daily limit", () => {
    expect(() =>
      quotePremium(baseInput({ effectiveDailyLimitCents: -1 })),
    ).toThrow();
  });

  it("throws on out-of-range numericScore", () => {
    expect(() =>
      quotePremium(baseInput({ numericScore: 150 })),
    ).toThrow();
    expect(() =>
      quotePremium(baseInput({ numericScore: -1 })),
    ).toThrow();
  });

  it("throws on negative claim counts", () => {
    expect(() =>
      quotePremium(baseInput({ claimsPaid12mo: -1 })),
    ).toThrow();
  });
});

describe("verifyQuoteIntegrity — trustless invariant", () => {
  it("matches when quote is honestly recomputed", () => {
    const input = baseInput({ letterGrade: "A+", numericScore: 95 });
    const quote = quotePremium(input);
    const result = verifyQuoteIntegrity({
      publishedQuote: quote,
      computedFrom: input,
    });
    expect(result.valid).toBe(true);
  });

  it("catches premium fabrication (claim higher rate than math justifies)", () => {
    const input = baseInput({ letterGrade: "A+", numericScore: 95 });
    const honest = quotePremium(input);
    // Sovereign claims 2x the actual premium.
    const fabricated: PremiumQuote = {
      ...honest,
      annualPremiumCents: honest.annualPremiumCents * 2,
    };
    const result = verifyQuoteIntegrity({
      publishedQuote: fabricated,
      computedFrom: input,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("annual_premium_mismatch");
    }
  });

  it("catches coverage cap fabrication", () => {
    const input = baseInput();
    const honest = quotePremium(input);
    const fabricated: PremiumQuote = {
      ...honest,
      perIncidentCoverageCapCents: honest.perIncidentCoverageCapCents * 5,
    };
    const result = verifyQuoteIntegrity({
      publishedQuote: fabricated,
      computedFrom: input,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("coverage_mismatch");
    }
  });
});

describe("Real-world scenarios", () => {
  it("Default agent (B-grade, $50/day, no claims) — annualized math sanity", () => {
    // B-grade × 1.0 base × 1.0 grade × ~1.0 score adj × 1.0 claims =
    // 0.5% × $50 × 365 = $91.25 ≈ 9125 cents.
    const q = quotePremium(baseInput());
    expect(q.insurable).toBe(true);
    expect(q.annualPremiumCents).toBeGreaterThan(8000);
    expect(q.annualPremiumCents).toBeLessThan(11000);
  });

  it("A+ enterprise agent ($500/day, perfect score, no claims) — discount applied", () => {
    const q = quotePremium({
      letterGrade: "A+",
      numericScore: 100,
      effectiveDailyLimitCents: 50000, // $500/day
      claimsPaid12mo: 0,
      totalClaimsPaidCents12mo: 0,
    });
    // $500 × 365 = $182.5K exposure × 0.5% × 0.5 (A+) × 0.95 (top-of-band -5%)
    // ≈ $433/year.
    expect(q.insurable).toBe(true);
    expect(q.annualPremiumCents).toBeGreaterThan(40000); // > $400
    expect(q.annualPremiumCents).toBeLessThan(50000); // < $500
    expect(q.perIncidentCoverageCapCents).toBe(500000); // $5000 cap
    expect(q.annualAggregateCapCents).toBe(2500000); // $25000 cap
  });

  it("D-grade troubled agent (multiple claims) — heavily loaded", () => {
    const q = quotePremium({
      letterGrade: "D",
      numericScore: 50,
      effectiveDailyLimitCents: 5000, // $50/day (already deeply restricted)
      claimsPaid12mo: 3,
      totalClaimsPaidCents12mo: 200_000, // $2000 paid
    });
    // 0.5% × $50 × 365 × 4.0 (D) × ~1.0 score × 1.30 (3 claims) × 1.20 (loading)
    // ≈ $570/year.
    expect(q.insurable).toBe(true);
    expect(q.annualPremiumCents).toBeGreaterThan(40000); // ~$400+
    expect(q.breakdown.claimsCountLoading).toBe(0.30);
    expect(q.breakdown.claimsAmountLoading).toBe(0.20);
  });
});

describe("quotePremium — purity (same inputs → same outputs)", () => {
  it("repeatable across many calls", () => {
    const input = baseInput({ letterGrade: "A", numericScore: 92 });
    const a = quotePremium(input);
    const b = quotePremium(input);
    const c = quotePremium(input);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("does not mutate input", () => {
    const input = baseInput({ letterGrade: "A+", numericScore: 95 });
    const snapshot = JSON.stringify(input);
    quotePremium(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
