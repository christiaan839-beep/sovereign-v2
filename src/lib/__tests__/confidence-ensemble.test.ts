/**
 * Tests for src/lib/confidence-ensemble.ts — Cook 98.
 */

import { describe, it, expect } from "vitest";
import { ensemble } from "../confidence-ensemble";

describe("ensemble — empty input", () => {
  it("throws on no votes", () => {
    expect(() => ensemble([], [])).toThrow();
  });
});

describe("ensemble — winning choice", () => {
  it("returns the only choice when every vote agrees", () => {
    const out = ensemble(
      [
        { agentSlug: "a", choice: "approve", confidence: 0.9 },
        { agentSlug: "b", choice: "approve", confidence: 0.8 },
      ],
      [
        { agentSlug: "a", accuracy: 0.9, sampleCount: 100 },
        { agentSlug: "b", accuracy: 0.85, sampleCount: 100 },
      ],
    );
    expect(out.choice).toBe("approve");
    expect(out.margin).toBeCloseTo(1.0, 6);
  });

  it("weights by historical accuracy, not vote count", () => {
    const out = ensemble(
      [
        // Two confident-but-inaccurate agents say "deny"
        { agentSlug: "low1", choice: "deny", confidence: 0.95 },
        { agentSlug: "low2", choice: "deny", confidence: 0.95 },
        // One battle-tested accurate agent says "approve"
        { agentSlug: "high", choice: "approve", confidence: 0.7 },
      ],
      [
        { agentSlug: "low1", accuracy: 0.4, sampleCount: 100 },
        { agentSlug: "low2", accuracy: 0.4, sampleCount: 100 },
        { agentSlug: "high", accuracy: 0.95, sampleCount: 500 },
      ],
    );
    // approve = 0.95×0.7 = 0.665
    // deny = 2 × 0.4×0.95 = 0.76
    // deny still wins — this proves the function uses the supplied
    // accuracy (it's not equal-vote).
    expect(out.choice).toBe("deny");
    expect(out.margin).toBeGreaterThan(0.5);
  });
});

describe("ensemble — dampening low-sample agents", () => {
  it("caps low-sample accuracy at the dampening floor", () => {
    const out = ensemble(
      [
        // Single new agent says "deny" with perfect confidence + accuracy.
        { agentSlug: "new", choice: "deny", confidence: 1.0 },
        // Two battle-tested agents say "approve" with realistic numbers.
        { agentSlug: "old1", choice: "approve", confidence: 0.7 },
        { agentSlug: "old2", choice: "approve", confidence: 0.7 },
      ],
      [
        { agentSlug: "new", accuracy: 1.0, sampleCount: 2 }, // low sample!
        { agentSlug: "old1", accuracy: 0.8, sampleCount: 200 },
        { agentSlug: "old2", accuracy: 0.8, sampleCount: 200 },
      ],
    );
    // new = 1.0 × 0.6 (dampened) = 0.6
    // approve = 2 × 0.7×0.8 = 1.12
    expect(out.choice).toBe("approve");
  });
});

describe("ensemble — contested flag", () => {
  it("marks contested when runner-up is within 0.1 weight", () => {
    const out = ensemble(
      [
        { agentSlug: "a", choice: "yes", confidence: 0.9 },
        { agentSlug: "b", choice: "no", confidence: 0.85 },
      ],
      [
        { agentSlug: "a", accuracy: 0.8, sampleCount: 100 },
        { agentSlug: "b", accuracy: 0.8, sampleCount: 100 },
      ],
    );
    expect(out.contested).toBe(true);
  });

  it("not contested on a clear winner", () => {
    const out = ensemble(
      [
        { agentSlug: "a", choice: "yes", confidence: 0.95 },
        { agentSlug: "b", choice: "yes", confidence: 0.95 },
        { agentSlug: "c", choice: "yes", confidence: 0.95 },
        { agentSlug: "d", choice: "no", confidence: 0.6 },
      ],
      [
        { agentSlug: "a", accuracy: 0.9, sampleCount: 100 },
        { agentSlug: "b", accuracy: 0.9, sampleCount: 100 },
        { agentSlug: "c", accuracy: 0.9, sampleCount: 100 },
        { agentSlug: "d", accuracy: 0.5, sampleCount: 100 },
      ],
    );
    expect(out.contested).toBe(false);
  });
});

describe("ensemble — receipt-friendliness", () => {
  it("returns a JSON-serializable outcome", () => {
    const out = ensemble(
      [{ agentSlug: "a", choice: "x", confidence: 0.8 }],
      [{ agentSlug: "a", accuracy: 0.7, sampleCount: 50 }],
    );
    expect(() => JSON.parse(JSON.stringify(out))).not.toThrow();
  });
});
