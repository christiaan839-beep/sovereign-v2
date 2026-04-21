import { describe, it, expect } from "vitest";
import {
  estimateRunCostCents,
  estimatedHoldCents,
  MODEL_COSTS,
} from "@/lib/pricing-costs";

describe("estimateRunCostCents", () => {
  it("computes cost for a known NIM model", () => {
    // 1000 input + 2000 output on nemotron-ultra-253b-v1:
    //   input:  1000 * 0.5 / 1000 = 0.5 cents
    //   output: 2000 * 2.0 / 1000 = 4.0 cents
    //   total:  4.5, ceil → 5
    expect(estimateRunCostCents("nvidia/nemotron-ultra-253b-v1", 1000, 2000)).toBe(5);
  });

  it("falls back to the default cost for unknown models", () => {
    // default: 1c/1k input, 4c/1k output → 1000 in + 1000 out = 5
    expect(estimateRunCostCents("unknown/model-12b", 1000, 1000)).toBe(5);
  });

  it("never returns less than 1 cent", () => {
    expect(
      estimateRunCostCents("nvidia/nemotron-3-nano-30b-a3b", 1, 1),
    ).toBeGreaterThanOrEqual(1);
  });

  it("always ceil-rounds to whole cents", () => {
    const cents = estimateRunCostCents("nvidia/nemotron-3-nano-30b-a3b", 100, 100);
    expect(Number.isInteger(cents)).toBe(true);
  });
});

describe("estimatedHoldCents", () => {
  it("over-holds using 2x input + full output budget", () => {
    // 2x 2000 = 4000 input + 2000 output on nemotron-ultra:
    //   4000 * 0.5/1000 + 2000 * 2/1000 = 2 + 4 = 6
    expect(estimatedHoldCents("nvidia/nemotron-ultra-253b-v1", 2000)).toBe(6);
  });

  it("uses a 2000-token default when maxTokens omitted", () => {
    const explicit = estimatedHoldCents("nvidia/nemotron-3-nano-30b-a3b", 2000);
    const defaulted = estimatedHoldCents("nvidia/nemotron-3-nano-30b-a3b");
    expect(defaulted).toBe(explicit);
  });
});

describe("MODEL_COSTS coverage", () => {
  it("includes NVIDIA, Claude, Gemini, Cerebras entries", () => {
    expect(MODEL_COSTS["nvidia/nemotron-ultra-253b-v1"]).toBeDefined();
    expect(MODEL_COSTS["claude-sonnet-4-6"]).toBeDefined();
    expect(MODEL_COSTS["gemini-2.5-flash"]).toBeDefined();
    expect(MODEL_COSTS["cerebras/llama3.1-70b"]).toBeDefined();
  });

  it("includes the phase-3.1 new additions", () => {
    // These were added in the hardening sprint — ensure pricing tracks.
    expect(MODEL_COSTS["qwen/qwen-3.5-397b-a17b"]).toBeDefined();
    expect(MODEL_COSTS["moonshotai/kimi-k2.5"]).toBeDefined();
    expect(MODEL_COSTS["mistralai/mistral-small-4-moe"]).toBeDefined();
    expect(MODEL_COSTS["microsoft/phi-4-reasoning-14b"]).toBeDefined();
  });

  it("output is always at least as expensive as input (providers charge more for gen)", () => {
    for (const [id, cost] of Object.entries(MODEL_COSTS)) {
      expect(cost.outputCentsPer1k, `${id}`).toBeGreaterThanOrEqual(cost.inputCentsPer1k);
    }
  });
});
