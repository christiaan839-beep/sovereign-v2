/**
 * Tests for src/lib/cron-orchestrator.ts — Wave 144.
 *
 * Pure-orchestrator tests with mock deps. Each branch (root fail,
 * eval fail, regression-detection, alert dispatch, dryRun) is
 * pinned in isolation.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  runNightly,
  renderAlertSummary,
  type NightlyDeps,
} from "@/lib/cron-orchestrator";
import type { EvalReport, EvalRegression } from "@/lib/eval-harness";
import type { DailyMerkleSummary } from "@/lib/merkle-receipts";

function happyReport(): EvalReport {
  return {
    generatedAt: new Date().toISOString(),
    windowDays: 7,
    totalRowsScored: 100,
    perAgent: [
      {
        agentName: "audit",
        samples: 10,
        avgScore: 0.8,
        autoApprovedRate: 0.9,
        avgDurationMs: 800,
        flags: [],
      },
    ],
    overall: { avgScore: 0.8, autoApprovedRate: 0.9 },
  };
}
function happyMerkle(): DailyMerkleSummary {
  return {
    date: "2026-05-22",
    root: "abc123",
    leafCount: 42,
    generatedAt: new Date().toISOString(),
  };
}
function mkDeps(over: Partial<NightlyDeps> = {}): NightlyDeps {
  return {
    buildRoot: async () => happyMerkle(),
    computeEval: async () => happyReport(),
    loadBaseline: async () => null,
    saveBaseline: async () => {},
    detectRegressions: () => [],
    sendAlert: async () => ({ slack: true }),
    ...over,
  };
}

describe("runNightly — happy path", () => {
  it("returns merkle + eval + no regressions on first-ever run", async () => {
    const deps = mkDeps();
    const r = await runNightly(deps);
    expect(r.merkleRoot).toBe("abc123");
    expect(r.receiptCount).toBe(42);
    expect(r.evalSampleSize).toBe(100);
    expect(r.regressions).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.alertsFired).toEqual({}); // no regressions → no alert
  });

  it("detects regressions when baseline exists", async () => {
    const regressions: EvalRegression[] = [
      {
        agentName: "audit",
        baselineScore: 0.9,
        currentScore: 0.6,
        delta: -0.3,
        pctDrop: 33,
      },
    ];
    const deps = mkDeps({
      loadBaseline: async () => happyReport(),
      detectRegressions: () => regressions,
    });
    const r = await runNightly(deps);
    expect(r.regressions).toEqual(regressions);
    // sendAlert should have been called
    expect(r.alertsFired).toEqual({ slack: true });
  });

  it("respects dryRun and skips alerts", async () => {
    const regressions: EvalRegression[] = [
      {
        agentName: "audit",
        baselineScore: 0.9,
        currentScore: 0.6,
        delta: -0.3,
        pctDrop: 33,
      },
    ];
    const sendAlert = vi.fn(async () => ({ slack: true }));
    const deps = mkDeps({
      loadBaseline: async () => happyReport(),
      detectRegressions: () => regressions,
      sendAlert,
    });
    const r = await runNightly(deps, { dryRun: true });
    expect(r.regressions).toEqual(regressions);
    expect(sendAlert).not.toHaveBeenCalled();
    expect(r.alertsFired).toEqual({});
  });
});

describe("runNightly — failure handling", () => {
  it("captures buildRoot throw + continues", async () => {
    const deps = mkDeps({
      buildRoot: async () => {
        throw new Error("db down");
      },
    });
    const r = await runNightly(deps);
    expect(r.merkleRoot).toBe("");
    expect(r.receiptCount).toBe(0);
    expect(r.warnings.some((w) => w.includes("buildRoot"))).toBe(true);
    // Eval still ran
    expect(r.evalSampleSize).toBe(100);
  });

  it("captures computeEval throw + continues", async () => {
    const deps = mkDeps({
      computeEval: async () => {
        throw new Error("eval down");
      },
    });
    const r = await runNightly(deps);
    expect(r.evalAvgScore).toBe(0);
    expect(r.warnings.some((w) => w.includes("computeEval"))).toBe(true);
  });

  it("captures saveBaseline throw + continues", async () => {
    const deps = mkDeps({
      saveBaseline: async () => {
        throw new Error("disk full");
      },
    });
    const r = await runNightly(deps);
    expect(r.warnings.some((w) => w.includes("baseline"))).toBe(true);
  });

  it("captures sendAlert throw + continues", async () => {
    const regressions: EvalRegression[] = [
      {
        agentName: "x",
        baselineScore: 1,
        currentScore: 0.5,
        delta: -0.5,
        pctDrop: 50,
      },
    ];
    const deps = mkDeps({
      loadBaseline: async () => happyReport(),
      detectRegressions: () => regressions,
      sendAlert: async () => {
        throw new Error("webhook 500");
      },
    });
    const r = await runNightly(deps);
    expect(r.warnings.some((w) => w.includes("sendAlert"))).toBe(true);
  });

  it("warnings also trigger alert dispatch (operator visibility)", async () => {
    const sendAlert = vi.fn(async () => ({ slack: true }));
    const deps = mkDeps({
      buildRoot: async () => {
        throw new Error("oops");
      },
      sendAlert,
    });
    const r = await runNightly(deps);
    expect(sendAlert).toHaveBeenCalledTimes(1);
    expect(r.alertsFired).toEqual({ slack: true });
  });
});

describe("renderAlertSummary", () => {
  it("renders no-regression as ✅", () => {
    const s = renderAlertSummary({
      date: "2026-05-22",
      receiptCount: 1234,
      regressions: [],
      warnings: [],
    });
    expect(s).toMatch(/2026-05-22/);
    expect(s).toMatch(/1,234/);
    expect(s).toMatch(/regressions: none/);
  });

  it("renders regressions with arrows", () => {
    const s = renderAlertSummary({
      date: "2026-05-22",
      receiptCount: 100,
      regressions: [
        {
          agentName: "audit",
          baselineScore: 0.9,
          currentScore: 0.6,
          delta: -0.3,
          pctDrop: 33,
        },
      ],
      warnings: [],
    });
    expect(s).toMatch(/audit/);
    expect(s).toMatch(/0\.900 → 0\.600/);
    expect(s).toMatch(/-33%/);
  });

  it("caps regressions at 10 in output", () => {
    const regs = Array.from({ length: 20 }, (_, i) => ({
      agentName: `agent-${i}`,
      baselineScore: 0.9,
      currentScore: 0.5,
      delta: -0.4,
      pctDrop: 44,
    }));
    const s = renderAlertSummary({
      date: "x",
      receiptCount: 0,
      regressions: regs,
      warnings: [],
    });
    expect(s.match(/agent-/g)?.length).toBe(10);
  });

  it("includes warnings when present", () => {
    const s = renderAlertSummary({
      date: "x",
      receiptCount: 0,
      regressions: [],
      warnings: ["DB unreachable", "S3 timeout"],
    });
    expect(s).toMatch(/Warnings/);
    expect(s).toMatch(/DB unreachable/);
  });
});
