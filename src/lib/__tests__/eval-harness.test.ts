/**
 * Tests for src/lib/eval-harness.ts — Wave 138.
 *
 * Pure-function tests over `heuristicScore`, `aggregateEvalScores`,
 * `detectRegressions`. No DB, no LLM.
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
  heuristicScore,
  aggregateEvalScores,
  detectRegressions,
  type EvalSampleRow,
  type EvalReport,
} from "@/lib/eval-harness";

function mkRow(overrides: Partial<EvalSampleRow> = {}): EvalSampleRow {
  return {
    id: overrides.id ?? "id-1",
    agentName: "audit",
    modelUsed: "nemotron",
    inputJson: JSON.stringify({ prompt: "Analyze acme.com" }),
    outputJson: JSON.stringify({
      result: "x".repeat(200) + " 42 metrics found at https://acme.com",
    }),
    trustDecision: "auto-approved",
    durationMs: 800,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("heuristicScore", () => {
  it("returns 0.1 on too-short output", () => {
    expect(heuristicScore("q", "tiny")).toBeLessThanOrEqual(0.15);
  });

  it("penalises rambling above the upper bound", () => {
    expect(heuristicScore("q", "x".repeat(15_000))).toBeLessThan(0.5);
  });

  it("rewards specificity — numbers + URLs + citations", () => {
    const good =
      "We found 42 issues across 7 categories. See https://example.com and source [1].";
    const bad = "We found some issues across some categories.";
    expect(heuristicScore("test", good)).toBeGreaterThan(
      heuristicScore("test", bad),
    );
  });

  it("penalises filler phrases", () => {
    const filler =
      "I would be happy to help. Certainly! Great question. As an AI I can confirm. " +
      "x".repeat(120);
    const clean =
      "Direct answer with numbers like 7 and 14. " + "x".repeat(120);
    expect(heuristicScore("q", filler)).toBeLessThan(
      heuristicScore("q", clean),
    );
  });

  it("penalises PII leakage in output (SSN)", () => {
    const piiOut = "Customer 123-45-6789 owes us money. " + "x".repeat(120);
    const cleanOut = "Customer owes us money. " + "x".repeat(120);
    expect(heuristicScore("q", piiOut)).toBeLessThan(
      heuristicScore("q", cleanOut),
    );
  });

  it("rewards keyword overlap with input", () => {
    const input =
      "Tell me about the inference cost optimization on vLLM endpoints.";
    const onTopic =
      "Inference cost on vLLM endpoints drops to roughly $0 marginal " +
      "once the GPU is amortized. Optimization tip: cache at the endpoint.".repeat(
        2,
      );
    const offTopic =
      "Pineapple recipes are great in summer. " + "x".repeat(150);
    expect(heuristicScore(input, onTopic)).toBeGreaterThan(
      heuristicScore(input, offTopic),
    );
  });

  it("clamps results to [0, 1]", () => {
    const r = heuristicScore("", "");
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
  });
});

describe("aggregateEvalScores — heuristic mode", () => {
  it("returns an empty shape for no rows", async () => {
    const r = await aggregateEvalScores([]);
    expect(r.totalRowsScored).toBe(0);
    expect(r.perAgent).toEqual([]);
    expect(r.overall.avgScore).toBe(0);
  });

  it("groups by agent + sorts perAgent by score asc", async () => {
    const rows: EvalSampleRow[] = [
      mkRow({ id: "1", agentName: "alpha" }),
      mkRow({
        id: "2",
        agentName: "beta",
        outputJson: JSON.stringify({ result: "tiny" }),
      }),
      mkRow({ id: "3", agentName: "alpha" }),
    ];
    const r = await aggregateEvalScores(rows);
    expect(r.perAgent).toHaveLength(2);
    // beta should be first (lower score)
    expect(r.perAgent[0].agentName).toBe("beta");
    expect(r.perAgent[1].agentName).toBe("alpha");
  });

  it("flags too-short outputs and PII leaks", async () => {
    const rows = [
      mkRow({
        id: "short-1",
        outputJson: JSON.stringify({ result: "tiny" }),
      }),
      mkRow({
        id: "pii-1",
        outputJson: JSON.stringify({
          result: "Customer 123-45-6789 owes money " + "x".repeat(150),
        }),
      }),
    ];
    const r = await aggregateEvalScores(rows);
    const audit = r.perAgent.find((a) => a.agentName === "audit");
    expect(audit?.flags.some((f) => f.kind === "too-short")).toBe(true);
    expect(audit?.flags.some((f) => f.kind === "pii-leak")).toBe(true);
  });

  it("computes auto-approved rate per agent", async () => {
    const rows = [
      mkRow({ id: "ok-1", trustDecision: "auto-approved" }),
      mkRow({ id: "ok-2", trustDecision: "auto-approved" }),
      mkRow({ id: "block-1", trustDecision: "blocked" }),
    ];
    const r = await aggregateEvalScores(rows);
    expect(r.perAgent[0].autoApprovedRate).toBeCloseTo(2 / 3, 2);
  });

  it("uses caller-supplied judge when given", async () => {
    const judge = vi.fn(async () => 0.9);
    const r = await aggregateEvalScores([mkRow()], { judge });
    expect(judge).toHaveBeenCalledTimes(1);
    expect(r.perAgent[0].avgScore).toBeCloseTo(0.9, 2);
  });

  it("clamps judge return values into [0,1]", async () => {
    const judge = vi.fn(async () => 1.5);
    const r = await aggregateEvalScores([mkRow()], { judge });
    expect(r.perAgent[0].avgScore).toBeLessThanOrEqual(1);
  });

  it("falls back to heuristic when judge throws", async () => {
    const judge = vi.fn(async () => {
      throw new Error("rate-limited");
    });
    const r = await aggregateEvalScores([mkRow()], { judge });
    expect(r.perAgent[0].avgScore).toBeGreaterThan(0);
  });
});

describe("detectRegressions", () => {
  function mkReport(
    perAgent: Array<{ agentName: string; avgScore: number }>,
  ): EvalReport {
    return {
      generatedAt: new Date().toISOString(),
      windowDays: 7,
      totalRowsScored: perAgent.length,
      perAgent: perAgent.map((p) => ({
        ...p,
        samples: 10,
        autoApprovedRate: 1,
        avgDurationMs: 800,
        flags: [],
      })),
      overall: { avgScore: 0.7, autoApprovedRate: 1 },
    };
  }

  it("returns empty list when nothing regressed", () => {
    const base = mkReport([
      { agentName: "a", avgScore: 0.7 },
      { agentName: "b", avgScore: 0.8 },
    ]);
    const cur = mkReport([
      { agentName: "a", avgScore: 0.71 },
      { agentName: "b", avgScore: 0.82 },
    ]);
    expect(detectRegressions(cur, base)).toEqual([]);
  });

  it("flags agents that dropped beyond the threshold", () => {
    const base = mkReport([
      { agentName: "a", avgScore: 0.8 },
      { agentName: "b", avgScore: 0.6 },
    ]);
    const cur = mkReport([
      { agentName: "a", avgScore: 0.4 }, // 50% drop
      { agentName: "b", avgScore: 0.58 }, // ~3% drop
    ]);
    const r = detectRegressions(cur, base, 5);
    expect(r).toHaveLength(1);
    expect(r[0].agentName).toBe("a");
    expect(r[0].pctDrop).toBeGreaterThan(40);
  });

  it("sorts regressions worst-first", () => {
    const base = mkReport([
      { agentName: "a", avgScore: 0.9 },
      { agentName: "b", avgScore: 0.9 },
    ]);
    const cur = mkReport([
      { agentName: "a", avgScore: 0.7 }, // ~22% drop
      { agentName: "b", avgScore: 0.4 }, // ~55% drop
    ]);
    const r = detectRegressions(cur, base);
    expect(r[0].agentName).toBe("b");
    expect(r[1].agentName).toBe("a");
  });

  it("ignores agents not present in the baseline (new agents)", () => {
    const base = mkReport([{ agentName: "a", avgScore: 0.8 }]);
    const cur = mkReport([
      { agentName: "a", avgScore: 0.79 },
      { agentName: "new-agent", avgScore: 0.0 },
    ]);
    expect(detectRegressions(cur, base)).toEqual([]);
  });

  it("respects threshold parameter", () => {
    const base = mkReport([{ agentName: "a", avgScore: 0.5 }]);
    const cur = mkReport([{ agentName: "a", avgScore: 0.45 }]); // 10% drop
    expect(detectRegressions(cur, base, 5)).toHaveLength(1);
    expect(detectRegressions(cur, base, 15)).toEqual([]);
  });
});
