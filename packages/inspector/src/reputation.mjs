/**
 * @sovereign/inspector — Public Agent Reputation port.
 *
 * Pure-function port of src/lib/agent-reputation.ts. Customers can
 * recompute reputation scores LOCALLY from raw on-chain signals.
 * Sovereign is not a required trust anchor — the math is the truth.
 *
 * Usage:
 *   import { computeReputationScore, gradeFromScore } from "@sovereign/inspector/reputation";
 *   const score = computeReputationScore(signals);
 */

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

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function gradeFromScore(score) {
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

export function computeReputationScore(s) {
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
  const reversalRatePct =
    s.totalChargeCount30d > 0
      ? (s.reversalCount30d / s.totalChargeCount30d) * 100
      : 0;
  const reversalPenalty = (reversalRatePct / 100) * REVERSAL_MAX_PENALTY;
  const hitlRejectionPct =
    s.totalHitlCount30d > 0
      ? (s.hitlDeniedCount30d / s.totalHitlCount30d) * 100
      : 0;
  const hitlPenalty = (hitlRejectionPct / 100) * HITL_MAX_PENALTY;
  const auditModifier = s.auditChainIntact ? AUDIT_INTACT_BONUS : -AUDIT_BROKEN_PENALTY;
  const ageBonus =
    Math.min(s.manifestAgeDays, AGE_DAYS_FOR_FULL_BONUS) /
    AGE_DAYS_FOR_FULL_BONUS *
    AGE_MAX_BONUS;
  const usageBonus =
    (Math.log(1 + Math.min(s.usageCount30d, USAGE_COUNT_FOR_FULL_BONUS)) /
      Math.log(1 + USAGE_COUNT_FOR_FULL_BONUS)) *
    USAGE_MAX_BONUS;
  const costBonus =
    s.costVsMedianPct < 0
      ? Math.min(Math.abs(s.costVsMedianPct) / 50, 1) * COST_MAX_BONUS
      : 0;
  const costEfficiencyScore = Math.round((costBonus / COST_MAX_BONUS) * 10);
  const anomalyPenalty = Math.min(s.anomalyCount30d / 5, 1) * ANOMALY_MAX_PENALTY;
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

export async function fetchReputation(deploymentUrl, agentId) {
  const url = `${deploymentUrl}/api/identity/reputation/${encodeURIComponent(agentId)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.json();
}

/**
 * Fetch the raw reputation signals (R41 trustless loop). Returns
 * { signals, publishedScore, formula } — everything a verifier
 * needs to reproduce the score locally.
 */
export async function fetchReputationSignals(deploymentUrl, agentId) {
  const url = `${deploymentUrl}/api/identity/reputation/${encodeURIComponent(agentId)}/signals`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.json();
}

/**
 * THE TRUSTLESS LOOP CLOSURE.
 *
 * Fetch raw signals from any Sovereign deployment, recompute the
 * score LOCALLY, compare to the platform's published score. Returns
 * `{match: true}` if the platform's claim is mathematically correct;
 * `{match: false}` if they differ — fabricated reputation.
 *
 * After R41, the platform CANNOT lie about reputation while this
 * verifier is running. Same primitive as R34/R37/R38: math is the
 * truth, not the platform's word.
 */
export async function verifyReputationLocally(deploymentUrl, agentId) {
  const data = await fetchReputationSignals(deploymentUrl, agentId);
  const { signals, publishedScore } = data;
  const recomputed = computeReputationScore(signals);
  const match =
    recomputed.letterGrade === publishedScore.letterGrade &&
    recomputed.numericScore === publishedScore.numericScore;
  return {
    match,
    agentId,
    deploymentUrl,
    signals,
    published: publishedScore,
    recomputed: {
      letterGrade: recomputed.letterGrade,
      numericScore: recomputed.numericScore,
      breakdown: recomputed.signalsBreakdown,
    },
    verificationRanLocally: true,
    note: match
      ? "Published score matches local recompute. The platform's reputation claim is mathematically correct."
      : "MISMATCH — published score differs from local recompute. Reputation is fabricated.",
  };
}
