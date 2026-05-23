/**
 * Tests for src/lib/prompt-optimizer.ts — Wave 133.
 *
 * Covers the pure-function selector and the heuristic candidate
 * generator, plus the full compile() loop with stubbed runner/scorer.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  selectBestCandidate,
  defaultHeuristicGenerator,
  compilePrompt,
} from "@/lib/prompt-optimizer";

describe("selectBestCandidate", () => {
  it("returns null on empty input", () => {
    expect(selectBestCandidate([])).toBeNull();
  });

  it("picks the highest score", () => {
    const r = selectBestCandidate([
      { prompt: "a", score: 0.5, exampleScores: [0.5] },
      { prompt: "b", score: 0.9, exampleScores: [0.9] },
      { prompt: "c", score: 0.7, exampleScores: [0.7] },
    ]);
    expect(r?.prompt).toBe("b");
  });

  it("breaks ties toward the shorter prompt (Occam)", () => {
    const r = selectBestCandidate([
      { prompt: "longer prompt here", score: 0.8, exampleScores: [0.8] },
      { prompt: "short", score: 0.8, exampleScores: [0.8] },
    ]);
    expect(r?.prompt).toBe("short");
  });
});

describe("defaultHeuristicGenerator", () => {
  it("returns N candidate strings", async () => {
    const out = await defaultHeuristicGenerator("base prompt", [], 4);
    expect(out).toHaveLength(4);
    for (const c of out) {
      expect(c).toContain("base prompt");
    }
  });

  it("returns distinct variants", async () => {
    const out = await defaultHeuristicGenerator("seed", [], 3);
    const unique = new Set(out);
    expect(unique.size).toBe(3);
  });
});

describe("compilePrompt", () => {
  it("throws on empty eval set", async () => {
    await expect(
      compilePrompt({
        seedPrompt: "x",
        evalSet: [],
        runner: async () => "",
        scorer: async () => 0,
      }),
    ).rejects.toThrow(/empty eval set/i);
  });

  it("returns improved=false when no candidate beats the seed", async () => {
    const result = await compilePrompt({
      seedPrompt: "seed",
      evalSet: [{ input: "q1" }, { input: "q2" }],
      numCandidates: 3,
      runner: async (sys) => `answered ${sys.slice(0, 6)}`,
      scorer: async (out, _ex, sys) => (sys === "seed" ? 0.9 : 0.3),
    });
    expect(result.best.prompt).toBe("seed");
    expect(result.improved).toBe(false);
  });

  it("returns improved=true when a candidate wins", async () => {
    const result = await compilePrompt({
      seedPrompt: "seed",
      evalSet: [{ input: "q1" }, { input: "q2" }],
      numCandidates: 3,
      runner: async (sys) => `answered ${sys.slice(0, 6)}`,
      scorer: async (_out, _ex, sys) => (sys === "seed" ? 0.4 : 0.85),
    });
    expect(result.best.prompt).not.toBe("seed");
    expect(result.improved).toBe(true);
    expect(result.delta).toBeGreaterThan(0);
  });

  it("clamps per-example scores to [0,1]", async () => {
    const result = await compilePrompt({
      seedPrompt: "seed",
      evalSet: [{ input: "q1" }],
      numCandidates: 2,
      runner: async () => "x",
      scorer: async () => 1.5, // out of range
    });
    expect(result.best.exampleScores[0]).toBeLessThanOrEqual(1);
    expect(result.best.exampleScores[0]).toBeGreaterThanOrEqual(0);
  });

  it("treats runner exceptions as score 0 instead of throwing", async () => {
    const result = await compilePrompt({
      seedPrompt: "seed",
      evalSet: [{ input: "q1" }, { input: "q2" }],
      numCandidates: 2,
      runner: async () => {
        throw new Error("boom");
      },
      scorer: async () => 1.0,
    });
    expect(result.best.score).toBe(0);
  });

  it("includes seed as a candidate so the floor is the seed score", async () => {
    const result = await compilePrompt({
      seedPrompt: "seed",
      evalSet: [{ input: "q1" }],
      numCandidates: 3,
      runner: async () => "x",
      scorer: async (_o, _e, sys) => (sys === "seed" ? 0.9 : 0.1),
    });
    expect(result.best.prompt).toBe("seed");
    expect(result.seedScore).toBe(0.9);
  });
});
