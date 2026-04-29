/**
 * agent-credit-line — tests.
 *
 * Pure-function calculator: same inputs → same outputs.
 *
 * Covers:
 *   - Multiplier table is canonical and exhaustive
 *   - Every letter grade maps to the documented multiplier
 *   - effectiveDailyLimitCents = baseDailyLimitCents × multiplier
 *     (rounded to nearest cent)
 *   - Boundary: A+ at 5x, F at 0.25x, no_score_yet at 1x
 *   - Defense: throws on negative base limit
 *   - Defense: throws on out-of-range numeric score
 *   - Verifier catches mismatches (the trustless-loop invariant)
 *   - Framing strings are non-empty for every grade
 */

import { describe, it, expect } from "vitest";
import {
  computeCreditLine,
  multiplierForGrade,
  framingForGrade,
  verifyCreditLineIntegrity,
} from "../agent-credit-line";
import type { LetterGrade } from "../agent-reputation";

const ALL_GRADES: LetterGrade[] = [
  "A+",
  "A",
  "A-",
  "B+",
  "B",
  "B-",
  "C+",
  "C",
  "C-",
  "D",
  "F",
  "no_score_yet",
];

describe("multiplierForGrade — canonical table", () => {
  it("A+ gets 5.0x (max trust)", () => {
    expect(multiplierForGrade("A+")).toBe(5.0);
  });

  it("A gets 3.0x", () => {
    expect(multiplierForGrade("A")).toBe(3.0);
  });

  it("A- gets 2.0x", () => {
    expect(multiplierForGrade("A-")).toBe(2.0);
  });

  it("B+ gets 1.5x", () => {
    expect(multiplierForGrade("B+")).toBe(1.5);
  });

  it("B and B- get 1.0x (default base)", () => {
    expect(multiplierForGrade("B")).toBe(1.0);
    expect(multiplierForGrade("B-")).toBe(1.0);
  });

  it("C+ gets 0.85x", () => {
    expect(multiplierForGrade("C+")).toBe(0.85);
  });

  it("C gets 0.75x", () => {
    expect(multiplierForGrade("C")).toBe(0.75);
  });

  it("C- gets 0.65x", () => {
    expect(multiplierForGrade("C-")).toBe(0.65);
  });

  it("D gets 0.5x (heavily restricted)", () => {
    expect(multiplierForGrade("D")).toBe(0.5);
  });

  it("F gets 0.25x (probation)", () => {
    expect(multiplierForGrade("F")).toBe(0.25);
  });

  it("no_score_yet gets 1.0x (default, not penalized)", () => {
    expect(multiplierForGrade("no_score_yet")).toBe(1.0);
  });

  it("every grade has a defined multiplier (exhaustive)", () => {
    for (const g of ALL_GRADES) {
      expect(multiplierForGrade(g)).toBeGreaterThan(0);
      expect(multiplierForGrade(g)).toBeLessThanOrEqual(5.0);
    }
  });

  it("multipliers are monotonic non-decreasing across the grade spectrum (worst→best)", () => {
    const order: LetterGrade[] = [
      "F",
      "D",
      "C-",
      "C",
      "C+",
      "B-",
      "B",
      "B+",
      "A-",
      "A",
      "A+",
    ];
    for (let i = 1; i < order.length; i++) {
      expect(multiplierForGrade(order[i])).toBeGreaterThanOrEqual(
        multiplierForGrade(order[i - 1]),
      );
    }
  });
});

describe("framingForGrade — non-empty for every grade", () => {
  it("returns a non-empty string for every grade", () => {
    for (const g of ALL_GRADES) {
      const f = framingForGrade(g);
      expect(f.length).toBeGreaterThan(0);
    }
  });

  it("A+ framing references trusted/veteran/high autonomy", () => {
    expect(framingForGrade("A+").toLowerCase()).toMatch(/trusted|veteran|high/);
  });

  it("F framing references probation/minimal", () => {
    expect(framingForGrade("F").toLowerCase()).toMatch(/probation|minimal/);
  });
});

describe("computeCreditLine — math correctness", () => {
  it("A+ at $50 base → $250 effective (5x)", () => {
    const line = computeCreditLine({
      letterGrade: "A+",
      numericScore: 95,
      baseDailyLimitCents: 5000, // $50
    });
    expect(line.multiplier).toBe(5.0);
    expect(line.effectiveDailyLimitCents).toBe(25000); // $250
  });

  it("F at $50 base → $12.50 effective (0.25x)", () => {
    const line = computeCreditLine({
      letterGrade: "F",
      numericScore: 30,
      baseDailyLimitCents: 5000, // $50
    });
    expect(line.multiplier).toBe(0.25);
    expect(line.effectiveDailyLimitCents).toBe(1250); // $12.50
  });

  it("no_score_yet → 1.0x (no penalty for new agents)", () => {
    const line = computeCreditLine({
      letterGrade: "no_score_yet",
      numericScore: 0,
      baseDailyLimitCents: 5000,
    });
    expect(line.multiplier).toBe(1.0);
    expect(line.effectiveDailyLimitCents).toBe(5000);
  });

  it("B (default grade) → 1.0x at any base", () => {
    const bases = [0, 1000, 5000, 50000, 200000];
    for (const base of bases) {
      const line = computeCreditLine({
        letterGrade: "B",
        numericScore: 75,
        baseDailyLimitCents: base,
      });
      expect(line.multiplier).toBe(1.0);
      expect(line.effectiveDailyLimitCents).toBe(base);
    }
  });

  it("base of $0 → effective of $0 at any grade (0 × multiplier = 0)", () => {
    for (const g of ALL_GRADES) {
      const line = computeCreditLine({
        letterGrade: g,
        numericScore: 75,
        baseDailyLimitCents: 0,
      });
      expect(line.effectiveDailyLimitCents).toBe(0);
    }
  });

  it("rounding: 0.85x of $10.01 (1001 cents) = 850.85 cents → rounds to 851", () => {
    const line = computeCreditLine({
      letterGrade: "C+",
      numericScore: 65,
      baseDailyLimitCents: 1001,
    });
    expect(line.multiplier).toBe(0.85);
    expect(line.effectiveDailyLimitCents).toBe(851);
  });

  it("preserves all input fields in the output", () => {
    const line = computeCreditLine({
      letterGrade: "A",
      numericScore: 92,
      baseDailyLimitCents: 5000,
    });
    expect(line.letterGrade).toBe("A");
    expect(line.numericScore).toBe(92);
    expect(line.baseDailyLimitCents).toBe(5000);
    expect(line.framing).toBe(framingForGrade("A"));
  });

  it("enterprise tier ($2000 base) at A+ → $10,000 effective", () => {
    const line = computeCreditLine({
      letterGrade: "A+",
      numericScore: 98,
      baseDailyLimitCents: 200000,
    });
    expect(line.effectiveDailyLimitCents).toBe(1000000); // $10,000
  });
});

describe("computeCreditLine — defense in depth", () => {
  it("throws on negative base limit", () => {
    expect(() =>
      computeCreditLine({
        letterGrade: "A",
        numericScore: 90,
        baseDailyLimitCents: -1,
      }),
    ).toThrow(/baseDailyLimitCents must be >= 0/);
  });

  it("throws on numeric score below 0", () => {
    expect(() =>
      computeCreditLine({
        letterGrade: "F",
        numericScore: -1,
        baseDailyLimitCents: 5000,
      }),
    ).toThrow(/numericScore must be in/);
  });

  it("throws on numeric score above 100", () => {
    expect(() =>
      computeCreditLine({
        letterGrade: "A+",
        numericScore: 101,
        baseDailyLimitCents: 5000,
      }),
    ).toThrow(/numericScore must be in/);
  });

  it("accepts boundary score of 0", () => {
    expect(() =>
      computeCreditLine({
        letterGrade: "F",
        numericScore: 0,
        baseDailyLimitCents: 5000,
      }),
    ).not.toThrow();
  });

  it("accepts boundary score of 100", () => {
    expect(() =>
      computeCreditLine({
        letterGrade: "A+",
        numericScore: 100,
        baseDailyLimitCents: 5000,
      }),
    ).not.toThrow();
  });
});

describe("verifyCreditLineIntegrity — trustless-loop invariant", () => {
  it("returns valid:true when published matches recompute", () => {
    const result = verifyCreditLineIntegrity({
      publishedEffectiveDailyLimitCents: 25000,
      letterGrade: "A+",
      numericScore: 95,
      baseDailyLimitCents: 5000,
    });
    expect(result.valid).toBe(true);
  });

  it("catches platform fabricating a higher limit than reputation justifies", () => {
    // Platform claims $500 effective for a grade-F agent with $50 base.
    // Recompute: F → 0.25x → $12.50. That's a fraud signal.
    const result = verifyCreditLineIntegrity({
      publishedEffectiveDailyLimitCents: 50000, // $500 (lying)
      letterGrade: "F",
      numericScore: 30,
      baseDailyLimitCents: 5000, // $50
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("effective_limit_mismatch");
      expect(result.expected).toBe(1250); // $12.50
      expect(result.published).toBe(50000);
    }
  });

  it("catches platform fabricating a LOWER limit than reputation justifies", () => {
    // Platform claims $50 effective for a grade-A+ agent with $50 base.
    // Recompute: A+ → 5x → $250. Lower fabrication is also fraud.
    const result = verifyCreditLineIntegrity({
      publishedEffectiveDailyLimitCents: 5000, // $50 (lying low)
      letterGrade: "A+",
      numericScore: 98,
      baseDailyLimitCents: 5000,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.expected).toBe(25000); // $250
    }
  });

  it("matches the canonical computeCreditLine output for every grade", () => {
    for (const g of ALL_GRADES) {
      const computed = computeCreditLine({
        letterGrade: g,
        numericScore: 75,
        baseDailyLimitCents: 5000,
      });
      const verify = verifyCreditLineIntegrity({
        publishedEffectiveDailyLimitCents: computed.effectiveDailyLimitCents,
        letterGrade: g,
        numericScore: 75,
        baseDailyLimitCents: 5000,
      });
      expect(verify.valid).toBe(true);
    }
  });
});

describe("computeCreditLine — purity (same inputs → same outputs)", () => {
  it("repeatable across many calls", () => {
    const inputs = {
      letterGrade: "A" as const,
      numericScore: 92,
      baseDailyLimitCents: 5000,
    };
    const a = computeCreditLine(inputs);
    const b = computeCreditLine(inputs);
    const c = computeCreditLine(inputs);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it("does not mutate the input object", () => {
    const inputs = {
      letterGrade: "A+" as const,
      numericScore: 95,
      baseDailyLimitCents: 5000,
    };
    const snapshot = JSON.stringify(inputs);
    computeCreditLine(inputs);
    expect(JSON.stringify(inputs)).toBe(snapshot);
  });
});
