/**
 * Tests for nim-embed — pure math + graceful no-key paths.
 *
 * NIM-network paths are integration-tested against a staging key.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  NIM_EMBEDDING_DIMS,
  NIM_EMBEDDING_MODEL,
  cosineSimilarity,
  embedMany,
  embedOne,
  rerank,
} from "../nim-embed";

describe("cosineSimilarity()", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 10);
    expect(cosineSimilarity([3, 4], [3, 4])).toBeCloseTo(1, 10);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    expect(cosineSimilarity([1, 0, 0], [0, 0, 1])).toBe(0);
  });

  it("returns -1 for anti-parallel vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 10);
  });

  it("is scale-invariant (length-normalised)", () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6]; // same direction, different magnitude
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 10);
  });

  it("returns 0 for empty or mismatched-length input (defensive)", () => {
    expect(cosineSimilarity([], [1, 2])).toBe(0);
    expect(cosineSimilarity([1, 2], [])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
  });

  it("returns 0 when either vector is all zeros", () => {
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
    expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0);
  });
});

describe("embedOne() / embedMany() — graceful no-key path", () => {
  const ORIG_NIM = process.env.NIM_API_KEY;
  const ORIG_NVIDIA = process.env.NVIDIA_API_KEY;
  beforeEach(() => {
    delete process.env.NIM_API_KEY;
    delete process.env.NVIDIA_API_KEY;
  });
  afterEach(() => {
    if (ORIG_NIM === undefined) delete process.env.NIM_API_KEY;
    else process.env.NIM_API_KEY = ORIG_NIM;
    if (ORIG_NVIDIA === undefined) delete process.env.NVIDIA_API_KEY;
    else process.env.NVIDIA_API_KEY = ORIG_NVIDIA;
  });

  it("embedOne returns null when no NIM key is present", async () => {
    expect(await embedOne("hello world")).toBeNull();
  });

  it("embedOne returns null for empty input", async () => {
    expect(await embedOne("")).toBeNull();
    expect(await embedOne("   ")).toBeNull();
  });

  it("embedMany returns an array of nulls the same length as input", async () => {
    const r = await embedMany(["a", "b", "c"]);
    expect(r).toEqual([null, null, null]);
  });

  it("embedMany returns [] for empty input (not an error)", async () => {
    expect(await embedMany([])).toEqual([]);
  });
});

describe("rerank() — graceful no-key path", () => {
  const ORIG = process.env.NIM_API_KEY;
  beforeEach(() => {
    delete process.env.NIM_API_KEY;
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.NIM_API_KEY;
    else process.env.NIM_API_KEY = ORIG;
  });

  it("returns [] when items is empty", async () => {
    const r = await rerank("q", [], (x: string) => x);
    expect(r).toEqual([]);
  });

  it("returns the original order with zero scores when NIM key is missing", async () => {
    const items = ["first", "second", "third"];
    const r = await rerank("query", items, (x) => x, 3);
    expect(r.map((x) => x.item)).toEqual(["first", "second", "third"]);
    for (const x of r) expect(x.score).toBe(0);
  });

  it("returns only one item (wrapped) when input has exactly one element", async () => {
    const r = await rerank("q", ["only"], (x) => x);
    expect(r).toHaveLength(1);
    expect(r[0].item).toBe("only");
  });

  it("respects topK when NIM is missing (takes the first N by original order)", async () => {
    const r = await rerank(
      "q",
      ["a", "b", "c", "d", "e"],
      (x) => x,
      3,
    );
    expect(r.map((x) => x.item)).toEqual(["a", "b", "c"]);
  });
});

describe("model-config constants", () => {
  it("uses the 1b-v2 embedder with 2048 dims (production config)", () => {
    expect(NIM_EMBEDDING_MODEL).toBe("nvidia/llama-3.2-nv-embedqa-1b-v2");
    expect(NIM_EMBEDDING_DIMS).toBe(2048);
  });
});
