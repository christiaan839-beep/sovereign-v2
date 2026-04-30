/**
 * SWE-bench Verified harness — pure-function + composition tests.
 */

import { describe, it, expect } from "vitest";
import {
  validateSweBenchRunConfig,
  runSweBenchVerifiedHarness,
  summaryToBenchmarkResult,
  computeRunHash,
  makeEdgeNodeBackedRunner,
  SWE_BENCH_VERIFIED_HARNESS_VERSION,
  type SweBenchTask,
  type SweBenchTaskRunner,
  type SweBenchRunSummary,
} from "../swe-bench-verified";
import { SWE_BENCH_VERIFIED_TARGET } from "../../targets";
import { validateBenchmarkResult } from "../../benchmark-results";

const makeTask = (id: string): SweBenchTask => ({
  taskId: id,
  repoPath: `/tmp/swe/${id}`,
  candidateFiles: ["src/a.py"],
  problemStatement: "fix bug",
  testCmd: "pytest -q",
});

const REQUIRED_SOURCE = {
  harnessCommit: "deadbeef",
  datasetVersion: "swe-bench-verified-v1.0",
  modelId: "kimi-k2.6",
  envNotes: "test-env",
};

const minimalCfg = (overrides: Partial<{
  systemUnderTest: string;
  tasks: SweBenchTask[];
  datasetVersion: string;
  harnessCommit: string;
  perTaskTimeoutSeconds: number;
  maxParallel: number;
}> = {}) => ({
  systemUnderTest: "sov-aider",
  tasks: [],
  datasetVersion: "swe-bench-verified-v1.0",
  harnessCommit: "deadbeef",
  ...overrides,
});

describe("validateSweBenchRunConfig", () => {
  it("rejects empty systemUnderTest", () => {
    const v = validateSweBenchRunConfig(minimalCfg({ systemUnderTest: "" }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("system_under_test_missing");
  });

  it("rejects missing datasetVersion", () => {
    const v = validateSweBenchRunConfig(minimalCfg({ datasetVersion: "" }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("missing_dataset_version");
  });

  it("rejects missing harnessCommit", () => {
    const v = validateSweBenchRunConfig(minimalCfg({ harnessCommit: "" }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("missing_harness_commit");
  });

  it("rejects duplicate task ids", () => {
    const v = validateSweBenchRunConfig(
      minimalCfg({ tasks: [makeTask("a"), makeTask("a")] }),
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("duplicate_task_id");
  });

  it("rejects invalid task (missing testCmd)", () => {
    const v = validateSweBenchRunConfig(
      minimalCfg({ tasks: [{ ...makeTask("a"), testCmd: "" }] }),
    );
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("invalid_task");
  });

  it("rejects out-of-range parallelism", () => {
    const v = validateSweBenchRunConfig(minimalCfg({ maxParallel: 9_999 }));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("parallel_out_of_range");
  });

  it("accepts valid config", () => {
    const v = validateSweBenchRunConfig(
      minimalCfg({
        tasks: [makeTask("a"), makeTask("b")],
        perTaskTimeoutSeconds: 300,
        maxParallel: 4,
      }),
    );
    expect(v.ok).toBe(true);
  });
});

describe("runSweBenchVerifiedHarness", () => {
  const passEverythingRunner: SweBenchTaskRunner = {
    async run(task) {
      return { taskId: task.taskId, passed: true, durationMs: 100 };
    },
  };

  const failEverythingRunner: SweBenchTaskRunner = {
    async run(task) {
      return { taskId: task.taskId, passed: false, durationMs: 50 };
    },
  };

  const flakyRunner = (passSet: Set<string>): SweBenchTaskRunner => ({
    async run(task) {
      return {
        taskId: task.taskId,
        passed: passSet.has(task.taskId),
        durationMs: 75,
      };
    },
  });

  it("emits 0/0 summary for empty task list", async () => {
    const summary = await runSweBenchVerifiedHarness(
      minimalCfg(),
      passEverythingRunner,
    );
    expect(summary.totalTasks).toBe(0);
    expect(summary.passRate).toBe(0);
    expect(summary.passRatePercent).toBe(0);
  });

  it("computes passRate=1.0 (100%) when every task passes", async () => {
    const summary = await runSweBenchVerifiedHarness(
      minimalCfg({ tasks: [makeTask("a"), makeTask("b")] }),
      passEverythingRunner,
    );
    expect(summary.totalTasks).toBe(2);
    expect(summary.passedTasks).toBe(2);
    expect(summary.passRate).toBe(1);
    expect(summary.passRatePercent).toBe(100);
  });

  it("computes passRate=0.0 when every task fails", async () => {
    const summary = await runSweBenchVerifiedHarness(
      minimalCfg({ tasks: [makeTask("a"), makeTask("b")] }),
      failEverythingRunner,
    );
    expect(summary.passRate).toBe(0);
  });

  it("computes passRate correctly for mixed outcomes", async () => {
    const summary = await runSweBenchVerifiedHarness(
      minimalCfg({
        tasks: [makeTask("a"), makeTask("b"), makeTask("c"), makeTask("d")],
      }),
      flakyRunner(new Set(["a", "c"])),
    );
    expect(summary.passRate).toBe(0.5);
    expect(summary.passRatePercent).toBe(50);
  });

  it("isolates a thrown runner error as failed task", async () => {
    const throwingRunner: SweBenchTaskRunner = {
      async run(task) {
        if (task.taskId === "boom") throw new Error("bad");
        return { taskId: task.taskId, passed: true, durationMs: 1 };
      },
    };
    const summary = await runSweBenchVerifiedHarness(
      minimalCfg({ tasks: [makeTask("a"), makeTask("boom"), makeTask("c")] }),
      throwingRunner,
    );
    expect(summary.passedTasks).toBe(2);
    expect(summary.outcomes[1].passed).toBe(false);
    expect(summary.outcomes[1].summary).toContain("bad");
  });

  it("preserves task order in outcomes regardless of parallelism", async () => {
    const slowFirstRunner: SweBenchTaskRunner = {
      async run(task) {
        const delay = task.taskId === "a" ? 30 : 5;
        await new Promise((r) => setTimeout(r, delay));
        return { taskId: task.taskId, passed: true, durationMs: delay };
      },
    };
    const summary = await runSweBenchVerifiedHarness(
      minimalCfg({
        tasks: [makeTask("a"), makeTask("b"), makeTask("c")],
        maxParallel: 3,
      }),
      slowFirstRunner,
    );
    expect(summary.outcomes.map((o) => o.taskId)).toEqual(["a", "b", "c"]);
  });

  it("throws on validation failure", async () => {
    await expect(
      runSweBenchVerifiedHarness(
        minimalCfg({ systemUnderTest: "" }),
        passEverythingRunner,
      ),
    ).rejects.toThrow(/system_under_test_missing/);
  });
});

describe("computeRunHash", () => {
  const fixedSummary: SweBenchRunSummary = {
    systemUnderTest: "sov-aider",
    totalTasks: 100,
    passedTasks: 73,
    failedTasks: 27,
    passRate: 0.73,
    passRatePercent: 73,
    totalDurationMs: 4_200_000,
    meanDurationMs: 42_000,
    outcomes: [],
  };

  it("produces stable hashes for identical inputs", () => {
    const h1 = computeRunHash({
      targetId: "swe-bench-verified",
      summary: fixedSummary,
      source: REQUIRED_SOURCE,
      measuredAt: "2026-04-30T12:00:00.000Z",
      verification: "internal-only",
    });
    const h2 = computeRunHash({
      targetId: "swe-bench-verified",
      summary: fixedSummary,
      source: REQUIRED_SOURCE,
      measuredAt: "2026-04-30T12:00:00.000Z",
      verification: "internal-only",
    });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when summary changes", () => {
    const h1 = computeRunHash({
      targetId: "swe-bench-verified",
      summary: fixedSummary,
      source: REQUIRED_SOURCE,
      measuredAt: "2026-04-30T12:00:00.000Z",
      verification: "internal-only",
    });
    const h2 = computeRunHash({
      targetId: "swe-bench-verified",
      summary: { ...fixedSummary, passedTasks: 74 },
      source: REQUIRED_SOURCE,
      measuredAt: "2026-04-30T12:00:00.000Z",
      verification: "internal-only",
    });
    expect(h1).not.toBe(h2);
  });
});

describe("summaryToBenchmarkResult", () => {
  const fixedSummary: SweBenchRunSummary = {
    systemUnderTest: "sov-aider",
    totalTasks: 100,
    passedTasks: 73,
    failedTasks: 27,
    passRate: 0.73,
    passRatePercent: 73,
    totalDurationMs: 4_200_000,
    meanDurationMs: 42_000,
    outcomes: [],
  };

  it("emits a structurally-valid R130 BenchmarkResult", () => {
    const result = summaryToBenchmarkResult(fixedSummary, REQUIRED_SOURCE, {
      measuredAt: "2026-04-30T12:00:00.000Z",
      notes: "first run on a clean repo",
    });
    const v = validateBenchmarkResult({
      result,
      target: SWE_BENCH_VERIFIED_TARGET,
    });
    expect(v.ok).toBe(true);
    expect(result.measuredValue).toBe(73);
    expect(result.targetId).toBe("swe-bench-verified");
    expect(result.verification).toBe("internal-only");
    expect(result.runHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.source).toEqual(REQUIRED_SOURCE);
  });

  it("respects custom verification kind", () => {
    const result = summaryToBenchmarkResult(fixedSummary, REQUIRED_SOURCE, {
      measuredAt: "2026-04-30T12:00:00.000Z",
      verification: "independent-replayable",
    });
    expect(result.verification).toBe("independent-replayable");
  });
});

describe("makeEdgeNodeBackedRunner", () => {
  it("adapts EdgeNode dispatch into SweBenchTaskRunner", async () => {
    const adapter = {
      async dispatch(req: { capability: "fix-github-issue" }) {
        expect(req.capability).toBe("fix-github-issue");
        return { passed: true, durationMs: 200, summary: "ok" };
      },
    };
    const runner = makeEdgeNodeBackedRunner(adapter);
    const outcome = await runner.run(makeTask("a"));
    expect(outcome.passed).toBe(true);
    expect(outcome.durationMs).toBe(200);
    expect(outcome.summary).toBe("ok");
  });

  it("propagates timeoutSeconds to adapter (default if unset)", async () => {
    let observedTimeout = -1;
    const adapter = {
      async dispatch(req: { capability: "fix-github-issue"; timeoutSeconds: number }) {
        observedTimeout = req.timeoutSeconds;
        return { passed: true, durationMs: 1 };
      },
    };
    const runner = makeEdgeNodeBackedRunner(adapter);
    await runner.run(makeTask("a")); // no timeoutSeconds on task
    expect(observedTimeout).toBe(600); // default
    await runner.run({ ...makeTask("b"), timeoutSeconds: 120 });
    expect(observedTimeout).toBe(120);
  });
});

describe("harness version constant", () => {
  it("is a semver string", () => {
    expect(SWE_BENCH_VERIFIED_HARNESS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
