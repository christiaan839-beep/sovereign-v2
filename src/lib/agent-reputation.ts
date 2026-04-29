/**
 * AGENT REPUTATION SCORE CALCULATOR.
 *
 * Round 40 — the network-effect substrate. Aggregates signals from
 * R26 audit + R30 reversals + R33 HITL rejections + R38 manifest age
 * into a procurement-readable score keyed by manifest ID.
 *
 * See docs/adr/0007-public-agent-reputation.md for design rationale.
 *
 * PURE FUNCTIONS:
 *   - computeReputationScore() takes raw signals and returns score + grade
 *   - gradeFromScore() converts numeric → letter grade
 *
 * The scoring math runs both server-side (daily cron) and ports to
 * @sovereign/inspector (R41) for offline recomputation. Reputation
 * scores must be reproducible from on-chain signals; no black-box
 * scoring.
 */

// ── Types ──────────────────────────────────────────────────────────

/**
 * Raw signal inputs gathered from the database. The cron computes
 * these via SQL queries and passes them to computeReputationScore().
 */
export interface ReputationSignals {
  /** Reversal count in last 30 days. */
  reversalCount30d: number;
  /** Total charge count in last 30 days (denominator for reversal rate). */
  totalChargeCount30d: number;
  /** HITL denied count in last 30 days. */
  hitlDeniedCount30d: number;
  /** Total HITL request count in last 30 days. */
  totalHitlCount30d: number;
  /** Did the last audit chain verification pass? */
  auditChainIntact: boolean;
  /** Days since the agent's manifest was first registered. */
  manifestAgeDays: number;
  /** Total agent usage events in last 30 days. */
  usageCount30d: number;
  /** Average cost per agent run, vs platform median. Negative = cheaper than median. */
  costVsMedianPct: number;
  /** Anomaly events in audit log in last 30 days. */
  anomalyCount30d: number;
}

export type LetterGrade =
  | "A+" | "A" | "A-"
  | "B+" | "B" | "B-"
  | "C+" | "C" | "C-"
  | "D"
  | "F"
  | "no_score_yet";

export interface ReputationScore {
  letterGrade: LetterGrade;
  numericScore: number;
  reversalRatePct: number;
  hitlRejectionPct: number;
  auditIntegrity: boolean;
  manifestAgeDays: number;
  usageCount30d: number;
  costEfficiencyScore: number;
  anomalyCount30d: number;
  signalsBreakdown: {
    base: number;
    reversalPenalty: number;
    hitlPenalty: number;
    auditModifier: number;
    ageBonus: number;
    usageBonus: number;
    costBonus: number;
    anomalyPenalty: number;
    finalRaw: number;
    finalClamped: number;
  };
}

// ── The calculator (pure function) ─────────────────────────────────

const BASE_SCORE = 75;
const REVERSAL_MAX_PENALTY = 30;
const HITL_MAX_PENALTY = 25;
const AUDIT_INTACT_BONUS = 15;
const AUDIT_BROKEN_PENALTY = 15;
const AGE_MAX_BONUS = 10;
const AGE_DAYS_FOR_FULL_BONUS = 365;
const USAGE_MAX_BONUS = 15;
const USAGE_COUNT_FOR_FULL_BONUS = 1000;
const COST_MAX_BONUS = 10;
const ANOMALY_MAX_PENALTY = 20;

/**
 * Compute a reputation score from raw signals.
 *
 * Pure function. Same inputs → same outputs, every time. Used both
 * by the daily cron AND ported to @sovereign/inspector for offline
 * verification.
 *
 * Edge case: an agent with NO usage data (manifestAgeDays=0,
 * usageCount30d=0, totalChargeCount30d=0, totalHitlCount30d=0) gets
 * "no_score_yet" — we don't make up scores from nothing.
 */
export function computeReputationScore(s: ReputationSignals): ReputationScore {
  // No-score edge case
  if (
    s.usageCount30d === 0 &&
    s.totalChargeCount30d === 0 &&
    s.totalHitlCount30d === 0 &&
    s.manifestAgeDays === 0
  ) {
    return {
      letterGrade: "no_score_yet",
      numericScore: 0,
      reversalRatePct: 0,
      hitlRejectionPct: 0,
      auditIntegrity: s.auditChainIntact,
      manifestAgeDays: s.manifestAgeDays,
      usageCount30d: s.usageCount30d,
      costEfficiencyScore: 5,
      anomalyCount30d: s.anomalyCount30d,
      signalsBreakdown: {
        base: BASE_SCORE,
        reversalPenalty: 0,
        hitlPenalty: 0,
        auditModifier: 0,
        ageBonus: 0,
        usageBonus: 0,
        costBonus: 0,
        anomalyPenalty: 0,
        finalRaw: 0,
        finalClamped: 0,
      },
    };
  }

  // Reversal rate (0 if no charges)
  const reversalRatePct =
    s.totalChargeCount30d > 0
      ? (s.reversalCount30d / s.totalChargeCount30d) * 100
      : 0;
  // Penalty: linear interpolation. 0% reversal = 0 penalty, 100% = max penalty.
  const reversalPenalty = (reversalRatePct / 100) * REVERSAL_MAX_PENALTY;

  // HITL rejection rate (0 if no HITL events)
  const hitlRejectionPct =
    s.totalHitlCount30d > 0
      ? (s.hitlDeniedCount30d / s.totalHitlCount30d) * 100
      : 0;
  const hitlPenalty = (hitlRejectionPct / 100) * HITL_MAX_PENALTY;

  // Audit chain integrity: binary swing
  const auditModifier = s.auditChainIntact ? AUDIT_INTACT_BONUS : -AUDIT_BROKEN_PENALTY;

  // Manifest age bonus: linear up to 1 year, then capped
  const ageBonus =
    Math.min(s.manifestAgeDays, AGE_DAYS_FOR_FULL_BONUS) /
    AGE_DAYS_FOR_FULL_BONUS *
    AGE_MAX_BONUS;

  // Usage bonus: log-scale (so first 100 uses matter most)
  // log(1 + usage) / log(1 + cap) * max
  const usageBonus =
    (Math.log(1 + Math.min(s.usageCount30d, USAGE_COUNT_FOR_FULL_BONUS)) /
      Math.log(1 + USAGE_COUNT_FOR_FULL_BONUS)) *
    USAGE_MAX_BONUS;

  // Cost efficiency: cheaper than median = bonus, more expensive = no bonus
  // costVsMedianPct of -50% (half the median cost) → full bonus
  // costVsMedianPct of 0% (at median) → 0 bonus
  // costVsMedianPct of +50% (50% over median) → 0 bonus (no penalty)
  const costBonus =
    s.costVsMedianPct < 0
      ? Math.min(Math.abs(s.costVsMedianPct) / 50, 1) * COST_MAX_BONUS
      : 0;
  const costEfficiencyScore = Math.round((costBonus / COST_MAX_BONUS) * 10);

  // Anomaly penalty: each anomaly hurts. 0 anomalies = 0 penalty,
  // 5+ anomalies = max penalty.
  const anomalyPenalty = Math.min(s.anomalyCount30d / 5, 1) * ANOMALY_MAX_PENALTY;

  // Final score
  const finalRaw =
    BASE_SCORE -
    reversalPenalty -
    hitlPenalty +
    auditModifier +
    ageBonus +
    usageBonus +
    costBonus -
    anomalyPenalty;
  const finalClamped = Math.max(0, Math.min(100, Math.round(finalRaw)));

  return {
    letterGrade: gradeFromScore(finalClamped),
    numericScore: finalClamped,
    reversalRatePct: round2(reversalRatePct),
    hitlRejectionPct: round2(hitlRejectionPct),
    auditIntegrity: s.auditChainIntact,
    manifestAgeDays: s.manifestAgeDays,
    usageCount30d: s.usageCount30d,
    costEfficiencyScore,
    anomalyCount30d: s.anomalyCount30d,
    signalsBreakdown: {
      base: BASE_SCORE,
      reversalPenalty: round2(reversalPenalty),
      hitlPenalty: round2(hitlPenalty),
      auditModifier,
      ageBonus: round2(ageBonus),
      usageBonus: round2(usageBonus),
      costBonus: round2(costBonus),
      anomalyPenalty: round2(anomalyPenalty),
      finalRaw: round2(finalRaw),
      finalClamped,
    },
  };
}

/**
 * Map numeric score (0-100) to letter grade.
 *
 * Boundaries chosen so a "default" agent (75 base, no signals) starts
 * at "B" — the procurement-friendly "decent until proven otherwise"
 * default.
 */
export function gradeFromScore(score: number): LetterGrade {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 65) return "C+";
  if (score >= 60) return "C";
  if (score >= 55) return "C-";
  if (score >= 45) return "D";
  return "F";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
