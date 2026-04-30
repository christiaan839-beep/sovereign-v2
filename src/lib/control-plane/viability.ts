/**
 * R140 Behavioral Invariant Layer (IML) + R141 Viability Index (RiskGate).
 *
 * Move 5 of the proof-conversion arc — the pure-function drift-detection
 * + trustworthiness-score primitives that compose UPSTREAM of R100's
 * policy gate. The agent factory's wrapper calls evaluateViabilityGate()
 * BEFORE evaluatePolicyGate(); a sub-block VI(t) forces HITL escalation
 * even when the policy itself would have allowed the action.
 *
 * STRATEGIC PURPOSE:
 *
 *   The R100 Policy Engine catches denied actions. It does NOT catch
 *   the slow drift where an agent's behavior — earned through
 *   individually-legitimate actions — has crept beyond its admission-
 *   time profile. Enforcement-based governance is structurally blind
 *   to this drift: the enforcement signal operates BELOW the layer
 *   where deviation is measurable.
 *
 *   The IML retains direct access to the admissible behavior space A₀
 *   established at agent admission time, operating ABOVE the policy
 *   gate's enforcement boundary. RiskGate converts the IML's
 *   divergence statistics into a continuous Viability Index VI(t) ∈
 *   [-1, +1] — predictive, not reactive.
 *
 * EU AI ACT MAPPING (Art. 3(23) "substantial modification"):
 *
 *   The August 2026 high-risk obligations require providers to
 *   demonstrate that behavioral drift is traceable, measurable, and
 *   governed. Untraceable drift renders a high-risk system non-
 *   compliant. The audit-action `agent.drift_detected` (R140) and
 *   `agent.viability_threshold` (R141), already in the audit-log
 *   vocabulary, give EU regulators per-action proof of governance.
 *
 * DESIGN DISCIPLINE:
 *
 *   1. Pure-function. No I/O. No clocks (caller passes recent action
 *      history with timestamps). Ports verbatim to
 *      @sovereign/inspector for offline regulator-runnable verification.
 *
 *   2. Default-OFF. Both the IML and RiskGate are gated behind
 *      SOVEREIGN_VIABILITY_GATE_ENABLED. Without the flag, the gate
 *      is a no-op — same posture as R100 in Move 2.
 *
 *   3. Composes with shipped primitives. VI(t) ranges over [-1, +1]
 *      and pairs naturally with R100 verdicts: VI ≥ blockThreshold
 *      AND policy = allow → proceed; VI < blockThreshold → forced
 *      HITL escalation regardless of policy verdict.
 *
 *   4. Statistical receipts. Every divergence detection records WHICH
 *      statistic fired (KL divergence / segment-vs-rest z-test /
 *      sequential pattern), the observed value, the threshold, and
 *      the action-class breakdown. SOC 2 / EU AI Act auditors filter
 *      on these to see proof of governance.
 *
 *   5. Sequential, not batch. The IML accepts a sliding-window action
 *      stream and emits a verdict per-invocation. No retraining loop;
 *      the admission-time A₀ profile is the immutable baseline.
 */

import { createHash } from "node:crypto";

// ── Feature flag ───────────────────────────────────────────────────

/**
 * Pure: read the feature flag at evaluation time. Module-load cache
 * intentionally avoided — operators flipping the env var without a
 * redeploy is a critical incident-response capability (same posture
 * as the R100 gate flag).
 */
export function isViabilityGateEnabled(): boolean {
  return process.env.SOVEREIGN_VIABILITY_GATE_ENABLED === "true";
}

// ── Action-class taxonomy ──────────────────────────────────────────

/**
 * The coarse-grained action taxonomy the IML tracks. Each action an
 * agent takes is mapped to one of these classes; the admission-time
 * profile A₀ records the empirical distribution of classes across
 * the agent's first N invocations (default N = 50).
 *
 * Why coarse rather than fine-grained: drift detection at the level
 * of individual tool calls is too noisy for a useful signal; drift
 * at the level of action classes (e.g., "this agent suddenly does
 * 5x more external_write than its baseline") is the pattern auditors
 * actually care about.
 */
export type AgentActionClass =
  | "internal_read"
  | "internal_write"
  | "external_read"
  | "external_write"
  | "tool_call"
  | "delegate"
  | "memory_write"
  | "memory_retrieve"
  | "human_escalate"
  | "policy_consult";

export const AGENT_ACTION_CLASSES: ReadonlyArray<AgentActionClass> = [
  "internal_read",
  "internal_write",
  "external_read",
  "external_write",
  "tool_call",
  "delegate",
  "memory_write",
  "memory_retrieve",
  "human_escalate",
  "policy_consult",
];

// ── Admission-time profile A₀ ──────────────────────────────────────

/**
 * The immutable admission-time profile of an agent's behavior. Set
 * during the agent's first N invocations (default N = 50) and never
 * mutated thereafter. The IML detects drift as divergence between
 * the SLIDING WINDOW of recent invocations vs. this baseline.
 *
 * The profile is hash-anchored so any post-hoc tampering breaks the
 * R26 audit chain when the IML's verdict references the profileHash.
 */
export interface AdmissionProfile {
  /** Stable agent id (matches AgentConfig.name). */
  agentId: string;
  /** ISO 8601 — when the profile was sealed (admission moment). */
  sealedAt: string;
  /** Number of invocations the profile was averaged over. */
  sampleSize: number;
  /** Per-class empirical frequency. Sums to 1.0. */
  classDistribution: Record<AgentActionClass, number>;
  /** Mean cost per invocation in cents (R102 baseline). */
  meanCostCents: number;
  /** Mean tool-call count per invocation. */
  meanToolCalls: number;
  /** SHA-256 of the canonical-encoded profile (anchors audit-chain references). */
  profileHash: string;
}

/**
 * Pure: compute the canonical hash of an admission profile. Used
 * by audit entries that reference the profile so any tampering with
 * the stored profile breaks the chain on next verification.
 */
export function hashAdmissionProfile(
  args: Omit<AdmissionProfile, "profileHash">,
): string {
  const canonical = [
    args.agentId,
    args.sealedAt,
    String(args.sampleSize),
    AGENT_ACTION_CLASSES.map(
      (k) => `${k}=${(args.classDistribution[k] ?? 0).toFixed(8)}`,
    ).join(","),
    `cost=${args.meanCostCents.toFixed(2)}`,
    `tools=${args.meanToolCalls.toFixed(4)}`,
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * One row in the admission-window action log. Caller assembles N of
 * these from the agent's first N invocations and passes to
 * sealAdmissionProfile.
 */
export interface AdmissionAction {
  classification: AgentActionClass;
  costCents: number;
  toolCalls: number;
}

export const ADMISSION_MIN_SAMPLES = 10;
export const ADMISSION_DEFAULT_TARGET = 50;

export type AdmissionSeal =
  | { ok: true; profile: AdmissionProfile }
  | {
      ok: false;
      reason: "insufficient_samples" | "empty_input";
      details: string;
    };

/**
 * Pure: seal an admission profile from a sequence of admission-window
 * action records. Validates that sampleSize meets the minimum and
 * that the input is non-empty.
 */
export function sealAdmissionProfile(input: {
  agentId: string;
  sealedAt: string;
  actions: ReadonlyArray<AdmissionAction>;
}): AdmissionSeal {
  if (!input.actions || input.actions.length === 0) {
    return {
      ok: false,
      reason: "empty_input",
      details: "actions array is required and non-empty.",
    };
  }
  if (input.actions.length < ADMISSION_MIN_SAMPLES) {
    return {
      ok: false,
      reason: "insufficient_samples",
      details: `at least ${ADMISSION_MIN_SAMPLES} samples required; got ${input.actions.length}.`,
    };
  }
  const counts: Record<AgentActionClass, number> = emptyClassCounts();
  let totalCost = 0;
  let totalTools = 0;
  for (const a of input.actions) {
    counts[a.classification] += 1;
    totalCost += a.costCents;
    totalTools += a.toolCalls;
  }
  const n = input.actions.length;
  const classDistribution = countsToDistribution(counts, n);
  const base = {
    agentId: input.agentId,
    sealedAt: input.sealedAt,
    sampleSize: n,
    classDistribution,
    meanCostCents: totalCost / n,
    meanToolCalls: totalTools / n,
  };
  return {
    ok: true,
    profile: { ...base, profileHash: hashAdmissionProfile(base) },
  };
}

/** Helper: zeroed counts for every action class. */
function emptyClassCounts(): Record<AgentActionClass, number> {
  return {
    internal_read: 0,
    internal_write: 0,
    external_read: 0,
    external_write: 0,
    tool_call: 0,
    delegate: 0,
    memory_write: 0,
    memory_retrieve: 0,
    human_escalate: 0,
    policy_consult: 0,
  };
}

/** Helper: counts → frequencies (divide by sample size). */
function countsToDistribution(
  counts: Record<AgentActionClass, number>,
  n: number,
): Record<AgentActionClass, number> {
  const out = emptyClassCounts();
  for (const k of AGENT_ACTION_CLASSES) {
    out[k] = (counts[k] ?? 0) / n;
  }
  return out;
}

// ── Sliding window (recent invocations) ────────────────────────────

/**
 * The recent action stream the IML compares against the admission
 * profile. Caller maintains the window — the IML is pure and stateless.
 */
export interface RecentAction {
  classification: AgentActionClass;
  costCents: number;
  toolCalls: number;
  /** ISO 8601 — when the action ran. */
  at: string;
}

export const DEFAULT_WINDOW_SIZE = 30;
export const MIN_WINDOW_FOR_VERDICT = 10;

// ── Statistical primitives ────────────────────────────────────────

/**
 * Pure: KL divergence between two categorical distributions over
 * AGENT_ACTION_CLASSES. Smooths zero entries by Laplace add-α
 * (default α = 0.01) to avoid log(0). Returns nat (natural-log) units.
 */
export function klDivergenceClass(
  p: Record<AgentActionClass, number>,
  q: Record<AgentActionClass, number>,
  alpha: number = 0.01,
): number {
  let kl = 0;
  const n = AGENT_ACTION_CLASSES.length;
  for (const k of AGENT_ACTION_CLASSES) {
    const pi = (p[k] ?? 0) + alpha;
    const qi = (q[k] ?? 0) + alpha;
    const piNorm = pi / (1 + alpha * n);
    const qiNorm = qi / (1 + alpha * n);
    kl += piNorm * Math.log(piNorm / qiNorm);
  }
  return kl;
}

/**
 * Pure: per-class z-test on segment-vs-rest. For each action class,
 * compute the z-score of (window frequency − baseline frequency)
 * against the binomial standard error. Returns the MAX |z| across
 * classes — the most-divergent class.
 *
 * Useful complement to KL divergence: KL is symmetric, but z-test
 * tells you WHICH class drove the divergence.
 */
export interface SegmentZResult {
  maxAbsZ: number;
  drivingClass: AgentActionClass;
  observed: number;
  expected: number;
}

export function segmentVsRestZ(
  windowDist: Record<AgentActionClass, number>,
  baseline: Record<AgentActionClass, number>,
  windowSize: number,
  alpha: number = 0.01,
): SegmentZResult {
  let maxAbsZ = 0;
  let driving: AgentActionClass = "internal_read";
  let obs = 0;
  let exp = 0;
  const n = AGENT_ACTION_CLASSES.length;
  for (const k of AGENT_ACTION_CLASSES) {
    // Laplace add-α smoothing on baseline so classes with p=0 don't get
    // skipped — a window observation of 90% on a class the baseline
    // never produced is exactly the drift we MUST flag.
    const p = ((baseline[k] ?? 0) + alpha) / (1 + alpha * n);
    const q = windowDist[k] ?? 0;
    const se = Math.sqrt((p * (1 - p)) / windowSize);
    if (se === 0) continue;
    const z = (q - p) / se;
    if (Math.abs(z) > Math.abs(maxAbsZ)) {
      maxAbsZ = z;
      driving = k;
      obs = q;
      exp = p;
    }
  }
  return { maxAbsZ, drivingClass: driving, observed: obs, expected: exp };
}

/**
 * Pure: detect a sequential pattern that admission-time A₀ never
 * exhibited. Implements a simple n-gram check over the last K
 * action classifications. If the most-recent K-gram has empirical
 * probability < ε under A₀ (estimated via the marginals), flag it.
 *
 * The point is to catch "novel macro-behaviors" (e.g., a sequence
 * of `tool_call → external_write → memory_write` that the agent
 * never produced during admission) that aggregate distribution
 * statistics miss.
 *
 * Approximates joint probability as product of marginals — a naive
 * independence assumption, but the IML doesn't store joint
 * distributions and this is the cheapest-faithful approximation.
 */
export interface SequentialPatternResult {
  noveltyDetected: boolean;
  pattern: AgentActionClass[];
  /** Empirical probability under A₀; small means novel. */
  baselineProbability: number;
}

export const DEFAULT_NGRAM_LENGTH = 3;
export const NOVELTY_PROBABILITY_THRESHOLD = 0.001;

export function detectSequentialNovelty(
  recent: ReadonlyArray<RecentAction>,
  baseline: AdmissionProfile,
  ngramLength: number = DEFAULT_NGRAM_LENGTH,
  noveltyThreshold: number = NOVELTY_PROBABILITY_THRESHOLD,
): SequentialPatternResult {
  if (recent.length < ngramLength) {
    return {
      noveltyDetected: false,
      pattern: [],
      baselineProbability: 1,
    };
  }
  const lastNgram = recent.slice(-ngramLength).map((r) => r.classification);
  let p = 1;
  for (const k of lastNgram) {
    const pk = baseline.classDistribution[k] ?? 0;
    p *= pk;
  }
  return {
    noveltyDetected: p < noveltyThreshold,
    pattern: lastNgram,
    baselineProbability: p,
  };
}

// ── IML Verdict ────────────────────────────────────────────────────

/**
 * The IML's verdict combines all three statistics into one structured
 * result. Caller (RiskGate, below) converts this into a continuous VI(t).
 */
export interface IMLVerdict {
  /** Was drift detected on at least one statistic? */
  driftDetected: boolean;
  /** KL divergence (nat units) between window and baseline. */
  klDivergence: number;
  /** Max segment-vs-rest z-score. */
  segmentZ: SegmentZResult;
  /** Sequential novelty check. */
  novelty: SequentialPatternResult;
  /** Window size used. */
  windowSize: number;
  /** Profile hash (anchors any audit reference). */
  profileHash: string;
  /** Procurement-readable summary (≤200 chars). */
  summary: string;
}

/** Default thresholds — tunable via runIML options. */
export const DEFAULT_KL_BLOCK_THRESHOLD = 0.5;
export const DEFAULT_KL_WARN_THRESHOLD = 0.2;
export const DEFAULT_Z_BLOCK_THRESHOLD = 4.0;
export const DEFAULT_Z_WARN_THRESHOLD = 2.5;

export interface IMLOptions {
  klBlockThreshold?: number;
  klWarnThreshold?: number;
  zBlockThreshold?: number;
  zWarnThreshold?: number;
  ngramLength?: number;
  noveltyProbabilityThreshold?: number;
}

/**
 * Pure: run the IML over a recent action window and admission profile.
 *
 * Returns the structured verdict. Caller composes with RiskGate
 * (computeViability) to translate into VI(t) and a block/escalate
 * decision.
 */
export function runIML(input: {
  recent: ReadonlyArray<RecentAction>;
  baseline: AdmissionProfile;
  options?: IMLOptions;
}): IMLVerdict {
  const opts = input.options ?? {};
  const klBlock = opts.klBlockThreshold ?? DEFAULT_KL_BLOCK_THRESHOLD;
  const zBlock = opts.zBlockThreshold ?? DEFAULT_Z_BLOCK_THRESHOLD;
  const klWarn = opts.klWarnThreshold ?? DEFAULT_KL_WARN_THRESHOLD;
  const zWarn = opts.zWarnThreshold ?? DEFAULT_Z_WARN_THRESHOLD;

  const windowSize = input.recent.length;
  if (windowSize < MIN_WINDOW_FOR_VERDICT) {
    return {
      driftDetected: false,
      klDivergence: 0,
      segmentZ: {
        maxAbsZ: 0,
        drivingClass: "internal_read",
        observed: 0,
        expected: 0,
      },
      novelty: {
        noveltyDetected: false,
        pattern: [],
        baselineProbability: 1,
      },
      windowSize,
      profileHash: input.baseline.profileHash,
      summary: `IML insufficient samples (window=${windowSize}, need ≥${MIN_WINDOW_FOR_VERDICT})`,
    };
  }

  // Compute window distribution.
  const counts = emptyClassCounts();
  for (const a of input.recent) counts[a.classification] += 1;
  const windowDist = countsToDistribution(counts, windowSize);

  const kl = klDivergenceClass(windowDist, input.baseline.classDistribution);
  const segZ = segmentVsRestZ(
    windowDist,
    input.baseline.classDistribution,
    windowSize,
  );
  const novelty = detectSequentialNovelty(
    input.recent,
    input.baseline,
    opts.ngramLength,
    opts.noveltyProbabilityThreshold,
  );

  const driftDetected =
    kl >= klBlock ||
    Math.abs(segZ.maxAbsZ) >= zBlock ||
    novelty.noveltyDetected;

  // Procurement-readable summary.
  const flags: string[] = [];
  if (kl >= klBlock) flags.push(`KL=${kl.toFixed(3)}≥${klBlock}`);
  else if (kl >= klWarn) flags.push(`KL=${kl.toFixed(3)}≥${klWarn} (warn)`);
  if (Math.abs(segZ.maxAbsZ) >= zBlock)
    flags.push(`z=${segZ.maxAbsZ.toFixed(2)} on ${segZ.drivingClass}`);
  else if (Math.abs(segZ.maxAbsZ) >= zWarn)
    flags.push(`z=${segZ.maxAbsZ.toFixed(2)} on ${segZ.drivingClass} (warn)`);
  if (novelty.noveltyDetected)
    flags.push(`novel-${novelty.pattern.length}gram (p=${novelty.baselineProbability.toExponential(2)})`);
  const summary =
    flags.length === 0
      ? `IML ok (KL=${kl.toFixed(3)}, z=${segZ.maxAbsZ.toFixed(2)})`
      : `IML drift: ${flags.join(" · ")}`;

  return {
    driftDetected,
    klDivergence: kl,
    segmentZ: segZ,
    novelty,
    windowSize,
    profileHash: input.baseline.profileHash,
    summary: summary.slice(0, 200),
  };
}

// ── RiskGate Viability Index VI(t) ─────────────────────────────────

/**
 * The Viability Index is a continuous trustworthiness score in
 * [-1, +1]. Mapping rules (transparent, replayable, deliberately
 * not opaque ML — same posture as R130's leastSquaresFit):
 *
 *   start at +1
 *   subtract penalty proportional to KL/klBlock (capped at 1.0)
 *   subtract penalty proportional to |z|/zBlock (capped at 0.5)
 *   subtract 0.4 if sequential novelty detected
 *   floor at -1, ceiling at +1
 *
 * VI ≥ allowThreshold (default +0.3) → proceed
 * VI ∈ [escalateThreshold, allowThreshold) → forced HITL escalation
 * VI < escalateThreshold (default -0.3) → block outright
 *
 * The thresholds are tunable per-deployment so a high-stakes finance
 * tenant can run with stricter values than an internal R&D tenant.
 */
export const DEFAULT_ALLOW_THRESHOLD = 0.3;
export const DEFAULT_ESCALATE_THRESHOLD = -0.3;

export interface ViabilityScore {
  /** VI(t) ∈ [-1, +1]. */
  vi: number;
  /** What the score recommends. */
  recommendation: "proceed" | "escalate_hitl" | "block";
  /** Procurement-readable rationale (≤200 chars). */
  rationale: string;
  /** Per-component contributions to the penalty (sum + VI ≈ 1). */
  penalties: {
    kl: number;
    z: number;
    novelty: number;
  };
}

export interface RiskGateOptions {
  allowThreshold?: number;
  escalateThreshold?: number;
  klBlockThreshold?: number;
  zBlockThreshold?: number;
}

/**
 * Pure: compute the Viability Index from an IML verdict.
 */
export function computeViability(input: {
  imlVerdict: IMLVerdict;
  options?: RiskGateOptions;
}): ViabilityScore {
  const opts = input.options ?? {};
  const klBlock = opts.klBlockThreshold ?? DEFAULT_KL_BLOCK_THRESHOLD;
  const zBlock = opts.zBlockThreshold ?? DEFAULT_Z_BLOCK_THRESHOLD;
  const allow = opts.allowThreshold ?? DEFAULT_ALLOW_THRESHOLD;
  const escalate = opts.escalateThreshold ?? DEFAULT_ESCALATE_THRESHOLD;

  const v = input.imlVerdict;
  // Penalty terms (transparent, monotonic in divergence statistics).
  const klPenalty = Math.min(1, Math.max(0, v.klDivergence / klBlock));
  const zPenalty = Math.min(
    0.5,
    Math.max(0, Math.abs(v.segmentZ.maxAbsZ) / zBlock / 2),
  );
  const noveltyPenalty = v.novelty.noveltyDetected ? 0.4 : 0;
  const total = klPenalty + zPenalty + noveltyPenalty;
  const vi = Math.max(-1, Math.min(1, 1 - total));

  let recommendation: ViabilityScore["recommendation"];
  if (vi >= allow) recommendation = "proceed";
  else if (vi >= escalate) recommendation = "escalate_hitl";
  else recommendation = "block";

  const parts: string[] = [];
  if (klPenalty > 0) parts.push(`KL-penalty=${klPenalty.toFixed(2)}`);
  if (zPenalty > 0) parts.push(`z-penalty=${zPenalty.toFixed(2)}`);
  if (noveltyPenalty > 0) parts.push(`novelty-penalty=${noveltyPenalty}`);
  const rationale =
    parts.length === 0
      ? `VI=${vi.toFixed(2)} (no drift)`
      : `VI=${vi.toFixed(2)} :: ${parts.join(" · ")}`;

  return {
    vi,
    recommendation,
    rationale: rationale.slice(0, 200),
    penalties: { kl: klPenalty, z: zPenalty, novelty: noveltyPenalty },
  };
}

// ── Composite gate (IML + RiskGate, the wrapper agent-factory calls) ─

export interface ViabilityGateInput {
  recent: ReadonlyArray<RecentAction>;
  baseline: AdmissionProfile;
  imlOptions?: IMLOptions;
  riskGateOptions?: RiskGateOptions;
}

export type ViabilityGateVerdict =
  | {
      proceed: true;
      reason: "gate_disabled" | "viability_proceed";
      vi?: number;
      score?: ViabilityScore;
      iml?: IMLVerdict;
    }
  | {
      proceed: false;
      reason: "viability_below_block_threshold" | "viability_escalate_hitl";
      vi: number;
      score: ViabilityScore;
      iml: IMLVerdict;
      response: {
        error: "viability_gate_refused";
        recommendation: "escalate_hitl" | "block";
        rationale: string;
        klDivergence: number;
        maxAbsZ: number;
        novelty: boolean;
      };
      auditEntries: Array<
        | {
            action: "agent.drift_detected";
            resource: string;
            details: Record<string, unknown>;
          }
        | {
            action: "agent.viability_threshold";
            resource: string;
            details: Record<string, unknown>;
          }
      >;
    };

/**
 * Pure: evaluate the full viability gate. The agent-factory wrapper
 * calls this BEFORE evaluatePolicyGate (R100) so drift detection
 * runs even for actions a policy would have permitted.
 *
 * Behavior:
 *   - If gate disabled → proceed with reason "gate_disabled"
 *   - If IML reports no drift and VI ≥ allowThreshold → proceed
 *   - If VI ∈ [escalate, allow) → block with viability_escalate_hitl
 *   - If VI < escalate → block with viability_below_block_threshold
 *
 * No I/O. Caller writes the audit entries to R26 and produces the
 * HTTP response from `response`.
 */
export function evaluateViabilityGate(
  agentName: string,
  input: ViabilityGateInput,
): ViabilityGateVerdict {
  if (!isViabilityGateEnabled()) {
    return { proceed: true, reason: "gate_disabled" };
  }

  const iml = runIML({
    recent: input.recent,
    baseline: input.baseline,
    options: input.imlOptions,
  });
  const score = computeViability({
    imlVerdict: iml,
    options: input.riskGateOptions,
  });

  if (score.recommendation === "proceed") {
    return {
      proceed: true,
      reason: "viability_proceed",
      vi: score.vi,
      score,
      iml,
    };
  }

  const reason: "viability_below_block_threshold" | "viability_escalate_hitl" =
    score.recommendation === "block"
      ? "viability_below_block_threshold"
      : "viability_escalate_hitl";

  const auditEntries: Array<
    | {
        action: "agent.drift_detected";
        resource: string;
        details: Record<string, unknown>;
      }
    | {
        action: "agent.viability_threshold";
        resource: string;
        details: Record<string, unknown>;
      }
  > = [];

  if (iml.driftDetected) {
    auditEntries.push({
      action: "agent.drift_detected",
      resource: `agent:${agentName}`,
      details: {
        klDivergence: iml.klDivergence,
        maxAbsZ: iml.segmentZ.maxAbsZ,
        drivingClass: iml.segmentZ.drivingClass,
        novelty: iml.novelty.noveltyDetected,
        novelPattern: iml.novelty.pattern,
        windowSize: iml.windowSize,
        profileHash: iml.profileHash,
        summary: iml.summary,
      },
    });
  }

  auditEntries.push({
    action: "agent.viability_threshold",
    resource: `agent:${agentName}`,
    details: {
      vi: score.vi,
      recommendation: score.recommendation,
      penalties: score.penalties,
      rationale: score.rationale,
      profileHash: iml.profileHash,
    },
  });

  return {
    proceed: false,
    reason,
    vi: score.vi,
    score,
    iml,
    response: {
      error: "viability_gate_refused",
      recommendation:
        score.recommendation === "block" ? "block" : "escalate_hitl",
      rationale: score.rationale,
      klDivergence: iml.klDivergence,
      maxAbsZ: iml.segmentZ.maxAbsZ,
      novelty: iml.novelty.noveltyDetected,
    },
    auditEntries,
  };
}
