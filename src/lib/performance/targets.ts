/**
 * PERFORMANCE TARGETS REGISTRY — R130.
 *
 * The procurement-grade scoreboard of what "elite" performance looks
 * like in the agentic-AI landscape as of 2026, and what Sovereign
 * Matrix is committing to. Targets are organized by phase (1/2/3)
 * matching the 12-month roadmap.
 *
 * THE ANTI-AI-WASHING INVARIANT:
 *
 *   Every target has a `verificationKind` that PUBLICLY classifies
 *   how rigorously the platform's score against this target is
 *   measured. The values, in descending strictness:
 *
 *     "independent-replayable"  — harness + dataset version + run
 *                                 hash are public. Anyone can
 *                                 re-run and confirm.
 *     "internal-only"           — measured by Sovereign with a
 *                                 documented harness; not yet
 *                                 reproducible by third parties.
 *     "claimed-only"            — target is aspirational, NO
 *                                 measurement has been recorded
 *                                 yet. Dashboard MUST show this
 *                                 honestly.
 *
 *   The dashboard refuses to display a "current value" without a
 *   matching `BenchmarkResult` whose `runHash` is recorded. This is
 *   the structural guarantee against vendor cherry-picking.
 *
 * SOURCE TRANSPARENCY:
 *
 *   Each target cites the source of the SOTA reference number from
 *   the prompt's deep research. Future contributors update both
 *   the SOTA and the local target as the leaderboard moves.
 */

// ── Type-safe target taxonomy ──────────────────────────────────────

export type PerformancePhase = "phase-1" | "phase-2" | "phase-3";

export type PerformanceCategory =
  | "benchmark-coding"
  | "benchmark-general"
  | "benchmark-memory"
  | "throughput"
  | "latency"
  | "messaging"
  | "compliance";

export type VerificationKind =
  | "independent-replayable"
  | "internal-only"
  | "claimed-only";

/**
 * Direction of the metric — does higher mean better, or lower?
 * Drives both the gap classifier and the procurement-readable copy.
 */
export type MetricDirection = "higher-is-better" | "lower-is-better";

export interface PerformanceTarget {
  /** Stable id — kebab-case. Unique across the registry. */
  id: string;
  /** Display name. */
  name: string;
  /** Procurement-readable description (1-3 sentences). */
  description: string;
  phase: PerformancePhase;
  category: PerformanceCategory;
  /** Score / RPS / ms / etc. */
  unit: string;
  /** The minimum score / max latency / etc. that counts as "achieved." */
  targetValue: number;
  direction: MetricDirection;
  /** State-of-the-art reference value at the time of writing. */
  sotaValue: number;
  /** Brief citation describing where the SOTA number was sourced. */
  sotaSource: string;
  /**
   * Whether the platform's score is measured rigorously. Defaults
   * to "claimed-only" until a benchmark harness is wired up.
   */
  verificationKind: VerificationKind;
  /**
   * If verificationKind is "independent-replayable", the public URL
   * (or repo path) of the harness customers can re-run.
   */
  harnessLocation?: string;
}

// ── Registry: the 6 prebuilt targets from the 2026 roadmap ────────

/**
 * SWE-bench Verified — the cleaned, contamination-resistant subset
 * of SWE-bench. Industry SOTA at the time of writing: 79.2%.
 *
 * Sovereign target: ≥80% (Phase 2 end).
 */
export const SWE_BENCH_VERIFIED_TARGET: PerformanceTarget = {
  id: "swe-bench-verified",
  name: "SWE-bench Verified",
  description:
    "The cleaned, contamination-resistant subset of SWE-bench. Procurement-grade benchmark for autonomous-coding fitness.",
  phase: "phase-2",
  category: "benchmark-coding",
  unit: "% pass rate",
  targetValue: 80,
  direction: "higher-is-better",
  sotaValue: 79.2,
  sotaSource: "Trae Agent leaderboard, early 2026",
  verificationKind: "claimed-only",
  harnessLocation: undefined,
};

/**
 * SWE-bench Pro — the harder benchmark designed to defeat
 * data-contamination tricks. Industry SOTA at the time of writing:
 * 45.9%. The single most honest measure of real coding ability.
 *
 * Sovereign target: ≥50% (Phase 2 end).
 */
export const SWE_BENCH_PRO_TARGET: PerformanceTarget = {
  id: "swe-bench-pro",
  name: "SWE-bench Pro",
  description:
    "The harder, contamination-resistant benchmark — designed to expose models that cherry-picked Verified. Real-world coding fitness.",
  phase: "phase-2",
  category: "benchmark-coding",
  unit: "% pass rate",
  targetValue: 50,
  direction: "higher-is-better",
  sotaValue: 45.9,
  sotaSource: "Trae Agent / SWE-bench Pro 2026",
  verificationKind: "claimed-only",
};

/**
 * GAIA Level 3 — the hardest tier of the GAIA general-AI benchmark.
 * Industry SOTA at the time of writing: 57.7%.
 *
 * Sovereign target: >60% (Phase 2 end).
 */
export const GAIA_LEVEL_3_TARGET: PerformanceTarget = {
  id: "gaia-level-3",
  name: "GAIA Level 3",
  description:
    "The hardest tier of the GAIA general-AI assistant benchmark. Multi-step reasoning + multi-tool use under realistic ambiguity.",
  phase: "phase-2",
  category: "benchmark-general",
  unit: "% accuracy",
  targetValue: 60,
  direction: "higher-is-better",
  sotaValue: 57.7,
  sotaSource: "GAIA leaderboard, early 2026",
  verificationKind: "claimed-only",
};

/**
 * LongMemEval — long-term memory recall benchmark. Industry SOTA at
 * the time of writing: 91.4%. Drives the R130-adjacent memory work
 * (R125 Cognee adapter on the Edge Node roadmap).
 *
 * Sovereign target: ≥92% (Phase 1 end).
 */
export const LONG_MEM_EVAL_TARGET: PerformanceTarget = {
  id: "long-mem-eval",
  name: "LongMemEval",
  description:
    "Long-term memory recall benchmark. The bar an agent must clear to be useful past a single session.",
  phase: "phase-1",
  category: "benchmark-memory",
  unit: "% accuracy",
  targetValue: 92,
  direction: "higher-is-better",
  sotaValue: 91.4,
  sotaSource: "LongMemEval 2026",
  verificationKind: "claimed-only",
};

/**
 * Gateway throughput — the platform's edge gateway must sustain
 * 350+ requests per second with ≤4ms overhead per request.
 *
 * Two-part target: this captures the request-rate side. Latency is
 * a separate target — see GATEWAY_OVERHEAD_LATENCY_TARGET.
 */
export const GATEWAY_THROUGHPUT_TARGET: PerformanceTarget = {
  id: "gateway-throughput-rps",
  name: "Gateway throughput (RPS)",
  description:
    "Sustained requests-per-second the platform's edge gateway can handle in production. Drives massive-swarm capacity planning.",
  phase: "phase-3",
  category: "throughput",
  unit: "req/s",
  targetValue: 350,
  direction: "higher-is-better",
  sotaValue: 350,
  sotaSource: "Elite gateway production deployments, 2026",
  verificationKind: "claimed-only",
};

/**
 * Gateway overhead latency — the per-request cost the gateway adds
 * on top of the upstream service. Must stay ≤4ms.
 */
export const GATEWAY_OVERHEAD_LATENCY_TARGET: PerformanceTarget = {
  id: "gateway-overhead-ms",
  name: "Gateway overhead (per request)",
  description:
    "Per-request latency the gateway adds on top of the upstream agent invocation. Lower is better — must stay ≤4ms to support tight HITL loops.",
  phase: "phase-3",
  category: "latency",
  unit: "ms",
  targetValue: 4,
  direction: "lower-is-better",
  sotaValue: 4,
  sotaSource: "Elite gateway production deployments, 2026",
  verificationKind: "claimed-only",
};

/**
 * Broker throughput — the swarm-messaging layer must sustain 10K
 * messages per second per broker node to support large agent
 * swarms.
 */
export const BROKER_THROUGHPUT_TARGET: PerformanceTarget = {
  id: "broker-throughput-msgs-per-s",
  name: "Broker throughput (per node)",
  description:
    "Messages-per-second per broker node the swarm-messaging layer can sustain. Drives R128/R129 swarm-scheduler scaling.",
  phase: "phase-3",
  category: "messaging",
  unit: "msg/s",
  targetValue: 10000,
  direction: "higher-is-better",
  sotaValue: 10000,
  sotaSource: "Elite messaging brokers, 2026",
  verificationKind: "claimed-only",
};

/**
 * The complete prebuilt target registry. Phase-1/2/3 sequenced.
 */
export const DEFAULT_PERFORMANCE_TARGETS: ReadonlyArray<PerformanceTarget> = [
  LONG_MEM_EVAL_TARGET, // Phase 1
  SWE_BENCH_VERIFIED_TARGET, // Phase 2
  SWE_BENCH_PRO_TARGET, // Phase 2
  GAIA_LEVEL_3_TARGET, // Phase 2
  GATEWAY_THROUGHPUT_TARGET, // Phase 3
  GATEWAY_OVERHEAD_LATENCY_TARGET, // Phase 3
  BROKER_THROUGHPUT_TARGET, // Phase 3
] as const;

// ── Pure helpers ──────────────────────────────────────────────────

/**
 * Pure: look up a target by id. Returns undefined if missing.
 */
export function findTargetById(
  id: string,
  targets: ReadonlyArray<PerformanceTarget> = DEFAULT_PERFORMANCE_TARGETS,
): PerformanceTarget | undefined {
  return targets.find((t) => t.id === id);
}

/**
 * Pure: list targets, optionally filtered by phase or category, in
 * a deterministic stable order (sorted by id).
 */
export function listTargets(
  filter: {
    phase?: PerformancePhase;
    category?: PerformanceCategory;
    verificationKind?: VerificationKind;
  } = {},
  targets: ReadonlyArray<PerformanceTarget> = DEFAULT_PERFORMANCE_TARGETS,
): PerformanceTarget[] {
  const out: PerformanceTarget[] = [];
  for (const t of targets) {
    if (filter.phase && t.phase !== filter.phase) continue;
    if (filter.category && t.category !== filter.category) continue;
    if (
      filter.verificationKind &&
      t.verificationKind !== filter.verificationKind
    )
      continue;
    out.push(t);
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

/**
 * Pure: registry summary stats for the /trust/performance-observatory
 * hero card.
 */
export interface RegistryStats {
  total: number;
  byPhase: Record<PerformancePhase, number>;
  byCategory: Record<PerformanceCategory, number>;
  byVerification: Record<VerificationKind, number>;
}

export function targetRegistryStats(
  targets: ReadonlyArray<PerformanceTarget> = DEFAULT_PERFORMANCE_TARGETS,
): RegistryStats {
  const stats: RegistryStats = {
    total: 0,
    byPhase: { "phase-1": 0, "phase-2": 0, "phase-3": 0 },
    byCategory: {
      "benchmark-coding": 0,
      "benchmark-general": 0,
      "benchmark-memory": 0,
      throughput: 0,
      latency: 0,
      messaging: 0,
      compliance: 0,
    },
    byVerification: {
      "independent-replayable": 0,
      "internal-only": 0,
      "claimed-only": 0,
    },
  };
  for (const t of targets) {
    stats.total += 1;
    stats.byPhase[t.phase] += 1;
    stats.byCategory[t.category] += 1;
    stats.byVerification[t.verificationKind] += 1;
  }
  return stats;
}
