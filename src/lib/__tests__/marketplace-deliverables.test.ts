/**
 * Tests for src/lib/marketplace-deliverables.ts
 *
 * Critical invariant: every agent slug referenced from a deliverable
 * MUST exist in AGENT_SLUG_SET. A typo or stale entry would render an
 * empty link in the marketplace UI — silent product-quality regression.
 */
import { describe, it, expect } from "vitest";
import {
  DELIVERABLES,
  findOrphanDeliverableAgents,
} from "@/lib/marketplace-deliverables";

describe("marketplace-deliverables", () => {
  it("has at least 6 deliverables defined", () => {
    expect(DELIVERABLES.length).toBeGreaterThanOrEqual(6);
  });

  it("every deliverable has a unique slug", () => {
    const slugs = DELIVERABLES.map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("every agent referenced exists in AGENT_SLUG_SET (no orphan slugs)", () => {
    const orphans = findOrphanDeliverableAgents();
    expect(orphans).toEqual([]);
  });

  it("each deliverable lists 3–6 agents (tight composition)", () => {
    for (const d of DELIVERABLES) {
      expect(
        d.agents.length,
        `${d.slug} should have 3–6 agents (has ${d.agents.length})`,
      ).toBeGreaterThanOrEqual(3);
      expect(d.agents.length).toBeLessThanOrEqual(6);
    }
  });

  it("each deliverable has the required UX fields populated", () => {
    for (const d of DELIVERABLES) {
      expect(d.outcome.length, `${d.slug} outcome`).toBeGreaterThan(0);
      expect(d.promise.length, `${d.slug} promise`).toBeGreaterThan(20);
      expect(d.metric.length, `${d.slug} metric`).toBeGreaterThan(0);
      expect(d.timeToFirst.length, `${d.slug} timeToFirst`).toBeGreaterThan(0);
    }
  });
});
