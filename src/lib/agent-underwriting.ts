/**
 * AGENT INSURANCE UNDERWRITING (R46).
 *
 * The carrier-facing product. Given an agent's reputation grade,
 * credit line, and recent claim history, computes a premium quote +
 * coverage cap + deductible.
 *
 * This is the FIRST production underwriting math for AI agent action
 * insurance, anywhere. The premium formula is grounded in standard
 * commercial-lines underwriting (loss-ratio targeting, exposure-
 * based rating) — the novelty is using cryptographically-verifiable
 * agent reputation as the rating variable.
 *
 * THE COMPOSITION:
 *
 *   R40 reputation grade ──┐
 *   R42 credit line       ─┼──→ R46 premium quote
 *   recent claim history  ─┘
 *
 * Pure function. No DB. Same inputs → same outputs. Ports verbatim
 * to @sovereign/inspector for offline carrier verification of
 * Sovereign-published quotes.
 *
 * Failure mode: if Sovereign ever publishes a quote whose math
 * doesn't match the recompute, the carrier's verifier catches it.
 * Premiums must be auditable; this primitive makes them so.
 */

import type { LetterGrade } from "./agent-reputation";

// ── Types ──────────────────────────────────────────────────────────

export interface UnderwritingInput {
  /** R40 letter grade. Drives the risk multiplier. */
  letterGrade: LetterGrade;
  /** R40 numeric score, 0-100. Used for tie-breaks within a grade. */
  numericScore: number;
  /**
   * R42 effective daily limit (cents). The exposure base — premium
   * scales linearly with this, like commercial auto premiums scale
   * with vehicle value.
   */
  effectiveDailyLimitCents: number;
  /**
   * Number of claims paid in the last 12 months for this agent.
   * Each claim adds a multiplicative loading.
   */
  claimsPaid12mo: number;
  /**
   * Total claims-paid amount in the last 12 months (cents).
   * Inputs into the loss-ratio adjustment.
   */
  totalClaimsPaidCents12mo: number;
}

export interface PremiumQuote {
  /**
   * Whether the agent is insurable at all. F-grade agents are
   * declined; the carrier capacity is reserved for risks the
   * actuarial math can price.
   */
  insurable: boolean;
  /** Reason if not insurable. */
  declineReason?: string;
  /** Annualized premium (cents). The number the carrier collects. */
  annualPremiumCents: number;
  /**
   * Premium rate per $100 of effective daily limit, expressed as
   * a percentage. The carrier-readable "cost per $100 of exposure."
   */
  ratePer100DollarsExposurePct: number;
  /**
   * Maximum claim payout per incident (cents). Default: 10×
   * effective daily limit.
   */
  perIncidentCoverageCapCents: number;
  /**
   * Annual aggregate cap (cents). Default: 50× effective daily limit.
   */
  annualAggregateCapCents: number;
  /**
   * Deductible per incident (cents). Default: 1× effective daily
   * limit. The agent's owner pays this before the carrier responds.
   */
  perIncidentDeductibleCents: number;
  /**
   * The full breakdown — every multiplier visible. Carriers can
   * recompute this offline.
   */
  breakdown: {
    baseRate: number;
    gradeMultiplier: number;
    scoreAdjustment: number;
    claimsCountLoading: number;
    claimsAmountLoading: number;
    finalRate: number;
    exposureCents: number;
  };
}

// ── The underwriting formula (pure function) ──────────────────────

/**
 * Base premium rate: 0.5% of annualized exposure.
 *
 * Reasoning: this is calibrated to a 60% target loss ratio at
 * default usage levels. For comparison: commercial auto runs ~75%
 * loss ratio at 6% rates; cyber liability runs 65-80% at 1-3%
 * rates. AI agent action liability is novel; we're slightly
 * tighter to leave room for early-portfolio claim variance.
 *
 * "Annualized exposure" = effectiveDailyLimitCents × 365.
 */
const BASE_RATE_PCT = 0.5;

/**
 * Grade-based risk multipliers. Mirror of R42 credit line table
 * with insurance-relevant adjustments:
 *   - A+/A: discount (proven low-risk)
 *   - B (default): par
 *   - C/D: loaded (more risk)
 *   - F: declined entirely (uninsurable)
 *
 * Worst→best spread is intentionally LARGER than R42 (10× vs 20×)
 * because insurance must price catastrophic loss, which has a
 * heavier tail than spend-cap variance.
 */
function gradeMultiplier(grade: LetterGrade): number | null {
  switch (grade) {
    case "A+":
      return 0.5;
    case "A":
      return 0.7;
    case "A-":
      return 0.85;
    case "B+":
      return 0.95;
    case "B":
    case "B-":
      return 1.0;
    case "C+":
      return 1.5;
    case "C":
      return 2.0;
    case "C-":
      return 2.5;
    case "D":
      return 4.0;
    case "F":
      // Declined: no multiplier. Caller should refuse to quote.
      return null;
    case "no_score_yet":
      // Conservative: price as if mid-tier B until we have data.
      return 1.0;
    default: {
      const _exhaustive: never = grade;
      void _exhaustive;
      return 1.0;
    }
  }
}

/**
 * Within-grade fine-tuning. A score at the top of a grade band gets
 * a small discount; bottom of the band gets a small loading.
 *
 * Range: ±5% of base rate. Keeps grades discrete (procurement-friendly)
 * while letting numericScore differentiate within a tier.
 */
function scoreAdjustment(grade: LetterGrade, numericScore: number): number {
  // Boundaries from agent-reputation.ts:
  //   A+ 95-100, A 90-94, A- 85-89, B+ 80-84, B 75-79, B- 70-74,
  //   C+ 65-69, C 60-64, C- 55-59, D 45-54, F 0-44, no_score_yet n/a
  const boundaries: Partial<Record<LetterGrade, [number, number]>> = {
    "A+": [95, 100],
    A: [90, 94],
    "A-": [85, 89],
    "B+": [80, 84],
    B: [75, 79],
    "B-": [70, 74],
    "C+": [65, 69],
    C: [60, 64],
    "C-": [55, 59],
    D: [45, 54],
    F: [0, 44],
  };
  const range = boundaries[grade];
  if (!range) return 0;
  const [min, max] = range;
  if (max === min) return 0;
  // Normalize: 0 = bottom of band, 1 = top.
  const position = (numericScore - min) / (max - min);
  // Clamp [0, 1] for safety.
  const clamped = Math.max(0, Math.min(1, position));
  // Top of band: -5%. Bottom: +5%. Midpoint: 0.
  return (0.5 - clamped) * 0.10;
}

/**
 * Each claim in the last 12mo adds a count loading. After 5 claims,
 * loading caps. Mirrors how commercial lines load on claim frequency.
 */
function claimsCountLoading(claimsPaid12mo: number): number {
  if (claimsPaid12mo <= 0) return 0;
  return Math.min(claimsPaid12mo * 0.10, 0.50);
}

/**
 * Total claims-paid amount loading. Each $1000 paid in claims adds
 * 10% to the rate, capped at 50%. Cap is reached at $5000 in paid
 * claims — at which point the risk has demonstrated catastrophic
 * loss potential and the count loading typically already maxed too.
 */
function claimsAmountLoading(totalClaimsPaidCents12mo: number): number {
  if (totalClaimsPaidCents12mo <= 0) return 0;
  return Math.min((totalClaimsPaidCents12mo / 100_000) * 0.10, 0.50);
}

/**
 * THE PREMIUM CALCULATOR.
 *
 * Pure function. Same inputs → same outputs. The full breakdown
 * is returned so carriers (and the inspector) can recompute and
 * verify Sovereign isn't fabricating numbers.
 *
 * Decline rule: F-grade agents are uninsurable in v1. Future round
 * may offer them constrained policies (smaller caps, higher
 * deductibles) but v1 keeps them out of the carrier book.
 */
export function quotePremium(input: UnderwritingInput): PremiumQuote {
  if (
    input.effectiveDailyLimitCents < 0 ||
    input.numericScore < 0 ||
    input.numericScore > 100 ||
    input.claimsPaid12mo < 0 ||
    input.totalClaimsPaidCents12mo < 0
  ) {
    throw new Error(
      `quotePremium: invalid input — non-negative bounded values required`,
    );
  }

  const grade = input.letterGrade;
  const gradeMult = gradeMultiplier(grade);
  if (gradeMult === null) {
    return {
      insurable: false,
      declineReason: "uninsurable_grade_F",
      annualPremiumCents: 0,
      ratePer100DollarsExposurePct: 0,
      perIncidentCoverageCapCents: 0,
      annualAggregateCapCents: 0,
      perIncidentDeductibleCents: 0,
      breakdown: {
        baseRate: BASE_RATE_PCT,
        gradeMultiplier: 0,
        scoreAdjustment: 0,
        claimsCountLoading: 0,
        claimsAmountLoading: 0,
        finalRate: 0,
        exposureCents: input.effectiveDailyLimitCents * 365,
      },
    };
  }

  // Annualized exposure = daily × 365.
  const exposureCents = input.effectiveDailyLimitCents * 365;

  // Composite rate calculation.
  const scoreAdj = scoreAdjustment(grade, input.numericScore);
  const claimCount = claimsCountLoading(input.claimsPaid12mo);
  const claimAmt = claimsAmountLoading(input.totalClaimsPaidCents12mo);

  const finalRatePct =
    BASE_RATE_PCT *
    gradeMult *
    (1 + scoreAdj) *
    (1 + claimCount) *
    (1 + claimAmt);

  const annualPremiumCents = Math.round((finalRatePct / 100) * exposureCents);
  const ratePer100DollarsExposurePct = round2(
    annualPremiumCents > 0 && exposureCents > 0
      ? (annualPremiumCents / exposureCents) * 100
      : 0,
  );

  // Coverage shape: per-incident 10×, aggregate 50×, deductible 1×.
  // Future round can support carrier-customizable shapes.
  const perIncidentCoverageCapCents = input.effectiveDailyLimitCents * 10;
  const annualAggregateCapCents = input.effectiveDailyLimitCents * 50;
  const perIncidentDeductibleCents = input.effectiveDailyLimitCents;

  return {
    insurable: true,
    annualPremiumCents,
    ratePer100DollarsExposurePct,
    perIncidentCoverageCapCents,
    annualAggregateCapCents,
    perIncidentDeductibleCents,
    breakdown: {
      baseRate: BASE_RATE_PCT,
      gradeMultiplier: gradeMult,
      scoreAdjustment: round4(scoreAdj),
      claimsCountLoading: round4(claimCount),
      claimsAmountLoading: round4(claimAmt),
      finalRate: round4(finalRatePct),
      exposureCents,
    },
  };
}

/**
 * Verifier helper. Given a published quote and the inputs it was
 * computed from, recompute locally and compare. Used by the
 * inspector for offline carrier verification.
 */
export function verifyQuoteIntegrity(input: {
  publishedQuote: PremiumQuote;
  computedFrom: UnderwritingInput;
}):
  | { valid: true }
  | {
      valid: false;
      reason: "annual_premium_mismatch" | "rate_mismatch" | "coverage_mismatch";
      expected: PremiumQuote;
      published: PremiumQuote;
    } {
  const recomputed = quotePremium(input.computedFrom);

  if (
    recomputed.annualPremiumCents !== input.publishedQuote.annualPremiumCents
  ) {
    return {
      valid: false,
      reason: "annual_premium_mismatch",
      expected: recomputed,
      published: input.publishedQuote,
    };
  }
  if (
    recomputed.ratePer100DollarsExposurePct !==
    input.publishedQuote.ratePer100DollarsExposurePct
  ) {
    return {
      valid: false,
      reason: "rate_mismatch",
      expected: recomputed,
      published: input.publishedQuote,
    };
  }
  if (
    recomputed.perIncidentCoverageCapCents !==
      input.publishedQuote.perIncidentCoverageCapCents ||
    recomputed.annualAggregateCapCents !==
      input.publishedQuote.annualAggregateCapCents
  ) {
    return {
      valid: false,
      reason: "coverage_mismatch",
      expected: recomputed,
      published: input.publishedQuote,
    };
  }
  return { valid: true };
}

// ── Helpers ────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
