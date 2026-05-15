/**
 * Tests for src/lib/vertical-readiness.ts — Cook 170.
 */

import { describe, it, expect } from "vitest";
import {
  VERTICALS,
  platformGaps,
  platformReadiness,
  scoreAllVerticals,
  scoreVertical,
  type VerticalReadiness,
  type VerticalSlug,
} from "../vertical-readiness";

describe("VERTICALS registry", () => {
  it("covers the 8 canonical verticals", () => {
    const slugs = Object.keys(VERTICALS) as VerticalSlug[];
    expect(slugs).toHaveLength(8);
    expect(slugs).toContain("csrd");
    expect(slugs).toContain("banking");
    expect(slugs).toContain("pharmacovigilance");
    expect(slugs).toContain("clinical-trials");
    expect(slugs).toContain("insurance-claims");
    expect(slugs).toContain("utilities");
    expect(slugs).toContain("defense");
    expect(slugs).toContain("tax-audit");
  });

  it("every vertical points to a /for-* landing path", () => {
    for (const v of Object.values(VERTICALS)) {
      expect(v.landingPath).toMatch(/^\/for-/);
    }
  });

  it("CSRD has the canonical 7-yr retention policy", () => {
    expect(VERTICALS.csrd.retentionPolicyId).toBe("csrd-7yr");
  });

  it("Pharmacovigilance has 25-year retention (ICH E2D)", () => {
    expect(VERTICALS.pharmacovigilance.retentionPolicyId).toBe("pv-25yr");
  });
});

describe("scoreVertical", () => {
  it("returns a 0-100 score", () => {
    for (const v of Object.values(VERTICALS)) {
      const s = scoreVertical(v);
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });

  it("provides a breakdown summing to score", () => {
    const v = VERTICALS.csrd;
    const s = scoreVertical(v);
    const sumBreakdown = Object.values(s.breakdown).reduce((a, b) => a + b, 0);
    expect(sumBreakdown).toBe(s.score);
  });

  it("flags missing items for verticals without a pack SKU", () => {
    const s = scoreVertical(VERTICALS["insurance-claims"]);
    expect(s.missing).toContain("regulatory pack SKU");
  });

  it("flags missing audit-bundle when template is null", () => {
    const s = scoreVertical(VERTICALS["insurance-claims"]);
    expect(s.missing.some((m) => m.includes("audit-bundle"))).toBe(true);
  });

  it("CSRD scores 100/100 (fully ready)", () => {
    const s = scoreVertical(VERTICALS.csrd);
    expect(s.score).toBe(100);
    expect(s.missing).toHaveLength(0);
  });

  it("Banking scores 100/100", () => {
    const s = scoreVertical(VERTICALS.banking);
    expect(s.score).toBe(100);
  });

  it("Clinical-trials scores 100/100", () => {
    const s = scoreVertical(VERTICALS["clinical-trials"]);
    expect(s.score).toBe(100);
  });

  it("Pharmacovigilance scores 100/100", () => {
    const s = scoreVertical(VERTICALS.pharmacovigilance);
    expect(s.score).toBe(100);
  });

  it("Utilities scores 100/100", () => {
    const s = scoreVertical(VERTICALS.utilities);
    expect(s.score).toBe(100);
  });

  it("partially-complete verticals score below 100", () => {
    expect(scoreVertical(VERTICALS["insurance-claims"]).score).toBeLessThan(
      100,
    );
    expect(scoreVertical(VERTICALS["tax-audit"]).score).toBeLessThan(100);
    expect(scoreVertical(VERTICALS.defense).score).toBeLessThan(100);
  });
});

describe("scoreAllVerticals", () => {
  it("returns a score for every vertical", () => {
    expect(scoreAllVerticals()).toHaveLength(8);
  });
});

describe("platformReadiness", () => {
  it("returns avg / min / max across the 8 verticals", () => {
    const r = platformReadiness();
    expect(r.avg).toBeGreaterThan(0);
    expect(r.avg).toBeLessThanOrEqual(100);
    expect(r.min).toBeLessThanOrEqual(r.avg);
    expect(r.max).toBeGreaterThanOrEqual(r.avg);
  });
});

describe("platformGaps", () => {
  it("returns at least one entry for partially-complete verticals", () => {
    const gaps = platformGaps();
    expect(gaps.length).toBeGreaterThan(0);
    for (const g of gaps) {
      expect(g.missing.length).toBeGreaterThan(0);
    }
  });

  it("does not list fully-100/100 verticals", () => {
    const gaps = platformGaps();
    const fullSlugs = scoreAllVerticals()
      .filter((s) => s.score === 100)
      .map((s) => s.slug);
    for (const g of gaps) {
      expect(fullSlugs).not.toContain(g.slug);
    }
  });
});

describe("scoreVertical handles edge cases", () => {
  it("scores zero on an empty vertical (degenerate input)", () => {
    const empty: VerticalReadiness = {
      slug: "csrd",
      name: "",
      landingPath: "",
      packSkuId: null,
      primitives: [],
      frameworks: [],
      anchorChain: "bitcoin-mainnet",
      retentionPolicyId: "",
      acvUsd: { low: 0, high: 0 },
      buyer: "",
      workflowsDocumented: 0,
      auditBundleTemplate: null,
      replaySeatEnabled: false,
    };
    const s = scoreVertical(empty);
    // anchorChain still set so 5pts from that axis only
    expect(s.score).toBeLessThan(20);
  });
});
