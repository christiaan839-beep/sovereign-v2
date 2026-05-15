/**
 * Tests for src/lib/rag-rerank.ts — Cook 99.
 */

import { describe, it, expect, vi } from "vitest";
import { rerank } from "../rag-rerank";
import type { RetrievedMemory } from "../rag";

function mem(id: string, body: string, score: number): RetrievedMemory {
  return {
    memory: {
      id,
      tenantId: "t1",
      body,
      createdAt: Date.now(),
    },
    score,
    lexicalScore: score,
    semanticScore: -1,
    citationId: `m-${id}`,
  };
}

describe("rerank — empty input", () => {
  it("returns [] when no candidates", async () => {
    const r = await rerank({
      query: "x",
      candidates: [],
      scorer: async () => [],
    });
    expect(r).toEqual([]);
  });
});

describe("rerank — scoring", () => {
  it("blends rerank + original scores per weight", async () => {
    const candidates = [mem("a", "alpha", 0.4), mem("b", "bravo", 0.8)];
    const scorer = vi.fn().mockResolvedValue([0.95, 0.2]);
    const out = await rerank({
      query: "alpha",
      candidates,
      scorer,
      rerankWeight: 0.7,
    });
    // a: 0.7 × 0.95 + 0.3 × 0.4 = 0.785
    // b: 0.7 × 0.2 + 0.3 × 0.8 = 0.38
    expect(out[0].memory.memory.id).toBe("a");
    expect(out[0].finalScore).toBeCloseTo(0.785, 3);
  });

  it("clamps rerank weight to [0, 1]", async () => {
    const candidates = [mem("a", "x", 0.5)];
    // Negative weight should be clamped to 0 → originalScore wins.
    const out = await rerank({
      query: "x",
      candidates,
      scorer: async () => [1.0],
      rerankWeight: -1,
    });
    expect(out[0].finalScore).toBeCloseTo(0.5, 3);
  });

  it("respects topK", async () => {
    const candidates = [
      mem("a", "x", 0.5),
      mem("b", "y", 0.5),
      mem("c", "z", 0.5),
    ];
    const out = await rerank({
      query: "q",
      candidates,
      scorer: async () => [0.9, 0.5, 0.1],
      topK: 1,
    });
    expect(out.length).toBe(1);
    expect(out[0].memory.memory.id).toBe("a");
  });

  it("ties break by memory id for determinism", async () => {
    const candidates = [mem("z", "x", 0.5), mem("a", "x", 0.5)];
    const out = await rerank({
      query: "q",
      candidates,
      scorer: async () => [0.5, 0.5],
    });
    expect(out[0].memory.memory.id).toBe("a");
  });

  it("throws when scorer returns wrong length", async () => {
    await expect(
      rerank({
        query: "q",
        candidates: [mem("a", "x", 0.5)],
        scorer: async () => [],
      }),
    ).rejects.toThrow(/scores/);
  });
});

describe("rerank — scorer is called once with all candidates", () => {
  it("batches the candidate set", async () => {
    const scorer = vi.fn().mockResolvedValue([0.9, 0.8]);
    await rerank({
      query: "q",
      candidates: [mem("a", "x", 0.5), mem("b", "y", 0.5)],
      scorer,
    });
    expect(scorer).toHaveBeenCalledTimes(1);
    expect(scorer.mock.calls[0][1].length).toBe(2);
  });
});
