/**
 * Tests for src/lib/replay-diff.ts — Wave 157.
 *
 * Pure-function tests pinning the deep-object differ + canonical
 * projection + token-similarity primitive. No I/O.
 */
import { describe, it, expect } from "vitest";

import {
  computeReplayDiff,
  canonicalProjection,
  canonicalHash,
  tokenSimilarity,
  summariseDiff,
} from "@/lib/replay-diff";

describe("canonicalProjection", () => {
  it("drops volatile keys at every level", () => {
    const r = canonicalProjection({
      kept: "x",
      _receipt: { id: "drop" },
      _model: "drop",
      duration_ms: 999,
      nested: { kept: "y", _receipt: "drop" },
    });
    expect(r).toEqual({
      kept: "x",
      nested: { kept: "y" },
    });
  });

  it("recurses through arrays", () => {
    const r = canonicalProjection([
      { kept: 1, _receipt: "drop" },
      { kept: 2, durationMs: 1234 },
    ]);
    expect(r).toEqual([{ kept: 1 }, { kept: 2 }]);
  });

  it("sorts object keys for stable JSON.stringify hashing", () => {
    const a = canonicalProjection({ z: 1, a: 2 });
    const b = canonicalProjection({ a: 2, z: 1 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe("canonicalHash", () => {
  it("is stable across calls on identical input", () => {
    expect(canonicalHash({ x: 1 })).toBe(canonicalHash({ x: 1 }));
  });
  it("ignores volatile keys", () => {
    expect(canonicalHash({ x: 1, _receipt: "a" })).toBe(
      canonicalHash({ x: 1, _receipt: "b" }),
    );
  });
  it("differs when meaningful content differs", () => {
    expect(canonicalHash({ x: 1 })).not.toBe(canonicalHash({ x: 2 }));
  });
  it("is key-order-independent (canonical sort)", () => {
    expect(canonicalHash({ a: 1, z: 2 })).toBe(canonicalHash({ z: 2, a: 1 }));
  });
});

describe("tokenSimilarity", () => {
  it("returns 1 for identical strings", () => {
    expect(tokenSimilarity("hello world", "hello world")).toBe(1);
  });
  it("returns 0 for one-empty-string", () => {
    expect(tokenSimilarity("hello", "")).toBe(0);
    expect(tokenSimilarity("", "hello")).toBe(0);
  });
  it("returns 1 for both empty", () => {
    expect(tokenSimilarity("", "")).toBe(1);
  });
  it("is high for paraphrases sharing keywords", () => {
    const sim = tokenSimilarity(
      "the quick brown fox jumps over the lazy dog",
      "quick brown foxes jumping over lazy dogs sometimes",
    );
    expect(sim).toBeGreaterThan(0.2);
  });
  it("is low for unrelated content", () => {
    const sim = tokenSimilarity(
      "Strategy memo about market expansion in Brazil quarter",
      "Pineapple recipes for summer barbeque parties seasonally",
    );
    expect(sim).toBeLessThan(0.2);
  });
});

describe("computeReplayDiff — identical inputs", () => {
  it("returns zero divergence + matching hashes", () => {
    const d = computeReplayDiff({ a: 1, b: "x" }, { a: 1, b: "x" });
    expect(d.divergence).toBe(0);
    expect(d.hashesMatch).toBe(true);
    expect(d.fields).toEqual([]);
  });

  it("treats volatile-only differences as identical", () => {
    const d = computeReplayDiff(
      { result: "ok", _receipt: { id: "a", signature: "sig-1" } },
      { result: "ok", _receipt: { id: "b", signature: "sig-2" } },
    );
    expect(d.divergence).toBe(0);
    expect(d.hashesMatch).toBe(true);
    expect(d.fields).toEqual([]);
    expect(d.volatileIgnored).toBeGreaterThan(0);
  });

  it("tolerates 1% number drift on relative-tolerance compares", () => {
    const d = computeReplayDiff({ score: 0.5 }, { score: 0.501 });
    expect(d.fields).toEqual([]);
  });

  it("flags > 1% number drift as mismatch", () => {
    const d = computeReplayDiff({ score: 0.5 }, { score: 0.6 });
    expect(d.fields.length).toBe(1);
    expect(d.fields[0].kind).toBe("value-mismatch");
  });
});

describe("computeReplayDiff — shape changes", () => {
  it("flags added keys", () => {
    const d = computeReplayDiff({ a: 1 }, { a: 1, b: 2 });
    const added = d.fields.find((f) => f.kind === "added");
    expect(added?.path).toBe("b");
    expect(added?.after).toBe(2);
  });

  it("flags removed keys", () => {
    const d = computeReplayDiff({ a: 1, b: 2 }, { a: 1 });
    const removed = d.fields.find((f) => f.kind === "removed");
    expect(removed?.path).toBe("b");
    expect(removed?.before).toBe(2);
  });

  it("walks nested objects with dot-path", () => {
    const d = computeReplayDiff(
      { inner: { left: "x" } },
      { inner: { right: "y" } },
    );
    const paths = d.fields.map((f) => f.path).sort();
    expect(paths).toContain("inner.left");
    expect(paths).toContain("inner.right");
  });

  it("walks arrays element-wise + flags length change", () => {
    const d = computeReplayDiff([1, 2], [1, 2, 3]);
    expect(d.fields.some((f) => f.path === ".length")).toBe(true);
    expect(d.fields.some((f) => f.kind === "added")).toBe(true);
  });
});

describe("computeReplayDiff — string fuzz", () => {
  it("treats high-similarity strings as identical (no mismatch)", () => {
    const a =
      "The competitor scan analyzed pricing tiers across customer segments evaluating positioning.";
    const b =
      "The competitor scan analyzed pricing tiers across customer segments evaluating positioning carefully.";
    const d = computeReplayDiff({ msg: a }, { msg: b });
    // One extra token → similarity ≥ 0.85
    expect(d.fields).toEqual([]);
  });

  it("flags low-similarity strings as mismatch with similarity score", () => {
    const a = "Acme is a SaaS startup with 12 employees and $2M ARR.";
    const b =
      "We recommend implementing a comprehensive marketing strategy across multiple channels.";
    const d = computeReplayDiff({ analysis: a }, { analysis: b });
    expect(d.fields.length).toBe(1);
    expect(d.fields[0].kind).toBe("value-mismatch");
    expect(d.fields[0].similarity).toBeLessThan(0.85);
  });

  it("truncates long string values in the diff output", () => {
    const long = "x".repeat(500);
    const other = "completely different text " + "y".repeat(500);
    const d = computeReplayDiff({ msg: long }, { msg: other });
    expect(typeof d.fields[0].before === "string").toBe(true);
    expect((d.fields[0].before as string).length).toBeLessThanOrEqual(201);
  });
});

describe("computeReplayDiff — caps + safety", () => {
  it("caps fields list at 200 even on huge mismatch trees", () => {
    const before: Record<string, number> = {};
    const after: Record<string, number> = {};
    for (let i = 0; i < 500; i++) {
      before[`k${i}`] = i;
      after[`k${i}`] = i + 100; // every key mismatched
    }
    const d = computeReplayDiff(before, after);
    expect(d.fields.length).toBeLessThanOrEqual(200);
  });

  it("respects MAX_NESTING depth (no infinite recursion)", () => {
    let deep: Record<string, unknown> = { v: 1 };
    for (let i = 0; i < 60; i++) deep = { v: 1, nested: deep };
    // Doesn't throw, doesn't hang
    expect(() => computeReplayDiff(deep, deep)).not.toThrow();
  });

  it("divergence is clamped to [0, 1]", () => {
    const d = computeReplayDiff({ a: 1, b: 2, c: 3 }, { a: 99, b: 98, c: 97 });
    expect(d.divergence).toBeGreaterThanOrEqual(0);
    expect(d.divergence).toBeLessThanOrEqual(1);
  });
});

describe("summariseDiff", () => {
  it("'identical' when hashes match", () => {
    expect(summariseDiff(computeReplayDiff({ a: 1 }, { a: 1 }))).toMatch(
      /Identical/,
    );
  });

  it("'volatile-only' when hashes differ but no field changes", () => {
    // Force this state with an artificially zero fields + mismatched hash
    const fake = {
      fields: [],
      divergence: 0,
      nodesCompared: 0,
      volatileIgnored: 0,
      originalHash: "abc",
      replayedHash: "def",
      hashesMatch: false,
    };
    expect(summariseDiff(fake)).toMatch(/volatile-only/);
  });

  it("'N fields differ' on real divergence", () => {
    const d = computeReplayDiff({ a: 1, b: 2 }, { a: 99, b: 98 });
    expect(summariseDiff(d)).toMatch(/fields differ/);
  });
});
