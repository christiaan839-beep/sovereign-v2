/**
 * Tests for src/lib/soc2-evidence.ts — Cook 153.
 */

import { describe, it, expect } from "vitest";
import {
  CONTROLS,
  buildBundle,
  cadenceSummary,
  categorySummary,
  findControl,
  listControls,
} from "../soc2-evidence";

describe("CONTROLS registry", () => {
  it("covers all 5 Trust Services Criteria categories", () => {
    const cats = new Set(CONTROLS.map((c) => c.category));
    expect(cats.size).toBe(5);
    expect(cats.has("security")).toBe(true);
    expect(cats.has("availability")).toBe(true);
    expect(cats.has("processing-integrity")).toBe(true);
    expect(cats.has("confidentiality")).toBe(true);
    expect(cats.has("privacy")).toBe(true);
  });

  it("has unique control ids", () => {
    const ids = CONTROLS.map((c) => c.controlId);
    const set = new Set(ids);
    expect(set.size).toBe(ids.length);
  });

  it("every control has a real evidence source string", () => {
    for (const c of CONTROLS) {
      expect(c.evidenceSource.length).toBeGreaterThan(0);
      expect(c.collectionPath.length).toBeGreaterThan(0);
    }
  });
});

describe("listControls", () => {
  it("returns all when no category filter is given", () => {
    expect(listControls()).toHaveLength(CONTROLS.length);
  });

  it("filters by category", () => {
    const sec = listControls("security");
    expect(sec.length).toBeGreaterThan(0);
    expect(sec.every((c) => c.category === "security")).toBe(true);
  });
});

describe("buildBundle", () => {
  it("rejects period where end <= start", () => {
    expect(() => buildBundle({ periodStart: 100, periodEnd: 100 })).toThrow();
    expect(() => buildBundle({ periodStart: 200, periodEnd: 100 })).toThrow();
  });

  it("returns every in-scope control when no category filter", () => {
    const b = buildBundle({
      periodStart: 1_000,
      periodEnd: 2_000,
      now: 3_000,
    });
    expect(b.controls).toHaveLength(CONTROLS.length);
    expect(b.generatedAt).toBe(3_000);
  });

  it("filters controls by category", () => {
    const b = buildBundle({
      periodStart: 1_000,
      periodEnd: 2_000,
      category: "privacy",
    });
    expect(b.controls.every((c) => c.category === "privacy")).toBe(true);
  });

  it("merges caller-supplied artifact counts + zero-fills missing", () => {
    const b = buildBundle({
      periodStart: 1_000,
      periodEnd: 2_000,
      artifactCounts: { "CC6.1": 1500, "PI1.1": 24_000 },
    });
    expect(b.artifactCounts["CC6.1"]).toBe(1500);
    expect(b.artifactCounts["PI1.1"]).toBe(24_000);
    // every other in-scope control gets 0 (zero-fill).
    for (const c of b.controls) {
      expect(b.artifactCounts[c.controlId]).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("cadenceSummary", () => {
  it("sums to the total control count", () => {
    const s = cadenceSummary();
    const total = s["real-time"] + s.daily + s.weekly + s.monthly + s.quarterly;
    expect(total).toBe(CONTROLS.length);
  });

  it("includes some real-time controls (the receipt fabric)", () => {
    expect(cadenceSummary()["real-time"]).toBeGreaterThan(0);
  });
});

describe("categorySummary", () => {
  it("sums to the total control count", () => {
    const s = categorySummary();
    const total =
      s.security +
      s.availability +
      s["processing-integrity"] +
      s.confidentiality +
      s.privacy;
    expect(total).toBe(CONTROLS.length);
  });

  it("security has the most controls (Common Criteria CC1-CC9)", () => {
    const s = categorySummary();
    expect(s.security).toBeGreaterThanOrEqual(s.availability);
    expect(s.security).toBeGreaterThanOrEqual(s.privacy);
  });
});

describe("findControl", () => {
  it("returns the control for a known id", () => {
    const c = findControl("CC6.1");
    expect(c).toBeDefined();
    expect(c?.category).toBe("security");
  });

  it("returns undefined for an unknown id", () => {
    expect(findControl("ZZ9.9")).toBeUndefined();
  });
});
