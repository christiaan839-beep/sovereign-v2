/**
 * Tests for src/lib/model-prices.ts — the canonical AI cost table.
 *
 * The platform's spend cap is only as honest as this table. Wrong prices
 * here = wrong budget enforcement = real money risk. These tests pin the
 * key invariants.
 */
import { describe, it, expect } from "vitest";
import { getModelPrice, calculateCostCents } from "@/lib/model-prices";

describe("getModelPrice", () => {
  it("returns free=true for known free providers", () => {
    expect(getModelPrice("nvidia/llama-3.1-nemotron-ultra-253b-v1").free).toBe(
      true,
    );
    expect(getModelPrice("deepseek-ai/deepseek-v3.2").free).toBe(true);
    expect(getModelPrice("google/gemma-4-31b-it").free).toBe(true);
    expect(getModelPrice("ollama-local").free).toBe(true);
  });

  it("returns free=false for paid models with non-zero pricing", () => {
    const claude = getModelPrice("claude-sonnet-4-6");
    expect(claude.free).toBe(false);
    expect(claude.inputPerMillionCents).toBeGreaterThan(0);
    expect(claude.outputPerMillionCents).toBeGreaterThan(0);
    expect(claude.provider).toBe("anthropic");
  });

  it("falls back to UNKNOWN_PAID for truly unknown models — never silently free", () => {
    const unknown = getModelPrice("brand-new-model-not-in-the-table");
    expect(unknown.free).toBe(false);
    expect(unknown.provider).toBe("unknown");
    expect(unknown.inputPerMillionCents).toBeGreaterThan(0);
  });

  it("matches paid Claude variants by family prefix", () => {
    const newClaude = getModelPrice("claude-sonnet-4-6-20250101");
    expect(newClaude.free).toBe(false);
    expect(newClaude.provider).toBe("anthropic");
  });

  it("treats unknown nvidia/* models as free (NIM tier)", () => {
    expect(getModelPrice("nvidia/some-future-model").free).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(getModelPrice("CLAUDE-SONNET-4-6").free).toBe(false);
    expect(getModelPrice("Claude-Sonnet-4-6").provider).toBe("anthropic");
  });
});

describe("calculateCostCents", () => {
  it("returns 0 for free models (no rounding-up)", () => {
    const cost = calculateCostCents(
      "nvidia/llama-3.1-nemotron-ultra-253b-v1",
      100_000,
      50_000,
    );
    expect(cost).toBe(0);
  });

  it("rounds UP to at least 1 cent for any paid call (no $0 paid call slips by)", () => {
    // 1 input token on Claude Haiku is way less than a cent — must still bill 1.
    const cost = calculateCostCents("claude-haiku-4-5", 1, 0);
    expect(cost).toBe(1);
  });

  it("scales linearly with token count for paid models", () => {
    // Claude Sonnet 4.6 = $3/M in, $15/M out
    // 1M input + 0 output = $3 = 300 cents
    const cost = calculateCostCents("claude-sonnet-4-6", 1_000_000, 0);
    expect(cost).toBe(300);
  });

  it("differentiates input vs output token cost", () => {
    // Claude Opus = $15/M in, $75/M out — output is 5x input
    const inputOnly = calculateCostCents("claude-opus-4-7", 1_000_000, 0);
    const outputOnly = calculateCostCents("claude-opus-4-7", 0, 1_000_000);
    expect(outputOnly).toBe(inputOnly * 5);
  });

  it("treats unknown models as paid (conservative budget gate)", () => {
    const cost = calculateCostCents("ghost-model", 1_000_000, 1_000_000);
    expect(cost).toBeGreaterThan(0);
  });
});
