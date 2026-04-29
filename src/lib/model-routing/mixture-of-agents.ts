/**
 * MIXTURE-OF-AGENTS MODEL ROUTER (R74).
 *
 * Operationalizes the Mixture-of-Agents (MoA) pattern from the
 * open-source intelligence chat: route each task to the SMARTEST
 * open-source model for THAT specific task, not the cheapest model
 * for everything or the smartest model for everything.
 *
 * The breakthrough that justifies this round: by April 2026, free
 * open-source models match or exceed proprietary frontier models
 * on domain-specific benchmarks:
 *   - DeepSeek V3.2:    96% AIME math, 81% SWE-bench (10x cheaper than GPT-5)
 *   - GLM-4.7 / GLM-5.1: #1 SWE-Bench Pro, 8-hour autonomous coding
 *   - Qwen3 (235B-A22B): GPT-4o parity on general tasks (Apache 2.0)
 *   - Gemma 4 (26B MoE): frontier perf on 18GB RAM (laptop deploy)
 *   - Llama 4 Maverick:  1M token context (highest open MMLU)
 *   - Fathom-R1-14B:     punches above weight on abstract reasoning
 *   - Nomos 1:           87/120 on Putnam Math Competition
 *
 * The router picks the right specialist for the task. This makes
 * Sovereign's "Unlimited AI workforce, flat $199/month" promise
 * STRUCTURALLY DEFENSIBLE — we route to free open-source models
 * 80%+ of the time, falling back to paid only when no open-source
 * specialist matches.
 *
 * THE COMPOSITION:
 *
 *   user task → R74 classifies → R74 picks model → R71 + R73
 *               (task taxonomy)  (cost+capability)  (guardrails)
 *               ↓
 *         model invocation → R34 sign → R26 audit
 *
 * Pure-function design throughout. The classification + selection
 * logic is unit-testable without invoking actual models.
 */

// ── Types ──────────────────────────────────────────────────────────

/**
 * Task taxonomy — every supported task type. New types are added
 * via ADR amendment (avoiding registry sprawl).
 */
export type TaskType =
  | "code-generation"
  | "code-review"
  | "code-debugging"
  | "math-reasoning"
  | "abstract-reasoning"
  | "general-chat"
  | "summarization"
  | "translation"
  | "data-extraction"
  | "long-context-analysis"
  | "multilingual"
  | "creative-writing"
  | "structured-output"
  | "compliance-classification"
  | "voice-conversation"
  | "vision-multimodal"
  | "agent-orchestration"
  | "tool-use";

/**
 * Latency tier — affects routing because slow models can't be the
 * primary for real-time tasks (R51 hedging composes here).
 */
export type LatencyTier = "instant" | "fast" | "standard" | "extended";

/**
 * Cost tier — used in the routing decision. Free-first wins when
 * capability is comparable; paid only fires when no free model
 * meets the capability bar.
 */
export type CostTier = "free-open-source" | "metered-open-source" | "paid-frontier";

/**
 * Privacy tier — some customers require local-only execution.
 */
export type PrivacyTier = "local-only" | "cloud-or-local" | "cloud-only";

/**
 * One model in the catalog. The router picks among entries based
 * on task fit + cost + latency + privacy constraints.
 */
export interface ModelEntry {
  /** Stable identifier. */
  id: string;
  /** Provider — for license + deployment classification. */
  provider:
    | "deepseek"
    | "zhipu" // GLM family
    | "alibaba" // Qwen family
    | "google" // Gemma family
    | "meta" // Llama family
    | "nous" // Nomos / Fathom
    | "anthropic"
    | "openai"
    | "groq"
    | "cerebras"
    | "ollama"; // local
  /** Open-source license (Apache-2.0, MIT, custom). */
  license: string;
  /** Cost tier. */
  costTier: CostTier;
  /** Latency tier. */
  latencyTier: LatencyTier;
  /** Privacy tier. */
  privacyTier: PrivacyTier;
  /** Tasks this model is BEST AT (primary specialty). */
  bestAt: TaskType[];
  /** Tasks this model can handle competently (fallback ok). */
  alsoCapable: TaskType[];
  /** Active parameters (for cost estimation). */
  activeParams: number;
  /** Total parameters (informational; useful for matching capacity). */
  totalParams: number;
  /** Context window in tokens. */
  contextTokens: number;
  /** Headline benchmark (free-form description for diagnostics). */
  benchmark?: string;
}

/**
 * The routing decision. Returned by chooseModel pure function.
 */
export interface RoutingDecision {
  primary: ModelEntry;
  /** Fallback chain in priority order (R51 hedging composes). */
  fallbacks: ModelEntry[];
  /** Why we picked this model (procurement-readable). */
  reason: string;
  /** Whether we matched the task's BEST-AT specialty. */
  exactMatch: boolean;
}

// ── The canonical model catalog ────────────────────────────────────

/**
 * The open-source-first catalog. Updated quarterly via ADR
 * amendment. Order doesn't affect routing logic (the chooser is
 * pure-function), but the catalog is the source of truth.
 */
export const MOA_MODEL_CATALOG: ModelEntry[] = [
  // ── DeepSeek V3.2 — cost-effective reasoning + coding ────────────
  {
    id: "deepseek-v3.2",
    provider: "deepseek",
    license: "MIT",
    costTier: "free-open-source",
    latencyTier: "fast",
    privacyTier: "cloud-or-local",
    bestAt: ["math-reasoning", "code-generation", "structured-output"],
    alsoCapable: ["general-chat", "summarization", "code-review", "abstract-reasoning"],
    activeParams: 37_000_000_000,
    totalParams: 671_000_000_000,
    contextTokens: 128_000,
    benchmark: "96% AIME 2025 math; 81% SWE-bench; 10x cheaper than GPT-5",
  },
  // ── GLM-4.7 / GLM-5.1 — coding champion ─────────────────────────
  {
    id: "glm-4.7",
    provider: "zhipu",
    license: "MIT",
    costTier: "free-open-source",
    latencyTier: "standard",
    privacyTier: "cloud-or-local",
    bestAt: ["code-generation", "code-review", "code-debugging", "agent-orchestration"],
    alsoCapable: ["math-reasoning", "structured-output", "tool-use"],
    activeParams: 40_000_000_000,
    totalParams: 744_000_000_000,
    contextTokens: 128_000,
    benchmark: "#1 SWE-Bench Pro; 73.8% SWE-bench; 84.9% LiveCodeBench",
  },
  // ── Qwen3 235B-A22B — general intelligence + multilingual ────────
  {
    id: "qwen3-235b-a22b",
    provider: "alibaba",
    license: "Apache-2.0",
    costTier: "free-open-source",
    latencyTier: "fast",
    privacyTier: "cloud-or-local",
    bestAt: ["general-chat", "multilingual", "translation"],
    alsoCapable: [
      "summarization",
      "data-extraction",
      "creative-writing",
      "structured-output",
      "compliance-classification",
    ],
    activeParams: 22_000_000_000,
    totalParams: 235_000_000_000,
    contextTokens: 128_000,
    benchmark: "GPT-4o parity on most benchmarks",
  },
  // ── Gemma 4 26B MoE — local / air-gapped deployment ──────────────
  {
    id: "gemma-4-26b-moe",
    provider: "google",
    license: "Apache-2.0",
    costTier: "free-open-source",
    latencyTier: "instant",
    privacyTier: "local-only",
    bestAt: ["general-chat", "summarization"],
    alsoCapable: ["data-extraction", "structured-output", "compliance-classification"],
    activeParams: 3_800_000_000,
    totalParams: 26_000_000_000,
    contextTokens: 128_000,
    benchmark: "Frontier perf on 18GB RAM (laptop-deployable)",
  },
  // ── Llama 4 Maverick — long-context champion ────────────────────
  {
    id: "llama-4-maverick",
    provider: "meta",
    license: "Llama Community (verify >700M MAU)",
    costTier: "free-open-source",
    latencyTier: "standard",
    privacyTier: "cloud-or-local",
    bestAt: ["long-context-analysis", "vision-multimodal"],
    alsoCapable: ["general-chat", "summarization", "data-extraction", "creative-writing"],
    activeParams: 17_000_000_000,
    totalParams: 400_000_000_000,
    contextTokens: 1_000_000,
    benchmark: "1M token context; 85.5% MMLU (highest among open models)",
  },
  // ── Fathom-R1-14B — abstract reasoning specialist ───────────────
  {
    id: "fathom-r1-14b",
    provider: "nous",
    license: "MIT",
    costTier: "free-open-source",
    latencyTier: "fast",
    privacyTier: "cloud-or-local",
    bestAt: ["abstract-reasoning"],
    alsoCapable: ["math-reasoning", "structured-output"],
    activeParams: 14_000_000_000,
    totalParams: 14_000_000_000,
    contextTokens: 32_768,
    benchmark: "Punches above weight class on abstract benchmarks",
  },
  // ── Nomos 1 — Putnam-grade math reasoning ───────────────────────
  {
    id: "nomos-1",
    provider: "nous",
    license: "MIT",
    costTier: "free-open-source",
    latencyTier: "extended",
    privacyTier: "cloud-or-local",
    bestAt: ["math-reasoning", "abstract-reasoning"],
    alsoCapable: ["structured-output"],
    activeParams: 14_000_000_000,
    totalParams: 14_000_000_000,
    contextTokens: 32_768,
    benchmark: "87/120 on Putnam Math Competition",
  },
];

// ── Constraints + scoring (pure functions) ─────────────────────────

export interface RoutingConstraints {
  /** Required task type. */
  task: TaskType;
  /** Maximum acceptable cost tier (defaults to "paid-frontier"). */
  maxCostTier?: CostTier;
  /** Required latency tier (defaults to "extended" — most permissive). */
  requiredLatency?: LatencyTier;
  /** Privacy requirement (defaults to "cloud-or-local"). */
  requiredPrivacy?: PrivacyTier;
  /** Minimum context tokens needed. */
  minContextTokens?: number;
  /** Excluded provider list (e.g., procurement bans). */
  excludedProviders?: ModelEntry["provider"][];
  /** Excluded license patterns (e.g., reject custom licenses). */
  rejectCustomLicenses?: boolean;
}

const COST_TIER_RANK: Record<CostTier, number> = {
  "free-open-source": 0,
  "metered-open-source": 1,
  "paid-frontier": 2,
};

const LATENCY_TIER_RANK: Record<LatencyTier, number> = {
  instant: 0,
  fast: 1,
  standard: 2,
  extended: 3,
};

const PRIVACY_TIER_RANK: Record<PrivacyTier, number> = {
  "local-only": 0,
  "cloud-or-local": 1,
  "cloud-only": 2,
};

/**
 * Pure: does this model satisfy the constraints?
 */
export function modelSatisfiesConstraints(
  model: ModelEntry,
  constraints: RoutingConstraints,
): { satisfies: boolean; reason?: string } {
  // Cost tier check.
  const maxCost = constraints.maxCostTier ?? "paid-frontier";
  if (COST_TIER_RANK[model.costTier] > COST_TIER_RANK[maxCost]) {
    return { satisfies: false, reason: "exceeds_cost_tier" };
  }
  // Latency check.
  const reqLatency = constraints.requiredLatency ?? "extended";
  if (LATENCY_TIER_RANK[model.latencyTier] > LATENCY_TIER_RANK[reqLatency]) {
    return { satisfies: false, reason: "too_slow" };
  }
  // Privacy check.
  const reqPriv = constraints.requiredPrivacy ?? "cloud-or-local";
  // local-only customers can use local-only OR cloud-or-local models? No,
  // local-only customers need local-only models. cloud-or-local customers
  // can use either. cloud-only would need cloud-only or cloud-or-local.
  if (
    reqPriv === "local-only" &&
    model.privacyTier !== "local-only"
  ) {
    return { satisfies: false, reason: "not_local_only" };
  }
  // Context length.
  if (
    constraints.minContextTokens &&
    model.contextTokens < constraints.minContextTokens
  ) {
    return { satisfies: false, reason: "insufficient_context" };
  }
  // Excluded providers.
  if (
    constraints.excludedProviders &&
    constraints.excludedProviders.includes(model.provider)
  ) {
    return { satisfies: false, reason: "provider_excluded" };
  }
  // Reject custom licenses.
  if (
    constraints.rejectCustomLicenses &&
    !["MIT", "Apache-2.0", "BSD-3-Clause"].includes(model.license)
  ) {
    return { satisfies: false, reason: "non_permissive_license" };
  }
  return { satisfies: true };
}

/**
 * Pure: score how well a model fits a task type.
 * Returns 0..100. Higher = better fit.
 */
export function scoreModelForTask(
  model: ModelEntry,
  task: TaskType,
): number {
  if (model.bestAt.includes(task)) return 100;
  if (model.alsoCapable.includes(task)) return 50;
  return 0;
}

// ── The router (pure function) ─────────────────────────────────────

/**
 * Pure: choose the best model for a task given constraints.
 *
 * Algorithm:
 *   1. Filter to models that satisfy ALL constraints.
 *   2. Score remaining models on task fit (best-at = 100, also = 50).
 *   3. Among ties, prefer cheaper costTier (free-first ethos).
 *   4. Return primary + fallback chain (top 3 candidates).
 *
 * Same inputs → same output, every time. Easy to test.
 *
 * Throws if no model satisfies the constraints (caller must handle).
 */
export function chooseModel(input: {
  constraints: RoutingConstraints;
  catalog?: ModelEntry[];
}): RoutingDecision {
  const catalog = input.catalog ?? MOA_MODEL_CATALOG;
  const candidates = catalog.filter(
    (m) => modelSatisfiesConstraints(m, input.constraints).satisfies,
  );
  if (candidates.length === 0) {
    throw new Error(
      `chooseModel: no model in catalog satisfies constraints for task ` +
        `"${input.constraints.task}". Try relaxing maxCostTier or ` +
        `requiredPrivacy.`,
    );
  }

  // Score each candidate.
  const scored = candidates.map((m) => ({
    model: m,
    score: scoreModelForTask(m, input.constraints.task),
    costRank: COST_TIER_RANK[m.costTier],
  }));

  // Sort: highest score first; ties broken by cheaper cost.
  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return a.costRank - b.costRank;
  });

  const primary = scored[0].model;
  const fallbacks = scored.slice(1, 4).map((s) => s.model);
  const exactMatch = scored[0].score === 100;

  let reason: string;
  if (exactMatch) {
    reason =
      `${primary.id} is BEST-AT "${input.constraints.task}" ` +
      `(${primary.benchmark ?? primary.license})`;
  } else if (scored[0].score >= 50) {
    reason =
      `${primary.id} is competent at "${input.constraints.task}" ` +
      `(also-capable; no specialist matched constraints)`;
  } else {
    reason =
      `${primary.id} is the only constraint-satisfying model; ` +
      `task fit is partial`;
  }

  return {
    primary,
    fallbacks,
    reason,
    exactMatch,
  };
}

/**
 * Pure: classify the COST PROFILE of a routing decision.
 * Used by /api/health/cost-profile + R44 attestations to surface
 * "what % of routing decisions used free-open-source models?"
 */
export function classifyCostProfile(decisions: RoutingDecision[]): {
  totalDecisions: number;
  freeOpenSourceCount: number;
  meteredCount: number;
  paidFrontierCount: number;
  freeOpenSourcePct: number;
  costSavingsClaim: string;
} {
  let free = 0;
  let metered = 0;
  let paid = 0;
  for (const d of decisions) {
    if (d.primary.costTier === "free-open-source") free++;
    else if (d.primary.costTier === "metered-open-source") metered++;
    else paid++;
  }
  const total = decisions.length;
  const freePct = total === 0 ? 0 : (free / total) * 100;
  return {
    totalDecisions: total,
    freeOpenSourceCount: free,
    meteredCount: metered,
    paidFrontierCount: paid,
    freeOpenSourcePct: Math.round(freePct * 100) / 100,
    costSavingsClaim:
      `${freePct.toFixed(1)}% of routing decisions used free-open-source ` +
      `models (the substrate for unlimited-flat-fee economics)`,
  };
}
