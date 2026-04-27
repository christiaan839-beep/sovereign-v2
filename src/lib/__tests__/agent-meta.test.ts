import { describe, expect, it } from "vitest";
import { extractConfidence, extractTokenBudget } from "../agent-meta";

describe("extractConfidence — defensive narrowing of _meta.confidence", () => {
  it("returns the confidence object on a well-formed envelope", () => {
    const result = extractConfidence({
      success: true,
      _meta: {
        confidence: {
          score: 0.87,
          band: "high",
          recommendedAction: "Trust outright — high signal density, low ambiguity.",
        },
      },
    });
    expect(result).toEqual({
      score: 0.87,
      band: "high",
      recommendedAction: "Trust outright — high signal density, low ambiguity.",
    });
  });

  it("returns undefined when the value is null", () => {
    expect(extractConfidence(null)).toBeUndefined();
    expect(extractConfidence(undefined)).toBeUndefined();
  });

  it("returns undefined when the value is a primitive", () => {
    expect(extractConfidence("hello")).toBeUndefined();
    expect(extractConfidence(42)).toBeUndefined();
    expect(extractConfidence(true)).toBeUndefined();
  });

  it("returns undefined when _meta is missing", () => {
    expect(extractConfidence({ success: true })).toBeUndefined();
  });

  it("returns undefined when _meta is not an object", () => {
    expect(extractConfidence({ _meta: "garbage" })).toBeUndefined();
  });

  it("returns undefined when confidence is missing", () => {
    expect(extractConfidence({ _meta: {} })).toBeUndefined();
  });

  it("returns undefined when confidence has wrong shape (missing score)", () => {
    expect(
      extractConfidence({
        _meta: { confidence: { band: "high", recommendedAction: "..." } },
      }),
    ).toBeUndefined();
  });

  it("returns undefined when confidence has wrong shape (score is string)", () => {
    expect(
      extractConfidence({
        _meta: {
          confidence: { score: "0.87", band: "high", recommendedAction: "..." },
        },
      }),
    ).toBeUndefined();
  });

  it("rejects unknown band values — protects the UI from rendering an unknown style", () => {
    // The component has 4 colors; an unknown band would render unstyled.
    // Better to render nothing than something inconsistent.
    expect(
      extractConfidence({
        _meta: {
          confidence: {
            score: 0.5,
            band: "experimental",
            recommendedAction: "...",
          },
        },
      }),
    ).toBeUndefined();
  });

  it("accepts all four canonical band values", () => {
    const bands = ["high", "moderate", "review", "draft"] as const;
    for (const band of bands) {
      const result = extractConfidence({
        _meta: { confidence: { score: 0.5, band, recommendedAction: "..." } },
      });
      expect(result?.band).toBe(band);
    }
  });

  it("never throws — the surface that consumes this never crashes", () => {
    // The whole point of defensive extraction is that broken inputs
    // are silent at the data layer. The caller sees `undefined` and
    // renders nothing, instead of a stack trace at request time.
    const inputs = [
      Symbol("oops"),
      new Map(),
      new Set(),
      [1, 2, 3],
      Object.create(null),
      { _meta: 42 },
      { _meta: { confidence: 42 } },
      { _meta: { confidence: null } },
    ];
    for (const input of inputs) {
      expect(() => extractConfidence(input)).not.toThrow();
    }
  });
});

describe("extractTokenBudget — defensive narrowing of _meta.tokenBudget", () => {
  it("returns the token-budget object on a well-formed envelope", () => {
    const result = extractTokenBudget({
      _meta: {
        tokenBudget: {
          pctUsed: 42,
          softWarning: false,
          limit: 100_000,
          model: "claude-3-5-sonnet",
          plan: "growth",
        },
      },
    });
    expect(result).toEqual({
      pctUsed: 42,
      softWarning: false,
      limit: 100_000,
      model: "claude-3-5-sonnet",
      plan: "growth",
    });
  });

  it("returns undefined for null / undefined / primitives / missing meta", () => {
    expect(extractTokenBudget(null)).toBeUndefined();
    expect(extractTokenBudget(42)).toBeUndefined();
    expect(extractTokenBudget("hi")).toBeUndefined();
    expect(extractTokenBudget({})).toBeUndefined();
    expect(extractTokenBudget({ _meta: 42 })).toBeUndefined();
    expect(extractTokenBudget({ _meta: {} })).toBeUndefined();
  });

  it("normalizes fractional pctUsed (0..1) to percentage (0..100)", () => {
    // Some internal code paths might emit pctUsed as a fraction (0.42)
    // while the meter contract is a percentage (42). The boundary
    // explicitly guards either form so the visual indicator never
    // shows a wildly wrong value.
    const result = extractTokenBudget({
      _meta: {
        tokenBudget: {
          pctUsed: 0.42,
          softWarning: false,
          limit: 100_000,
          model: "claude",
          plan: "free",
        },
      },
    });
    expect(result?.pctUsed).toBe(42);
  });

  it("preserves percentage values >1 unchanged", () => {
    const result = extractTokenBudget({
      _meta: {
        tokenBudget: {
          pctUsed: 87,
          softWarning: true,
          limit: 100_000,
          model: "claude",
          plan: "free",
        },
      },
    });
    expect(result?.pctUsed).toBe(87);
  });

  it("returns undefined when tokenBudget shape is wrong (missing model)", () => {
    expect(
      extractTokenBudget({
        _meta: { tokenBudget: { pctUsed: 42, softWarning: false, limit: 100, plan: "free" } },
      }),
    ).toBeUndefined();
  });

  it("coerces missing softWarning to false", () => {
    // softWarning is a soft alarm signal — when the upstream agent omits
    // it, treat as "no warning" rather than failing extraction. This is
    // forward-compat for older agents that don't compute the field yet.
    const result = extractTokenBudget({
      _meta: {
        tokenBudget: {
          pctUsed: 42,
          limit: 100,
          model: "claude",
          plan: "free",
        },
      },
    });
    expect(result?.softWarning).toBe(false);
  });

  it("never throws on hostile inputs", () => {
    const inputs = [
      Symbol("oops"),
      new Map(),
      [1, 2, 3],
      Object.create(null),
      { _meta: { tokenBudget: 42 } },
      { _meta: { tokenBudget: null } },
    ];
    for (const input of inputs) {
      expect(() => extractTokenBudget(input)).not.toThrow();
    }
  });
});
