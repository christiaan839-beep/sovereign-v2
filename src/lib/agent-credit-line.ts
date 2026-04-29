/**
 * AGENT CREDIT LINE CALCULATOR (Trust-as-Collateral).
 *
 * Round 42 — composes R26 (audit) + R30 (cost-runaway) + R40
 * (reputation) into a self-regulating economic loop. Reputation
 * grade modulates the daily spend limit.
 *
 * See docs/adr/0008-trust-as-collateral.md for the multiplier table
 * and design rationale.
 *
 * PURE FUNCTION DESIGN:
 *   - computeCreditLine() takes a letter grade + base limit and
 *     returns the effective limit + multiplier
 *   - multiplierForGrade() is the canonical multiplier table
 *   - framingForGrade() returns a procurement-friendly string
 *
 * Same inputs → same outputs, every time. Pure with respect to
 * the grade and base limit. Ports verbatim to @sovereign/inspector
 * for offline credit-line verification (the trustless-loop closure).
 *
 * Failure mode: if Sovereign ever publishes a credit line whose
 * effectiveDailyLimitCents doesn't match the recomputed value from
 * the published reputation grade + base limit, the inspector
 * catches it. The platform CANNOT lie about its own credit math.
 */

import type { LetterGrade } from "./agent-reputation";

// ── Types ──────────────────────────────────────────────────────────

export interface CreditLine {
  letterGrade: LetterGrade;
  numericScore: number;
  /** The multiplier applied to baseDailyLimitCents (0.25 → 5.0). */
  multiplier: number;
  /** The tenant plan's base limit (in cents) at compute time. */
  baseDailyLimitCents: number;
  /**
   * baseDailyLimitCents × multiplier, rounded to nearest cent.
   * This is the number that R43 will wire into cost-runaway.ts.
   */
  effectiveDailyLimitCents: number;
  /** Procurement-friendly framing string. */
  framing: string;
}

// ── The multiplier table (canonical) ───────────────────────────────

/**
 * Pure function. Given a letter grade, return the multiplier.
 *
 * The table is intentionally discrete (not interpolated from numeric
 * score) — see ADR-0008 "Why these multipliers?" The discrete table
 * preserves R40's letter-grade abstraction and makes
 * "A-grade or better" policies trivially expressible.
 *
 * Range: 0.25× (F) → 5.0× (A+). 20× spread between worst and best.
 *
 * Default unscored agents get 1.0× (default base, not penalized).
 */
export function multiplierForGrade(grade: LetterGrade): number {
  switch (grade) {
    case "A+":
      return 5.0;
    case "A":
      return 3.0;
    case "A-":
      return 2.0;
    case "B+":
      return 1.5;
    case "B":
      return 1.0;
    case "B-":
      return 1.0;
    case "C+":
      return 0.85;
    case "C":
      return 0.75;
    case "C-":
      return 0.65;
    case "D":
      return 0.5;
    case "F":
      return 0.25;
    case "no_score_yet":
      return 1.0;
    default: {
      // Exhaustive switch guard — typescript surfaces unhandled grades.
      const _exhaustive: never = grade;
      void _exhaustive;
      return 1.0;
    }
  }
}

/**
 * Pure function. Returns a human-readable framing string for the
 * grade, used in the procurement-facing credit-line endpoint.
 */
export function framingForGrade(grade: LetterGrade): string {
  switch (grade) {
    case "A+":
      return "Trusted veteran — high autonomy";
    case "A":
      return "Trusted — elevated autonomy";
    case "A-":
      return "Trusted — modestly elevated autonomy";
    case "B+":
      return "Above-default autonomy";
    case "B":
      return "Default — base autonomy";
    case "B-":
      return "Default — base autonomy";
    case "C+":
      return "Below-default — lightly restricted";
    case "C":
      return "Restricted autonomy";
    case "C-":
      return "More restricted autonomy";
    case "D":
      return "Heavily restricted autonomy";
    case "F":
      return "Probation — minimal autonomy";
    case "no_score_yet":
      return "Default — unproven, not penalized";
    default: {
      const _exhaustive: never = grade;
      void _exhaustive;
      return "Default — base autonomy";
    }
  }
}

// ── The calculator (pure function) ─────────────────────────────────

/**
 * Compute a credit line from a reputation grade + base daily limit.
 *
 * Pure function. Used by:
 *   - R42 daily cron (server-side compute, persists to
 *     agent_credit_lines)
 *   - R42 inspector port (offline recompute, verifies platform
 *     isn't lying)
 *   - Future R43 integration (cost-runaway.ts reads
 *     effectiveDailyLimitCents)
 *
 * Throws if baseDailyLimitCents is negative — that's a programmer
 * error in the caller, not a runtime trust signal.
 */
export function computeCreditLine(input: {
  letterGrade: LetterGrade;
  numericScore: number;
  baseDailyLimitCents: number;
}): CreditLine {
  if (input.baseDailyLimitCents < 0) {
    throw new Error(
      `computeCreditLine: baseDailyLimitCents must be >= 0, got ${input.baseDailyLimitCents}`,
    );
  }
  if (input.numericScore < 0 || input.numericScore > 100) {
    throw new Error(
      `computeCreditLine: numericScore must be in [0,100], got ${input.numericScore}`,
    );
  }
  const multiplier = multiplierForGrade(input.letterGrade);
  const effectiveDailyLimitCents = Math.round(
    input.baseDailyLimitCents * multiplier,
  );
  return {
    letterGrade: input.letterGrade,
    numericScore: input.numericScore,
    multiplier,
    baseDailyLimitCents: input.baseDailyLimitCents,
    effectiveDailyLimitCents,
    framing: framingForGrade(input.letterGrade),
  };
}

/**
 * Verifier helper. Given a published credit line and the inputs the
 * platform claimed it was computed from, recompute locally and
 * return whether the published number matches.
 *
 * Used by @sovereign/inspector and any third-party verifier.
 */
export function verifyCreditLineIntegrity(input: {
  publishedEffectiveDailyLimitCents: number;
  letterGrade: LetterGrade;
  numericScore: number;
  baseDailyLimitCents: number;
}):
  | { valid: true }
  | { valid: false; reason: "effective_limit_mismatch"; expected: number; published: number } {
  const recomputed = computeCreditLine({
    letterGrade: input.letterGrade,
    numericScore: input.numericScore,
    baseDailyLimitCents: input.baseDailyLimitCents,
  });
  if (recomputed.effectiveDailyLimitCents !== input.publishedEffectiveDailyLimitCents) {
    return {
      valid: false,
      reason: "effective_limit_mismatch",
      expected: recomputed.effectiveDailyLimitCents,
      published: input.publishedEffectiveDailyLimitCents,
    };
  }
  return { valid: true };
}
