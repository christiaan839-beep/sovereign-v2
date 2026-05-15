/**
 * Tests for src/lib/model-registry.ts — Cook 183.
 */

import { describe, it, expect } from "vitest";
import {
  MODELS,
  findModel,
  listModels,
  modelsByProvider,
  modelsByTier,
  modelsUnderBudget,
  openWeightsOnly,
  preferredFor,
  registrySummary,
} from "../model-registry";

describe("MODELS registry", () => {
  it("includes DeepSeek-R1 as a frontier reasoning option", () => {
    const r1 = MODELS["deepseek-r1"];
    expect(r1).toBeDefined();
    expect(r1.capabilityTier).toBe("reasoning");
    expect(r1.weightsOpen).toBe(true);
    expect(r1.license).toBe("MIT");
  });

  it("includes Llama 3.3 70B as a high-tier open model", () => {
    const llama = MODELS["llama-3.3-70b"];
    expect(llama).toBeDefined();
    expect(llama.capabilityTier).toBe("high");
    expect(llama.weightsOpen).toBe(true);
  });

  it("includes Qwen Coder 32B for code tier", () => {
    const qwen = MODELS["qwen-2.5-coder-32b"];
    expect(qwen.capabilityTier).toBe("code");
    expect(qwen.costPerMillionInputUsd).toBe(0);
  });

  it("every model has well-formed cost numbers", () => {
    for (const m of listModels()) {
      expect(m.costPerMillionInputUsd).toBeGreaterThanOrEqual(0);
      expect(m.costPerMillionOutputUsd).toBeGreaterThanOrEqual(0);
      expect(m.contextWindow).toBeGreaterThanOrEqual(0);
    }
  });

  it("every model has a homepage URL", () => {
    for (const m of listModels()) {
      expect(m.homepage).toMatch(/^https?:\/\//);
    }
  });
});

describe("listModels", () => {
  it("returns every model in the registry", () => {
    expect(listModels().length).toBe(Object.keys(MODELS).length);
  });
});

describe("modelsByTier", () => {
  it("returns only reasoning models for reasoning tier", () => {
    const r = modelsByTier("reasoning");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((m) => m.capabilityTier === "reasoning")).toBe(true);
  });

  it("returns only voice models for voice tier", () => {
    const v = modelsByTier("voice");
    expect(v.length).toBeGreaterThan(0);
    expect(v.every((m) => m.capabilityTier === "voice")).toBe(true);
  });
});

describe("openWeightsOnly", () => {
  it("excludes proprietary models", () => {
    const open = openWeightsOnly();
    expect(open.every((m) => m.weightsOpen)).toBe(true);
    expect(open.some((m) => m.license === "Proprietary")).toBe(false);
  });

  it("includes Llama family + DeepSeek + Qwen", () => {
    const ids = openWeightsOnly().map((m) => m.id);
    expect(ids).toContain("llama-3.3-70b");
    expect(ids).toContain("deepseek-r1");
    expect(ids).toContain("qwen-2.5-coder-32b");
  });
});

describe("modelsUnderBudget", () => {
  it("$0 budget returns only free / self-hosted models", () => {
    const free = modelsUnderBudget(0);
    expect(free.every((m) => m.costPerMillionInputUsd === 0)).toBe(true);
    expect(free.length).toBeGreaterThan(0);
  });

  it("$1 budget includes DeepSeek-R1 ($0.55)", () => {
    const ids = modelsUnderBudget(1).map((m) => m.id);
    expect(ids).toContain("deepseek-r1");
  });

  it("$0.10 budget excludes Claude Opus ($15)", () => {
    const ids = modelsUnderBudget(0.1).map((m) => m.id);
    expect(ids).not.toContain("claude-opus-4-7");
  });
});

describe("preferredFor", () => {
  it("returns reasoning models sorted by cost ascending", () => {
    const ordered = preferredFor("reasoning");
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i].costPerMillionInputUsd).toBeGreaterThanOrEqual(
        ordered[i - 1].costPerMillionInputUsd,
      );
    }
  });

  it("respects the budget cap", () => {
    const cheap = preferredFor("frontier", 5);
    expect(cheap.every((m) => m.costPerMillionInputUsd <= 5)).toBe(true);
  });
});

describe("modelsByProvider", () => {
  it("groups models under their provider key", () => {
    const grouped = modelsByProvider();
    expect(grouped.deepseek).toBeDefined();
    expect(grouped.deepseek.length).toBeGreaterThanOrEqual(2);
  });
});

describe("findModel", () => {
  it("returns the model by id", () => {
    expect(findModel("deepseek-r1")?.id).toBe("deepseek-r1");
  });
  it("returns undefined for unknown id", () => {
    expect(findModel("nope")).toBeUndefined();
  });
});

describe("registrySummary", () => {
  it("returns sane counts", () => {
    const s = registrySummary();
    expect(s.modelCount).toBe(listModels().length);
    expect(s.providerCount).toBeGreaterThan(0);
    expect(s.openWeightsCount).toBeGreaterThan(0);
    expect(s.averageInputCostUsd).toBeGreaterThanOrEqual(0);
  });
});
