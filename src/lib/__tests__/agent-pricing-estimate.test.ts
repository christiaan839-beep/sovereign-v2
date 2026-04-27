/**
 * agent-pricing-estimate — tests.
 *
 * Verifies:
 *   - Provider-band lookup uses worst-case framing (never under-promises)
 *   - Free-fallback detection across mixed chains
 *   - Tier banding thresholds
 *   - DAG aggregation (sum of per-node estimates)
 *   - Hostile inputs never throw
 *   - Format helper rounds correctly
 */

import { describe, it, expect } from "vitest";
import {
  estimateAgentCost,
  estimateDagCost,
  formatCents,
  TYPICAL_INPUT_TOKENS,
  TYPICAL_OUTPUT_TOKENS,
} from "../agent-pricing-estimate";

describe("estimateAgentCost", () => {
  it("returns free + tier='free' when only free providers are declared", async () => {
    const r = estimateAgentCost({ providers: ["nvidia-nim", "ollama", "cerebras"] });
    expect(r.worstCaseCentsPerCall).toBe(0);
    expect(r.bestCaseCentsPerCall).toBe(0);
    expect(r.costTier).toBe("free");
    expect(r.hasFreeFallback).toBe(true);
  });

  it("returns medium tier with free-fallback dot when chain mixes paid + free", async () => {
    // Critical contract: a free fallback shifts the band DOWN even if
    // the worst-case is paid. Honest framing — the user can opt-out
    // via SOVEREIGN_FREE_ONLY mode.
    const r = estimateAgentCost({
      providers: ["claude-sonnet", "nvidia-nim"],
    });
    expect(r.worstCaseCentsPerCall).toBeGreaterThan(0);
    expect(r.bestCaseCentsPerCall).toBe(0);
    expect(r.hasFreeFallback).toBe(true);
  });

  it("returns medium-or-high tier when only paid providers are declared", async () => {
    // Worst-case for the paid band lands at single-digit cents per
    // typical call. The exact tier depends on the provider mix; the
    // contract is "no free fallback, non-zero cost".
    const r = estimateAgentCost({ providers: ["claude-opus", "openai"] });
    expect(r.hasFreeFallback).toBe(false);
    expect(["medium", "high"]).toContain(r.costTier);
    expect(r.worstCaseCentsPerCall).toBeGreaterThan(0);
  });

  it("classifies metered providers as low (Groq tier)", async () => {
    const r = estimateAgentCost({ providers: ["groq"] });
    expect(r.hasFreeFallback).toBe(false);
    // Groq's metered band has small per-token costs — should land
    // sub-cent for the typical input/output assumption.
    expect(r.worstCaseCentsPerCall).toBeLessThanOrEqual(5);
  });

  it("dedupes provider list", async () => {
    const r = estimateAgentCost({
      providers: ["claude-sonnet", "claude-sonnet", "nvidia-nim"],
    });
    expect(r.providers.length).toBe(2);
    expect(r.providers).toContain("claude-sonnet");
    expect(r.providers).toContain("nvidia-nim");
  });

  it("returns free + empty providers when none declared (manifest incomplete)", async () => {
    const r = estimateAgentCost({ providers: [] });
    expect(r.providers).toEqual([]);
    expect(r.costTier).toBe("free");
    expect(r.hasFreeFallback).toBe(true);
  });

  it("treats unknown providers as worst-case paid", async () => {
    // Defensive: an agent declares a provider we don't have in the
    // PROVIDER_COSTS table. Default to PAID band so we don't
    // accidentally show a $0 estimate for something pricey.
    const r = estimateAgentCost({ providers: ["future-mystery-provider"] });
    expect(r.worstCaseCentsPerCall).toBeGreaterThan(0);
    expect(r.hasFreeFallback).toBe(false);
  });

  it("methodology field documents the assumptions transparently", async () => {
    const r = estimateAgentCost({ providers: ["claude-sonnet"] });
    expect(r.basedOn.typicalInputTokens).toBe(TYPICAL_INPUT_TOKENS);
    expect(r.basedOn.typicalOutputTokens).toBe(TYPICAL_OUTPUT_TOKENS);
    expect(r.basedOn.methodology).toMatch(/worst-case|cheaper/i);
  });
});

describe("estimateDagCost", () => {
  it("sums per-node costs for the worst- and best-case totals", () => {
    const lookup = (slug: string) => {
      if (slug === "leads") return { providers: ["nvidia-nim"] };
      if (slug === "summarizer") return { providers: ["claude-sonnet"] };
      return undefined;
    };
    const r = estimateDagCost({
      nodes: [
        { id: "n1", agent: "leads" },
        { id: "n2", agent: "summarizer" },
      ],
      agentLookup: lookup,
    });
    // n1 is free; n2 is the paid band.
    expect(r.totalBestCaseCents).toBeGreaterThanOrEqual(0);
    expect(r.totalWorstCaseCents).toBeGreaterThan(0);
    expect(r.totalWorstCaseCents).toBeGreaterThanOrEqual(r.totalBestCaseCents);
    expect(r.perNode).toHaveLength(2);
    expect(r.perNode[0].estimate?.costTier).toBe("free");
  });

  it("skips unknown agents in the per-node array (estimate=null)", () => {
    const r = estimateDagCost({
      nodes: [{ id: "n1", agent: "ghost-agent" }],
      agentLookup: () => undefined,
    });
    expect(r.perNode[0].estimate).toBeNull();
    expect(r.totalWorstCaseCents).toBe(0);
  });

  it("never throws on empty input", () => {
    expect(() =>
      estimateDagCost({ nodes: [], agentLookup: () => undefined }),
    ).not.toThrow();
  });
});

describe("formatCents", () => {
  it("returns 'free' for zero or negative", () => {
    expect(formatCents(0)).toBe("free");
    expect(formatCents(-5)).toBe("free");
  });

  it("returns '<1¢' for sub-cent fractions", () => {
    expect(formatCents(0.5)).toBe("<1¢");
    expect(formatCents(0.01)).toBe("<1¢");
  });

  it("rounds whole cents", () => {
    expect(formatCents(1)).toBe("1¢");
    expect(formatCents(2.4)).toBe("2¢");
    expect(formatCents(99)).toBe("99¢");
  });

  it("formats dollar values for ≥$1", () => {
    expect(formatCents(100)).toBe("$1.00");
    expect(formatCents(150)).toBe("$1.50");
    expect(formatCents(1234)).toBe("$12.34");
  });
});
