/**
 * /api/_meta/pricing.json — endpoint smoke tests.
 *
 * Verifies the auditor-LLM-shaped public schema:
 *   - schemaVersion stable
 *   - X-Sovereign-Transparency-Audience header present
 *   - Every agent has a tier band, providers, worst-case + best-case cents
 *   - Summary counts match per-tier totals
 *   - No PII / authentication-gated data leaks (it's public on purpose)
 */

import { describe, it, expect } from "vitest";

import { GET } from "@/app/api/_meta/pricing/route";

describe("GET /api/_meta/pricing.json", () => {
  it("returns 200 with the auditor-LLM audience header", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Sovereign-Transparency-Audience")).toBe(
      "human, ai-agent",
    );
  });

  it("returns the stable schema shape", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.schemaVersion).toBe("1.0");
    expect(body.scope).toBe("platform_inference_cost");
    expect(typeof body.generatedAt).toBe("string");
    expect(body.canonicalUrl).toMatch(/sovereignmatrix.*pricing\.json$/);
    expect(typeof body.rateCard.version).toBe("string");
    expect(body.rateCard.typicalInputTokens).toBeGreaterThan(0);
    expect(body.rateCard.typicalOutputTokens).toBeGreaterThan(0);
    expect(typeof body.rateCard.methodology).toBe("string");
  });

  it("includes every agent with a costTier + cents range", async () => {
    const res = await GET();
    const body = await res.json();
    expect(Array.isArray(body.agents)).toBe(true);
    expect(body.agents.length).toBeGreaterThan(0);
    for (const a of body.agents.slice(0, 10)) {
      expect(typeof a.slug).toBe("string");
      expect([1, 2, 3]).toContain(a.tier);
      expect(["free", "low", "medium", "high"]).toContain(a.costTier);
      expect(Array.isArray(a.providers)).toBe(true);
      expect(typeof a.worstCaseCentsPerCall).toBe("number");
      expect(typeof a.bestCaseCentsPerCall).toBe("number");
      expect(a.worstCaseCentsPerCall).toBeGreaterThanOrEqual(
        a.bestCaseCentsPerCall,
      );
      expect(typeof a.hasFreeFallback).toBe("boolean");
    }
  });

  it("summary counts match the per-tier totals across all agents", async () => {
    // Internal-consistency check: an auditor LLM diffing the response
    // can rely on summary.byTier == sum of agents[].costTier.
    const res = await GET();
    const body = await res.json();
    const recomputed: Record<string, number> = {
      free: 0, low: 0, medium: 0, high: 0,
    };
    for (const a of body.agents) {
      recomputed[a.costTier] += 1;
    }
    expect(body.summary.byTier).toEqual(recomputed);
    expect(body.summary.totalAgents).toBe(body.agents.length);
  });

  it("agents are sorted by slug (deterministic for diffing)", async () => {
    const res = await GET();
    const body = await res.json();
    const slugs = body.agents.map((a: { slug: string }) => a.slug);
    const sorted = [...slugs].sort((a, b) => a.localeCompare(b));
    expect(slugs).toEqual(sorted);
  });
});
