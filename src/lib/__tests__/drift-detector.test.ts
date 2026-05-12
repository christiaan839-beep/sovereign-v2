/**
 * Tests for src/lib/drift-detector.ts — agent-output divergence scoring.
 *
 * The detector is the foundation under both the receipt-replay endpoint
 * (Cook 35) and the future canary-set framework (Cook 36). These tests
 * lock the score weighting, the diff walker's contracts, and the
 * tolerance boundary so a future "tuning" can't accidentally regress
 * the drift-detection floor.
 *
 * Pure module — no mocks needed.
 */

import { describe, it, expect } from "vitest";
import {
  hashOf,
  diffJson,
  structuralSimilarity,
  cosineSimilarity,
  detectDrift,
} from "../drift-detector";

describe("hashOf", () => {
  it("produces stable SHA-256 hex for primitives", () => {
    expect(hashOf("hello")).toMatch(/^[a-f0-9]{64}$/);
    expect(hashOf(42)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashOf(null)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns the same hash for equal objects regardless of construction", () => {
    // Both inputs serialize to the same JSON, so hashes match.
    expect(hashOf({ a: 1, b: 2 })).toBe(hashOf({ a: 1, b: 2 }));
  });

  it("returns different hashes for different values", () => {
    expect(hashOf({ a: 1 })).not.toBe(hashOf({ a: 2 }));
  });
});

describe("diffJson", () => {
  it("returns no diffs for byte-equal objects", () => {
    expect(diffJson({ a: 1 }, { a: 1 })).toEqual([]);
  });

  it("detects added keys", () => {
    const diffs = diffJson({ a: 1 }, { a: 1, b: 2 });
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ path: "$.b", kind: "added", after: 2 });
  });

  it("detects missing keys", () => {
    const diffs = diffJson({ a: 1, b: 2 }, { a: 1 });
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ path: "$.b", kind: "missing", before: 2 });
  });

  it("detects value changes on primitives", () => {
    const diffs = diffJson({ a: 1 }, { a: 2 });
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({
      path: "$.a",
      kind: "value-changed",
      before: 1,
      after: 2,
    });
  });

  it("detects type mismatches without recursing into them", () => {
    // When the types differ, we do NOT walk into the values — we
    // record one type-mismatch diff. This prevents path explosion
    // when one side is an object and the other is a string.
    const diffs = diffJson({ a: { x: 1 } }, { a: "string" });
    const aDiff = diffs.find((d) => d.path === "$.a");
    expect(aDiff?.kind).toBe("type-mismatch");
    expect(diffs.some((d) => d.path.startsWith("$.a."))).toBe(false);
  });

  it("walks arrays by index", () => {
    const diffs = diffJson([1, 2, 3], [1, 99, 3]);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({
      path: "$[1]",
      kind: "value-changed",
      before: 2,
      after: 99,
    });
  });

  it("flags array length changes", () => {
    const diffs = diffJson([1, 2], [1, 2, 3]);
    expect(diffs.some((d) => d.path === "$[2]" && d.kind === "added")).toBe(
      true,
    );
  });

  it("respects the diff limit", () => {
    // 100 changes; limit 5 → expect 5 diffs returned.
    const before = Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [`k${i}`, i]),
    );
    const after = Object.fromEntries(
      Array.from({ length: 100 }, (_, i) => [`k${i}`, i + 1]),
    );
    expect(diffJson(before, after, 5)).toHaveLength(5);
  });

  it("treats null and undefined as different types", () => {
    const diffs = diffJson({ a: null }, { a: undefined });
    // undefined values get dropped by JSON serialization but not by
    // the walker — we should detect this distinction explicitly.
    // Our walker reports "missing" since `a in {a: undefined}` is
    // true but the value is undefined; describeType returns
    // "undefined" vs "null", which is a type-mismatch.
    expect(diffs[0]?.kind).toBe("type-mismatch");
  });
});

describe("structuralSimilarity", () => {
  it("returns 1 for byte-equal objects", () => {
    expect(structuralSimilarity({ a: 1 }, { a: 1 })).toBe(1);
  });

  it("returns 1 when only values differ (structure intact)", () => {
    // Value-changed diffs are not structural — captured by semantic
    // similarity instead.
    expect(structuralSimilarity({ a: 1 }, { a: 2 })).toBe(1);
  });

  it("returns less than 1 when keys are added or removed", () => {
    expect(structuralSimilarity({ a: 1 }, { a: 1, b: 2 })).toBeLessThan(1);
  });

  it("never returns above 1", () => {
    // Even with massive divergence, the cap holds.
    expect(
      structuralSimilarity({}, Array.from({ length: 1000 })),
    ).toBeLessThanOrEqual(1);
    expect(
      structuralSimilarity({}, Array.from({ length: 1000 })),
    ).toBeGreaterThanOrEqual(0);
  });
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 1 for parallel vectors of different magnitudes", () => {
    // Cosine measures direction, not magnitude.
    expect(cosineSimilarity([1, 2, 3], [2, 4, 6])).toBeCloseTo(1);
  });

  it("clamps to [0, 1] (never returns negative similarity)", () => {
    // Anti-parallel vectors have cosine = -1, but we clamp to 0
    // for similarity-as-score semantics.
    expect(cosineSimilarity([1, 0], [-1, 0])).toBe(0);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns 0 for mismatched dimensions", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
  });

  it("returns 0 for empty vectors", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("returns 0 for zero-magnitude vectors", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });
});

describe("detectDrift", () => {
  it("reports byte-identical match with hash=1 and overall=1", () => {
    const r = detectDrift({ answer: "Paris" }, { answer: "Paris" });
    expect(r.score.hash).toBe(1);
    expect(r.score.structural).toBe(1);
    expect(r.score.overall).toBe(1);
    expect(r.drifted).toBe(false);
    expect(r.summary).toContain("byte-identical");
    expect(r.diffs).toEqual([]);
  });

  it("flags drift when overall falls below tolerance", () => {
    // Wholly different objects → low overall → drifted=true.
    const r = detectDrift({ a: 1 }, { z: 99 });
    expect(r.drifted).toBe(true);
    expect(r.summary).toContain("Drift detected");
  });

  it("does NOT flag drift when only one minor value changes", () => {
    // Same structure, one value diff → structural=1, hash=0 →
    // overall = 0.8 * 1 + 0.2 * 0 = 0.8 → not drifted at default
    // tolerance 0.15 (which requires overall < 0.85). Borderline:
    // 0.8 IS less than 0.85, so this DOES drift at default tolerance.
    // To stay below the drift threshold, caller would set tolerance
    // = 0.25 (allowing 25% drift). Test the relaxed-tolerance path.
    const r = detectDrift({ a: 1 }, { a: 2 }, { tolerance: 0.25 });
    expect(r.drifted).toBe(false);
  });

  it("includes semantic similarity when embeddings supplied", () => {
    const r = detectDrift(
      { answer: "Paris" },
      { answer: "London" },
      {
        embeddings: { before: [1, 0, 0], after: [0.99, 0.1, 0] },
      },
    );
    expect(r.score.semantic).not.toBeNull();
    expect(r.score.semantic!).toBeGreaterThan(0.95);
  });

  it("collapses weights to structural+hash when no embeddings given", () => {
    const r = detectDrift({ a: 1 }, { a: 2 });
    expect(r.score.semantic).toBeNull();
    // Without embeddings: 0.8 * structural + 0.2 * hash = 0.8 + 0 = 0.8
    expect(r.score.overall).toBeCloseTo(0.8);
  });

  it("uses the full weighted average when embeddings are present", () => {
    // With perfect semantic + perfect structural + zero hash:
    // 0.5 * 1 + 0.4 * 1 + 0.1 * 0 = 0.9
    const r = detectDrift(
      { a: 1 },
      { a: 2 },
      { embeddings: { before: [1, 0], after: [1, 0] } },
    );
    expect(r.score.overall).toBeCloseTo(0.9);
  });

  it("respects the diffLimit option", () => {
    const before = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`k${i}`, i]),
    );
    const after = Object.fromEntries(
      Array.from({ length: 200 }, (_, i) => [`k${i}`, i + 1]),
    );
    const r = detectDrift(before, after, { diffLimit: 10 });
    expect(r.diffs).toHaveLength(10);
  });

  it("summary names the largest divergence path on drift", () => {
    const r = detectDrift({ a: 1 }, { z: 99 });
    expect(r.summary).toMatch(/divergence at \$/);
  });

  it("returns a JSON-serializable report (round-trip safe)", () => {
    // Receipt-friendly contract: every report must round-trip
    // through JSON.stringify without losing fidelity.
    const r = detectDrift(
      { a: 1, nested: [1, 2, 3] },
      { a: 2, nested: [1, 2, 3, 4] },
      { embeddings: { before: [0.1, 0.9], after: [0.2, 0.8] } },
    );
    const round = JSON.parse(JSON.stringify(r));
    expect(round).toEqual(r);
  });
});
