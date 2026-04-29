/**
 * FEDERATION V2 — Cross-Instance Reputation Aggregation (R50).
 *
 * The standards-moat substrate. Composes R36 (federation discovery)
 * with R40 (reputation) to produce a federated reputation grade
 * aggregated across all known Sovereign deployments.
 *
 * THE QUESTION THIS ANSWERS:
 *   "Has this agent EVER had a bad incident, on ANY Sovereign instance,
 *    not just this one?"
 *
 * Without federation: each deployment knows only its own reputation.
 * An agent banned from instance A could appear with no history on
 * instance B. That's a moat-killer for the trust story.
 *
 * With federation v2: customers see the aggregate reputation across
 * all known deployments. An agent's reversal on instance A shows up
 * everywhere. Reputation becomes network-wide property, not
 * deployment-local property.
 *
 * THE TRUST CONTRACT:
 *
 *   1. Each federation member publishes its agent reputation grades
 *      via /api/identity/reputation/[agentId] (already shipped R40).
 *   2. /api/identity/reputation/[agentId]/federated fetches grades
 *      from every known peer + the local instance.
 *   3. Aggregation function combines them deterministically.
 *   4. Output is a federated grade + the per-instance breakdown,
 *      so customers can verify exactly which instances reported what.
 *
 * AGGREGATION RULES (pure-function, deterministic):
 *
 *   - "min-of-known": federated grade = the WORST grade across
 *     instances (banking-grade conservatism — if ANY instance
 *     reports F, the federated grade is F).
 *   - Median numeric score across instances.
 *   - "concerning-instances": list of instances reporting < B.
 *   - The aggregator is conservative on purpose — federation
 *     reputation is a CEILING on trust, not an average.
 *
 * Pure function. No DB. Same inputs → same outputs. Ports to
 * @sovereign/inspector for offline verification.
 */

import type { LetterGrade } from "@/lib/agent-reputation";

// ── Types ──────────────────────────────────────────────────────────

export interface InstanceReputationReport {
  /** The deployment URL the report came from. */
  deploymentUrl: string;
  /** Agent id at this instance (may differ across instances if
   *  agents are versioned per deployment). */
  agentId: string;
  letterGrade: LetterGrade;
  numericScore: number;
  /** When the originating instance computed the score. */
  computedAt: string;
}

export interface FederatedReputation {
  /** Stable agent id (the one queried). */
  agentId: string;
  /** Number of instances that returned a score. */
  instanceCount: number;
  /** Number of instances that returned no_score_yet (excluded). */
  noScoreInstanceCount: number;
  /** Aggregated letter grade — WORST across instances (conservative). */
  federatedLetterGrade: LetterGrade;
  /** Median numeric score across instances. */
  medianNumericScore: number;
  /** Per-instance breakdown for verification. */
  perInstance: InstanceReputationReport[];
  /** Instances reporting C or worse. The "alert list." */
  concerningInstances: InstanceReputationReport[];
  /** True iff there is meaningful federated signal (>= 1 scored). */
  hasFederatedSignal: boolean;
  /** Timestamp of aggregation. */
  aggregatedAt: string;
}

// ── Grade ordering (pure) ──────────────────────────────────────────

const GRADE_RANK: Record<LetterGrade, number> = {
  "A+": 11,
  A: 10,
  "A-": 9,
  "B+": 8,
  B: 7,
  "B-": 6,
  "C+": 5,
  C: 4,
  "C-": 3,
  D: 2,
  F: 1,
  no_score_yet: 0,
};

const RANK_TO_GRADE: LetterGrade[] = [
  "no_score_yet",
  "F",
  "D",
  "C-",
  "C",
  "C+",
  "B-",
  "B",
  "B+",
  "A-",
  "A",
  "A+",
];

/**
 * Pure: order grades worst-to-best. Used internally by the aggregator.
 */
export function compareGrades(a: LetterGrade, b: LetterGrade): number {
  return GRADE_RANK[a] - GRADE_RANK[b];
}

// ── The aggregator (pure function) ─────────────────────────────────

/**
 * Aggregate per-instance reports into a single federated reputation.
 *
 * Pure function. No I/O. Same input array → same output, every time.
 *
 * Conservative semantics:
 *   - Federated grade = WORST across reporting instances. If even
 *     one instance reports F, the federated view is F. This is the
 *     "any incident is everyone's incident" stance — appropriate
 *     for a trust signal, not a marketing one.
 *   - "no_score_yet" is excluded from the worst-of computation but
 *     COUNTED in noScoreInstanceCount so customers see how many
 *     instances simply lack data.
 *   - Median (not average) numeric score — robust to a single
 *     bad-faith outlier.
 *
 * Edge cases:
 *   - Empty reports → no signal, federatedLetterGrade = "no_score_yet"
 *   - All reports are no_score_yet → no signal
 *   - Single report → that's the federated view
 */
export function aggregateFederatedReputation(input: {
  agentId: string;
  reports: InstanceReputationReport[];
  now?: Date;
}): FederatedReputation {
  const now = input.now ?? new Date();

  // Partition: scored vs unscored.
  const scored = input.reports.filter((r) => r.letterGrade !== "no_score_yet");
  const unscored = input.reports.filter(
    (r) => r.letterGrade === "no_score_yet",
  );

  if (scored.length === 0) {
    return {
      agentId: input.agentId,
      instanceCount: 0,
      noScoreInstanceCount: unscored.length,
      federatedLetterGrade: "no_score_yet",
      medianNumericScore: 0,
      perInstance: input.reports,
      concerningInstances: [],
      hasFederatedSignal: false,
      aggregatedAt: now.toISOString(),
    };
  }

  // WORST grade across scored instances.
  let worstGrade: LetterGrade = scored[0].letterGrade;
  for (const r of scored) {
    if (compareGrades(r.letterGrade, worstGrade) < 0) {
      worstGrade = r.letterGrade;
    }
  }

  // Median numeric score across scored instances.
  const sortedScores = [...scored.map((r) => r.numericScore)].sort(
    (a, b) => a - b,
  );
  const medianScore =
    sortedScores.length % 2 === 1
      ? sortedScores[Math.floor(sortedScores.length / 2)]
      : (sortedScores[sortedScores.length / 2 - 1] +
          sortedScores[sortedScores.length / 2]) /
        2;

  // Concerning instances: anything reporting BELOW B- (i.e. C+ or
  // worse). The threshold is "default-grade is B; anything that's
  // dropped below the B band is worth flagging to the customer."
  const concerningThreshold = GRADE_RANK["B-"];
  const concerning = scored.filter(
    (r) => GRADE_RANK[r.letterGrade] < concerningThreshold,
  );

  return {
    agentId: input.agentId,
    instanceCount: scored.length,
    noScoreInstanceCount: unscored.length,
    federatedLetterGrade: worstGrade,
    medianNumericScore: Math.round(medianScore * 100) / 100,
    perInstance: input.reports,
    concerningInstances: concerning,
    hasFederatedSignal: true,
    aggregatedAt: now.toISOString(),
  };
}

// ── Verifier (pure; ports to inspector) ─────────────────────────────

/**
 * Given a published federated reputation and the per-instance reports
 * it claims to be computed from, recompute locally and verify.
 *
 * Used by @sovereign/inspector for the trustless-loop closure on
 * federated reputation. Sovereign cannot fabricate a federated grade
 * if the inspector recomputes from the same source reports.
 */
export function verifyFederatedReputation(input: {
  publishedFederation: FederatedReputation;
  reports: InstanceReputationReport[];
}):
  | { valid: true }
  | {
      valid: false;
      reason: "grade_mismatch" | "score_mismatch" | "instance_count_mismatch";
      expected: FederatedReputation;
      published: FederatedReputation;
    } {
  const recomputed = aggregateFederatedReputation({
    agentId: input.publishedFederation.agentId,
    reports: input.reports,
  });

  if (
    recomputed.federatedLetterGrade !==
    input.publishedFederation.federatedLetterGrade
  ) {
    return {
      valid: false,
      reason: "grade_mismatch",
      expected: recomputed,
      published: input.publishedFederation,
    };
  }
  if (
    recomputed.medianNumericScore !== input.publishedFederation.medianNumericScore
  ) {
    return {
      valid: false,
      reason: "score_mismatch",
      expected: recomputed,
      published: input.publishedFederation,
    };
  }
  if (
    recomputed.instanceCount !== input.publishedFederation.instanceCount ||
    recomputed.noScoreInstanceCount !==
      input.publishedFederation.noScoreInstanceCount
  ) {
    return {
      valid: false,
      reason: "instance_count_mismatch",
      expected: recomputed,
      published: input.publishedFederation,
    };
  }
  return { valid: true };
}

// ── Diagnostic helper ──────────────────────────────────────────────

/**
 * Pure: returns a procurement-readable summary of federation
 * coverage. Used by /api/identity/reputation/[agentId]/federated
 * to surface "we asked N instances, M had data, the worst grade
 * was X."
 */
export function summarizeFederationCoverage(
  fed: FederatedReputation,
): string {
  const total = fed.instanceCount + fed.noScoreInstanceCount;
  if (total === 0) {
    return "No federation peers known.";
  }
  if (fed.instanceCount === 0) {
    return `${total} federation peers responded; none had a reputation score yet.`;
  }
  const concerning = fed.concerningInstances.length;
  const concerningSuffix =
    concerning > 0
      ? ` ${concerning} instance${concerning === 1 ? "" : "s"} reported a concerning grade (C or worse).`
      : "";
  return (
    `${fed.instanceCount} of ${total} federation peers reported a score. ` +
    `Federated grade (worst-of): ${fed.federatedLetterGrade}, median score: ${fed.medianNumericScore}.${concerningSuffix}`
  );
}

// Backwards-compat alias for grade ranking lookups (used by tests).
export const _internal = { GRADE_RANK, RANK_TO_GRADE };
