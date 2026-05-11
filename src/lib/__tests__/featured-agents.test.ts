/**
 * Tests for src/lib/featured-agents.ts
 *
 * Critical invariant: every FEATURED slug must exist in AGENT_SLUG_SET.
 * Without this, the marketplace UI renders broken links for "featured"
 * agents — silent product-quality regression.
 */
import { describe, it, expect } from "vitest";
import {
  FEATURED_AGENTS,
  FEATURED_COUNT,
  findOrphanFeaturedAgents,
} from "@/lib/featured-agents";

describe("featured-agents", () => {
  it("FEATURED_AGENTS has at least 25 entries (production-grade subset)", () => {
    expect(FEATURED_AGENTS.length).toBeGreaterThanOrEqual(25);
  });

  it("FEATURED_AGENTS has at most 35 entries (don't dilute the curated list)", () => {
    expect(FEATURED_AGENTS.length).toBeLessThanOrEqual(35);
  });

  it("FEATURED_COUNT matches the array length", () => {
    expect(FEATURED_COUNT).toBe(FEATURED_AGENTS.length);
  });

  it("every featured slug exists in AGENT_SLUG_SET (no orphan slugs)", () => {
    const orphans = findOrphanFeaturedAgents();
    expect(orphans).toEqual([]);
  });

  it("FEATURED_AGENTS contains no duplicates", () => {
    const set = new Set(FEATURED_AGENTS);
    expect(set.size).toBe(FEATURED_AGENTS.length);
  });
});
