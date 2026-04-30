/**
 * R131 SWE-BENCH VERIFIED HARNESS — Move 4 of the proof-conversion arc.
 *
 * STRATEGIC PURPOSE:
 *
 *   R130 Performance Observatory ships with prebuilt SOTA targets and
 *   a benchmark-result attestation chain — but no harness that
 *   actually RUNS a benchmark and produces those results. Until this
 *   module, every BenchmarkResult had to be hand-crafted, which means
 *   R130's promise of "anti-AI-washing" hinges on operator discipline
 *   rather than tooling.
 *
 *   This file ships the skeleton for SWE-bench Verified — the canonical
 *   2026 software-engineering benchmark (500 verified GitHub issue
 *   tasks). Operators wire up:
 *     1. The benchmark dataset (download + cache)
 *     2. An Edge Node to delegate each task to (e.g., Aider via R121)
 *     3. The verifier (each task has unit tests; harness runs them)
 *   The harness composes them into a full run and emits a R130-valid
 *   BenchmarkResult.
 *
 * SHIPPED AS A SKELETON. The pure-function compose-a-run logic is
 * here; the dataset loader + per-task scorer are dependency-injected
 * so this file never references SWE-bench's actual dataset format
 * (which moves over time and shouldn't pollute our tree). Operators
 * provide a SweBenchTaskRunner; the harness composes it into a run.
 *
 * Why this matters: a customer asking "do you ACTUALLY pass SWE-bench
 * Verified at the rate you claim?" can run THIS harness against their
 * own checkout + their own Edge Node config + their own dataset cache,
 * and get a BenchmarkResult that R130 can verify. No trust required —
 * the harness is reproducible.
 */

import { createHash } from "node:crypto";
import {
  SWE_BENCH_VERIFIED_TARGET,
  type PerformanceTarget,
  type VerificationKind,
} from "../targets";
import type { BenchmarkResult, BenchmarkResultSource } from "../benchmark-results";

// ── Per-task input / outcome ───────────────────────────────────────

/**
 * One SWE-bench Verified task. Real dataset entries have many more
 * fields; this is the SUBSET the harness needs.
 */
export interface SweBenchTask {
  /** Stable task id from the SWE-bench dataset (e.g., "django-12345"). */
  taskId: string;
  /** Source repository (already checked out by operator before run). */
  repoPath: string;
  /** Files Aider / equivalent should focus on (relative to repoPath). */
  candidateFiles: string[];
  /** The issue body / failing test description in plain English. */
  problemStatement: string;
  /** The shell command that runs the verification tests. */
  testCmd: string;
  /** Optional hard timeout in seconds (per task). */
  timeoutSeconds?: number;
}

export interface SweBenchTaskOutcome {
  taskId: string;
  /** Did the verification tests pass after the agent's edits? */
  passed: boolean;
  /** Wallclock duration of the agent's attempt in milliseconds. */
  durationMs: number;
  /** Optional procurement-readable summary (≤200 chars). */
  summary?: string;
  /** Optional structured metadata for the audit chain. */
  metadata?: Record<string, unknown>;
}

// ── Runner DI ─────────────────────────────────────────────────────

/**
 * Operator-provided callback that takes one task and returns its
 * outcome. Typical implementation: invoke the Aider Edge Node (R121)
 * with the task's files + problemStatement + testCmd, then map
 * DispatchResult → SweBenchTaskOutcome.
 */
export interface SweBenchTaskRunner {
  run(task: SweBenchTask): Promise<SweBenchTaskOutcome>;
}

// ── Run config + result ───────────────────────────────────────────

export interface SweBenchRunConfig {
  /**
   * Free-form name for the system being benchmarked. Surfaces in the
   * BenchmarkResult source.modelId field and the receipt line.
   */
  systemUnderTest: string;
  /** Subset of the dataset to run. Empty array → 0/0 result (legal). */
  tasks: SweBenchTask[];
  /** Per-task timeout cap in seconds. Defaults to 600. */
  perTaskTimeoutSeconds?: number;
  /** Optional max parallelism. Defaults to 1 (serial). */
  maxParallel?: number;
  /** Dataset version identifier (required for R130 source.datasetVersion). */
  datasetVersion: string;
  /** Harness commit (required for R130 source.harnessCommit). */
  harnessCommit: string;
  /** Optional environment notes. */
  envNotes?: string;
  /** ISO 8601 timestamp injected into the result (testability). */
  measuredAt?: string;
}

export interface SweBenchRunSummary {
  systemUnderTest: string;
  totalTasks: number;
  passedTasks: number;
  failedTasks: number;
  /** Pass rate ∈ [0, 1]. R130 SWE_BENCH_VERIFIED_TARGET expects %. */
  passRate: number;
  /** Same as passRate but expressed as a percentage in [0, 100]. */
  passRatePercent: number;
  totalDurationMs: number;
  meanDurationMs: number;
  outcomes: SweBenchTaskOutcome[];
}

export const SWE_BENCH_VERIFIED_DEFAULT_TIMEOUT_SECONDS = 600;
export const SWE_BENCH_VERIFIED_HARNESS_VERSION = "1.0.0";
const SWE_BENCH_MAX_TIMEOUT_SECONDS = 3_600;
const SWE_BENCH_MAX_PARALLEL = 64;

// ── Pure: validate run config ─────────────────────────────────────

export type RunConfigValidation =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "system_under_test_missing"
        | "duplicate_task_id"
        | "invalid_task"
        | "timeout_out_of_range"
        | "parallel_out_of_range"
        | "missing_dataset_version"
        | "missing_harness_commit";
      details: string;
    };

export function validateSweBenchRunConfig(
  cfg: SweBenchRunConfig,
): RunConfigValidation {
  if (!cfg.systemUnderTest || cfg.systemUnderTest.length === 0) {
    return {
      ok: false,
      reason: "system_under_test_missing",
      details: "cfg.systemUnderTest is required.",
    };
  }
  if (!cfg.datasetVersion || cfg.datasetVersion.length === 0) {
    return {
      ok: false,
      reason: "missing_dataset_version",
      details: "cfg.datasetVersion is required (R130 source.datasetVersion).",
    };
  }
  if (!cfg.harnessCommit || cfg.harnessCommit.length === 0) {
    return {
      ok: false,
      reason: "missing_harness_commit",
      details: "cfg.harnessCommit is required (R130 source.harnessCommit).",
    };
  }
  const seen = new Set<string>();
  for (const t of cfg.tasks) {
    if (!t.taskId || !t.repoPath || !t.problemStatement || !t.testCmd) {
      return {
        ok: false,
        reason: "invalid_task",
        details: `task ${t.taskId || "<unknown>"} missing required field.`,
      };
    }
    if (seen.has(t.taskId)) {
      return {
        ok: false,
        reason: "duplicate_task_id",
        details: `task id ${t.taskId} appears more than once.`,
      };
    }
    seen.add(t.taskId);
  }
  if (cfg.perTaskTimeoutSeconds !== undefined) {
    if (
      cfg.perTaskTimeoutSeconds < 1 ||
      cfg.perTaskTimeoutSeconds > SWE_BENCH_MAX_TIMEOUT_SECONDS
    ) {
      return {
        ok: false,
        reason: "timeout_out_of_range",
        details: `perTaskTimeoutSeconds must be in [1, ${SWE_BENCH_MAX_TIMEOUT_SECONDS}].`,
      };
    }
  }
  if (cfg.maxParallel !== undefined) {
    if (cfg.maxParallel < 1 || cfg.maxParallel > SWE_BENCH_MAX_PARALLEL) {
      return {
        ok: false,
        reason: "parallel_out_of_range",
        details: `maxParallel must be in [1, ${SWE_BENCH_MAX_PARALLEL}].`,
      };
    }
  }
  return { ok: true };
}

// ── Impure: run the harness ───────────────────────────────────────

/**
 * Run the SWE-bench Verified harness against the operator-supplied
 * tasks + runner. Throws on validation failure (caller's bug);
 * returns a SweBenchRunSummary for any task-level failure (those are
 * part of the result, not exceptional flow).
 *
 * Parallelism: simple worker-pool semantics. Order of task results
 * is preserved by taskId regardless of which worker finishes first.
 */
export async function runSweBenchVerifiedHarness(
  cfg: SweBenchRunConfig,
  runner: SweBenchTaskRunner,
): Promise<SweBenchRunSummary> {
  const v = validateSweBenchRunConfig(cfg);
  if (!v.ok) {
    throw new Error(`runSweBenchVerifiedHarness: ${v.reason}: ${v.details}`);
  }

  const perTaskTimeoutSeconds =
    cfg.perTaskTimeoutSeconds ?? SWE_BENCH_VERIFIED_DEFAULT_TIMEOUT_SECONDS;
  const maxParallel = Math.max(1, cfg.maxParallel ?? 1);

  const startMs = Date.now();
  const outcomes: SweBenchTaskOutcome[] = new Array(cfg.tasks.length);
  let nextIdx = 0;

  const workOne = async (): Promise<void> => {
    while (nextIdx < cfg.tasks.length) {
      const my = nextIdx++;
      const t = cfg.tasks[my];
      const taskWithTimeout: SweBenchTask = {
        ...t,
        timeoutSeconds: t.timeoutSeconds ?? perTaskTimeoutSeconds,
      };
      try {
        const outcome = await runner.run(taskWithTimeout);
        outcomes[my] = outcome;
      } catch (err) {
        outcomes[my] = {
          taskId: t.taskId,
          passed: false,
          durationMs: 0,
          summary: `runner threw: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
  };

  const slots: Promise<void>[] = [];
  const numWorkers = Math.min(maxParallel, cfg.tasks.length);
  for (let i = 0; i < numWorkers; i++) {
    slots.push(workOne());
  }
  await Promise.all(slots);

  const totalDurationMs = Date.now() - startMs;
  const passedTasks = outcomes.filter((o) => o.passed).length;
  const failedTasks = outcomes.length - passedTasks;
  const passRate = outcomes.length === 0 ? 0 : passedTasks / outcomes.length;
  const meanDurationMs =
    outcomes.length === 0
      ? 0
      : outcomes.reduce((s, o) => s + o.durationMs, 0) / outcomes.length;

  return {
    systemUnderTest: cfg.systemUnderTest,
    totalTasks: outcomes.length,
    passedTasks,
    failedTasks,
    passRate,
    passRatePercent: passRate * 100,
    totalDurationMs,
    meanDurationMs,
    outcomes,
  };
}

// ── Pure: convert summary → R130 BenchmarkResult ──────────────────

/**
 * Pure: convert a SweBenchRunSummary into a R130 BenchmarkResult.
 * The output is shape-validated by R130's validateBenchmarkResult
 * (anti-AI-washing) — this function emits a structurally-valid
 * result, not just a pretty number.
 *
 * Note: SWE-bench Verified target.unit is "% pass rate" so we emit
 * `passRatePercent` (0-100), not the [0,1] fraction.
 */
export function summaryToBenchmarkResult(
  summary: SweBenchRunSummary,
  source: BenchmarkResultSource,
  opts: {
    target?: PerformanceTarget;
    /** ISO 8601; defaults to "now". Pass a fixed value for testability. */
    measuredAt?: string;
    /** Verification kind. Defaults to "internal-only" — the harness is
     *  ours, not third-party. Operators with public artifacts can claim
     *  "independent-replayable". */
    verification?: VerificationKind;
    /** Free-form notes. */
    notes?: string;
  } = {},
): BenchmarkResult {
  const target = opts.target ?? SWE_BENCH_VERIFIED_TARGET;
  const measuredAt = opts.measuredAt ?? new Date().toISOString();
  const verification = opts.verification ?? "internal-only";
  const runHash = computeRunHash({
    targetId: target.id,
    summary,
    source,
    measuredAt,
    verification,
  });
  return {
    targetId: target.id,
    measuredValue: summary.passRatePercent,
    measuredAt,
    runHash,
    source,
    notes: opts.notes,
    verification,
  };
}

/**
 * Pure: SHA-256 hash of (targetId | summary stats | source | measuredAt
 * | verification). Used as the BenchmarkResult.runHash anchor; if any
 * input changes, the hash changes, and the audit chain reflects it.
 */
export function computeRunHash(args: {
  targetId: string;
  summary: SweBenchRunSummary;
  source: BenchmarkResultSource;
  measuredAt: string;
  verification: VerificationKind;
}): string {
  const canonical = [
    args.targetId,
    `sut=${args.summary.systemUnderTest}`,
    `total=${args.summary.totalTasks}`,
    `passed=${args.summary.passedTasks}`,
    `failed=${args.summary.failedTasks}`,
    `passRate=${args.summary.passRate.toFixed(8)}`,
    `mean=${args.summary.meanDurationMs.toFixed(2)}`,
    `total_ms=${args.summary.totalDurationMs}`,
    `harness=${args.source.harnessCommit}`,
    `dataset=${args.source.datasetVersion}`,
    `model=${args.source.modelId}`,
    `env=${args.source.envNotes ?? ""}`,
    `at=${args.measuredAt}`,
    `verification=${args.verification}`,
    `harnessVersion=${SWE_BENCH_VERIFIED_HARNESS_VERSION}`,
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

// ── Pure: Edge Node bridge — adapt an EdgeNode into a runner ──────

/**
 * Operator-provided adapter that bridges a R120 EdgeNode (typically
 * Aider, R121) into a SweBenchTaskRunner. Operators implement this
 * once and reuse across benchmark runs.
 */
export interface SweBenchEdgeNodeAdapter {
  dispatch(req: {
    capability: "fix-github-issue";
    repoPath: string;
    files: string[];
    problemStatement: string;
    testCmd: string;
    timeoutSeconds: number;
  }): Promise<{
    passed: boolean;
    durationMs: number;
    summary?: string;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Pure factory: given a SweBenchEdgeNodeAdapter, produce a
 * SweBenchTaskRunner. This is the COMPOSITION that turns "Aider Edge
 * Node ships with the platform" into "the platform actually passes
 * (or fails) SWE-bench Verified at a measurable rate."
 */
export function makeEdgeNodeBackedRunner(
  adapter: SweBenchEdgeNodeAdapter,
): SweBenchTaskRunner {
  return {
    async run(task: SweBenchTask): Promise<SweBenchTaskOutcome> {
      const r = await adapter.dispatch({
        capability: "fix-github-issue",
        repoPath: task.repoPath,
        files: task.candidateFiles,
        problemStatement: task.problemStatement,
        testCmd: task.testCmd,
        timeoutSeconds:
          task.timeoutSeconds ?? SWE_BENCH_VERIFIED_DEFAULT_TIMEOUT_SECONDS,
      });
      return {
        taskId: task.taskId,
        passed: r.passed,
        durationMs: r.durationMs,
        summary: r.summary,
        metadata: r.metadata,
      };
    },
  };
}
