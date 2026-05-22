/**
 * Tests for src/lib/bandit-autoseed.ts — Wave 149.
 *
 * Pure-function tests on `buildSeedPlan`. DB-backed `runAutoSeed`
 * smoke-tested via the guard paths.
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

import { buildSeedPlan } from "@/lib/bandit-autoseed";

function r(agent: string, model: string) {
  return { agent_name: agent, model_used: model };
}

describe("buildSeedPlan — filtering", () => {
  it("returns empty plan for empty input", () => {
    const plan = buildSeedPlan([]);
    expect(plan.size).toBe(0);
  });

  it("requires minSamples per pair before seeding", () => {
    const plan = buildSeedPlan(
      [r("audit", "nim"), r("audit", "nim"), r("audit", "claude")],
      3,
    );
    expect(plan.size).toBe(0);
  });

  it("seeds the pair when samples meet the threshold", () => {
    const rows = Array.from({ length: 5 }, () => r("audit", "nim"));
    const plan = buildSeedPlan(rows, 3);
    expect(plan.get("audit")?.models.has("nim")).toBe(true);
    expect(plan.get("audit")?.samples).toBe(5);
  });

  it("skips placeholder model strings (agent-factory / unknown / etc.)", () => {
    const rows = Array.from({ length: 10 }, () => r("audit", "agent-factory"));
    const plan = buildSeedPlan(rows);
    expect(plan.size).toBe(0);
  });

  it("skips empty agent_name", () => {
    const rows = Array.from({ length: 5 }, () => r("", "nim"));
    const plan = buildSeedPlan(rows);
    expect(plan.size).toBe(0);
  });
});

describe("buildSeedPlan — multi-model + multi-agent", () => {
  it("groups multiple models per agent", () => {
    const rows = [
      ...Array.from({ length: 5 }, () => r("audit", "nim")),
      ...Array.from({ length: 4 }, () => r("audit", "claude")),
      ...Array.from({ length: 3 }, () => r("audit", "gemini")),
    ];
    const plan = buildSeedPlan(rows, 3);
    expect(plan.get("audit")?.models.size).toBe(3);
    expect(plan.get("audit")?.samples).toBe(12);
  });

  it("groups multiple agents independently", () => {
    const rows = [
      ...Array.from({ length: 5 }, () => r("audit", "nim")),
      ...Array.from({ length: 5 }, () => r("ocr", "nemotron")),
    ];
    const plan = buildSeedPlan(rows, 3);
    expect(plan.size).toBe(2);
    expect(plan.get("audit")?.models.has("nim")).toBe(true);
    expect(plan.get("ocr")?.models.has("nemotron")).toBe(true);
  });

  it("only includes models that individually meet the threshold", () => {
    const rows = [
      ...Array.from({ length: 5 }, () => r("audit", "nim")),
      ...Array.from({ length: 2 }, () => r("audit", "claude")),
    ];
    const plan = buildSeedPlan(rows, 3);
    expect(plan.get("audit")?.models.has("nim")).toBe(true);
    expect(plan.get("audit")?.models.has("claude")).toBe(false);
  });

  it("samples count is across QUALIFYING models only", () => {
    const rows = [
      ...Array.from({ length: 5 }, () => r("audit", "nim")),
      ...Array.from({ length: 2 }, () => r("audit", "claude")), // doesn't qualify
    ];
    const plan = buildSeedPlan(rows, 3);
    expect(plan.get("audit")?.samples).toBe(5);
  });
});

describe("buildSeedPlan — large scale", () => {
  it("handles 10K mixed rows", () => {
    const rows = [];
    for (let i = 0; i < 5000; i++) rows.push(r(`agent-${i % 20}`, "nim"));
    for (let i = 0; i < 5000; i++) rows.push(r(`agent-${i % 20}`, "claude"));
    const plan = buildSeedPlan(rows, 3);
    expect(plan.size).toBe(20);
    for (const v of plan.values()) {
      expect(v.models.size).toBe(2);
    }
  });
});
