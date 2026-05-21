/**
 * Tests for src/lib/extended-metrics.ts — Wave 116 M8.
 *
 * Pins the math, not the storage layer (storage is exercised separately
 * via the integration test on /api/status/metrics/extended).
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

import { aggregateExtended } from "@/lib/extended-metrics";

function row(
  agentName: string,
  modelUsed: string,
  durationMs: number,
  trustDecision = "auto-approved",
) {
  return { agentName, modelUsed, durationMs, trustDecision };
}

describe("aggregateExtended", () => {
  it("returns a valid empty shape when there are no rows", () => {
    const m = aggregateExtended([], "24h");
    expect(m.totalRuns).toBe(0);
    expect(m.slowestAgents).toEqual([]);
    expect(m.busiestAgents).toEqual([]);
    expect(m.models).toEqual([]);
    expect(m.trustDecisions).toEqual([]);
    expect(m.costSavings.savedUsd).toBe(0);
    expect(m.costSavings.baselineUsd).toBe(0);
  });

  it("computes per-agent count + p50 + p95", () => {
    const rows = [
      row("leads", "nvidia-nim-default", 100),
      row("leads", "nvidia-nim-default", 200),
      row("leads", "nvidia-nim-default", 300),
      row("leads", "nvidia-nim-default", 400),
      row("leads", "nvidia-nim-default", 500),
      row("leads", "nvidia-nim-default", 9000), // outlier
    ];
    const m = aggregateExtended(rows, "24h");
    const leads = m.busiestAgents.find((a) => a.agentName === "leads")!;
    expect(leads.count).toBe(6);
    // floor(0.5 * 6) = 3 → index 3 = 400
    expect(leads.p50Ms).toBe(400);
    // p95 with 6 samples lands at floor(0.95 * 6) = floor(5.7) = 5 → index 5
    expect(leads.p95Ms).toBe(9000);
    expect(leads.successRate).toBe(1);
  });

  it("counts blocked runs as failed for successRate", () => {
    const rows = [
      row("audit", "claude-sonnet", 200),
      row("audit", "claude-sonnet", 250),
      row("audit", "claude-sonnet", 300, "blocked"),
      row("audit", "claude-sonnet", 320, "needs-approval"),
    ];
    const m = aggregateExtended(rows, "24h");
    const audit = m.busiestAgents.find((a) => a.agentName === "audit")!;
    expect(audit.count).toBe(4);
    // 3 non-blocked out of 4 = 0.75 (needs-approval counts as success here —
    // only "blocked" is the failure mode the success metric tracks).
    expect(audit.successRate).toBe(0.75);
  });

  it("sorts slowestAgents by p95 desc, busiestAgents by count desc", () => {
    const rows = [
      ...Array.from({ length: 10 }, () => row("popular-fast", "cerebras", 50)),
      ...Array.from({ length: 2 }, () => row("rare-slow", "claude-opus", 8000)),
    ];
    const m = aggregateExtended(rows, "24h");
    expect(m.busiestAgents[0].agentName).toBe("popular-fast");
    expect(m.slowestAgents[0].agentName).toBe("rare-slow");
  });

  it("computes model distribution shares that sum to 1", () => {
    const rows = [
      row("a", "claude-sonnet", 100),
      row("a", "claude-sonnet", 100),
      row("a", "cerebras", 100),
      row("a", "cerebras", 100),
      row("a", "nvidia-nim-default", 100),
    ];
    const m = aggregateExtended(rows, "24h");
    const shareSum = m.models.reduce((s, x) => s + x.share, 0);
    expect(shareSum).toBeCloseTo(1, 5);
    const nim = m.models.find((x) => x.model === "nvidia-nim-default")!;
    expect(nim.share).toBeCloseTo(0.2, 5);
    expect(nim.estimatedCostUsd).toBe(0); // NIM is free in cost table
  });

  it("estimates cost savings vs all-Claude-Sonnet baseline (free NIM = max savings)", () => {
    // 100 runs all on NIM. Baseline = 100 * 4000/1M * 3.0 = $1.20.
    // Actual = 0. Saved = $1.20 (100%).
    const rows = Array.from({ length: 100 }, () =>
      row("a", "nvidia-nim-default", 200),
    );
    const m = aggregateExtended(rows, "24h");
    expect(m.costSavings.baselineUsd).toBeCloseTo(1.2, 2);
    expect(m.costSavings.actualUsd).toBe(0);
    expect(m.costSavings.savedUsd).toBeCloseTo(1.2, 2);
    expect(m.costSavings.savedPct).toBeCloseTo(1, 4);
  });

  it("estimates zero savings when every run goes to the baseline model", () => {
    const rows = Array.from({ length: 50 }, () =>
      row("a", "claude-sonnet", 200),
    );
    const m = aggregateExtended(rows, "24h");
    expect(m.costSavings.savedUsd).toBe(0);
    expect(m.costSavings.savedPct).toBe(0);
  });

  it("groups trust decisions and sorts by count desc", () => {
    const rows = [
      ...Array.from({ length: 8 }, () =>
        row("a", "cerebras", 100, "auto-approved"),
      ),
      row("a", "cerebras", 200, "needs-approval"),
      row("a", "cerebras", 300, "blocked"),
      row("a", "cerebras", 300, "blocked"),
    ];
    const m = aggregateExtended(rows, "24h");
    expect(m.trustDecisions[0]).toEqual({
      decision: "auto-approved",
      count: 8,
      share: 8 / 11,
    });
    expect(m.trustDecisions[1].decision).toBe("blocked");
    expect(m.trustDecisions[1].count).toBe(2);
  });
});
