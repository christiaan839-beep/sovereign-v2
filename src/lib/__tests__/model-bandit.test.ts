/**
 * Tests for src/lib/model-bandit.ts — Wave 139.
 *
 * Pure-function tests over `pickArm`, `updateArm`, `betaSample`,
 * `explorationGap`. No DB. Sampler is deterministic via injected RNG.
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
  pickArm,
  updateArm,
  betaSample,
  explorationGap,
  type BanditArm,
} from "@/lib/model-bandit";

/** Deterministic LCG so tests are reproducible. */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

describe("betaSample", () => {
  it("returns a value in [0, 1]", () => {
    const rng = seededRng(42);
    for (let i = 0; i < 100; i++) {
      const v = betaSample(2, 5, rng);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("mean of Beta(20, 5) samples is near 0.8", () => {
    const rng = seededRng(1);
    let sum = 0;
    const n = 400;
    for (let i = 0; i < n; i++) sum += betaSample(20, 5, rng);
    const mean = sum / n;
    expect(mean).toBeGreaterThan(0.7);
    expect(mean).toBeLessThan(0.9);
  });

  it("Beta(1, 1) is roughly uniform on [0, 1]", () => {
    const rng = seededRng(7);
    let sum = 0;
    const n = 400;
    for (let i = 0; i < n; i++) sum += betaSample(1, 1, rng);
    expect(sum / n).toBeGreaterThan(0.4);
    expect(sum / n).toBeLessThan(0.6);
  });
});

describe("pickArm", () => {
  it("returns null for empty arms", () => {
    expect(pickArm([])).toBeNull();
  });

  it("returns the single arm given one option", () => {
    const arms: BanditArm[] = [{ model: "only", alpha: 5, beta: 2 }];
    const r = pickArm(arms, seededRng(1));
    expect(r?.model).toBe("only");
  });

  it("prefers higher-mean arms in expectation", () => {
    const arms: BanditArm[] = [
      { model: "loser", alpha: 2, beta: 18 }, // mean ~0.10
      { model: "winner", alpha: 18, beta: 2 }, // mean ~0.90
    ];
    const counts = { loser: 0, winner: 0 };
    const rng = seededRng(123);
    for (let i = 0; i < 200; i++) {
      const pick = pickArm(arms, rng)!;
      counts[pick.model as "loser" | "winner"]++;
    }
    expect(counts.winner).toBeGreaterThan(counts.loser);
    expect(counts.winner).toBeGreaterThan(150);
  });

  it("returns posteriorMean alongside the sample", () => {
    const arms: BanditArm[] = [{ model: "a", alpha: 4, beta: 1 }];
    const r = pickArm(arms, seededRng(1));
    expect(r?.posteriorMean).toBeCloseTo(4 / 5, 5);
  });

  it("clamps alpha/beta floor at 1 (cold-start safety)", () => {
    const arms: BanditArm[] = [{ model: "fresh", alpha: 0, beta: 0 }];
    const r = pickArm(arms, seededRng(1));
    expect(r?.model).toBe("fresh");
    expect(Number.isFinite(r?.sampledValue ?? NaN)).toBe(true);
  });
});

describe("updateArm", () => {
  it("increments alpha on positive outcome", () => {
    const arm: BanditArm = { model: "x", alpha: 3, beta: 2 };
    const next = updateArm(arm, true);
    expect(next.alpha).toBe(4);
    expect(next.beta).toBe(2);
  });

  it("increments beta on negative outcome", () => {
    const arm: BanditArm = { model: "x", alpha: 3, beta: 2 };
    const next = updateArm(arm, false);
    expect(next.alpha).toBe(3);
    expect(next.beta).toBe(3);
  });

  it("returns a new object, doesn't mutate input", () => {
    const arm: BanditArm = { model: "x", alpha: 3, beta: 2 };
    const next = updateArm(arm, true);
    expect(next).not.toBe(arm);
    expect(arm.alpha).toBe(3);
  });
});

describe("explorationGap", () => {
  it("returns 1 for zero-sample arms", () => {
    expect(explorationGap({ model: "x", alpha: 0, beta: 0 })).toBe(1);
  });

  it("falls as sample size grows", () => {
    const small = explorationGap({ model: "x", alpha: 5, beta: 5 });
    const large = explorationGap({ model: "x", alpha: 500, beta: 500 });
    expect(large).toBeLessThan(small);
  });

  it("is zero in the degenerate case of p=0 or p=1", () => {
    const allWins = explorationGap({ model: "x", alpha: 100, beta: 0 });
    expect(allWins).toBeCloseTo(0, 3);
  });
});

describe("integration — convergence", () => {
  it("3-arm bandit prefers the best arm after enough samples", () => {
    // Simulated true win rates: arm A = 0.3, B = 0.5, C = 0.8
    const trueProbs: Record<string, number> = {
      A: 0.3,
      B: 0.5,
      C: 0.8,
    };
    const arms: BanditArm[] = [
      { model: "A", alpha: 1, beta: 1 },
      { model: "B", alpha: 1, beta: 1 },
      { model: "C", alpha: 1, beta: 1 },
    ];
    const rng = seededRng(99);
    const picks: Record<string, number> = { A: 0, B: 0, C: 0 };
    for (let i = 0; i < 600; i++) {
      const pick = pickArm(arms, rng)!;
      picks[pick.model]++;
      const idx = arms.findIndex((a) => a.model === pick.model);
      const positive = rng() < trueProbs[pick.model];
      arms[idx] = updateArm(arms[idx], positive);
    }
    expect(picks.C).toBeGreaterThan(picks.A);
    expect(picks.C).toBeGreaterThan(picks.B);
    // Final posterior mean should be highest for C
    const cArm = arms.find((a) => a.model === "C")!;
    const cMean = cArm.alpha / (cArm.alpha + cArm.beta);
    expect(cMean).toBeGreaterThan(0.7);
  });
});
