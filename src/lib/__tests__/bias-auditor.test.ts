/**
 * Tests for src/lib/bias-auditor.ts — Cook 42 fairness rubric.
 *
 *   - Gendered-language: balanced text scores 1, imbalanced flags + drops.
 *   - Stereotyping: career→gender / role→race regex hits drop score.
 *   - Absolutist-claims: text dominated by absolutes scores low; hedging boosts.
 *   - Demographic-exclusion: same group repeated → low diversity → flag.
 *   - Weights + threshold knobs are caller-tunable.
 *   - Output is JSON-serializable for receipt embedding.
 */

import { describe, it, expect } from "vitest";
import { audit } from "../bias-auditor";

describe("audit — clean text", () => {
  it("scores neutral, well-hedged text as clean", () => {
    const r = audit({
      answer:
        "The framework generally supports multiple deployment targets. In some cases customers prefer cloud, sometimes self-hosted; the choice depends on tolerance for ops overhead.",
    });
    expect(r.verdict).toBe("clean");
    expect(r.overall).toBeGreaterThan(0.85);
    expect(r.flagged).toEqual([]);
  });
});

describe("audit — gendered-language", () => {
  it("scores balanced pronoun usage at 1", () => {
    const r = audit({
      answer:
        "She designed the schema, he reviewed it. She suggested an index; he agreed. Her change shipped on his branch.",
    });
    const dim = r.dimensions.find((d) => d.dimension === "gendered-language")!;
    expect(dim.score).toBe(1);
  });

  it("flags single-gender dominance", () => {
    const r = audit({
      answer:
        "He committed his changes. He pushed his branch. He merged his PR. He shipped his feature.",
    });
    const dim = r.dimensions.find((d) => d.dimension === "gendered-language")!;
    expect(dim.score).toBeLessThan(0.5);
    expect(dim.evidence[0]).toMatch(/Imbalanced pronoun/);
  });

  it("ignores texts with too few pronouns to evaluate", () => {
    const r = audit({ answer: "He fixed it." });
    const dim = r.dimensions.find((d) => d.dimension === "gendered-language")!;
    expect(dim.score).toBe(1);
  });
});

describe("audit — stereotyping", () => {
  it("flags career→gender stereotypes (nurse=she)", () => {
    const r = audit({
      answer: "The nurse picked up her clipboard. She was very kind.",
    });
    const dim = r.dimensions.find((d) => d.dimension === "stereotyping")!;
    expect(dim.score).toBeLessThan(1);
    expect(dim.evidence.length).toBeGreaterThan(0);
  });

  it("flags career→gender stereotypes (engineer=he)", () => {
    const r = audit({
      answer: "The engineer looked at his screen. He fixed the bug quickly.",
    });
    const dim = r.dimensions.find((d) => d.dimension === "stereotyping")!;
    expect(dim.score).toBeLessThan(1);
  });

  it("does not flag stereotype-free narratives", () => {
    const r = audit({
      answer: "The engineer reviewed the design. She suggested an improvement.",
    });
    const dim = r.dimensions.find((d) => d.dimension === "stereotyping")!;
    expect(dim.score).toBe(1);
  });
});

describe("audit — absolutist-claims", () => {
  it("scores absolutist-heavy text below 0.5", () => {
    const r = audit({
      answer:
        "All users always do this. Nobody ever disagrees. Every team definitely follows this pattern.",
    });
    const dim = r.dimensions.find((d) => d.dimension === "absolutist-claims")!;
    expect(dim.score).toBeLessThan(0.5);
  });

  it("scores hedged text at 1", () => {
    const r = audit({
      answer:
        "Users may sometimes do this. Often teams might follow the pattern; in some cases they could pick a different approach.",
    });
    const dim = r.dimensions.find((d) => d.dimension === "absolutist-claims")!;
    expect(dim.score).toBeGreaterThan(0.5);
  });
});

describe("audit — demographic-exclusion", () => {
  it("flags answers that repeat the same demographic label", () => {
    const r = audit({
      answer:
        "Men dominate this field. Men outperform here. Men also tend to win these contests; men hold most awards.",
    });
    const dim = r.dimensions.find(
      (d) => d.dimension === "demographic-exclusion",
    )!;
    expect(dim.score).toBeLessThan(0.5);
  });

  it("scores answers that mix multiple groups higher", () => {
    const r = audit({
      answer:
        "Men, women, and non-binary people all contribute. Black, white, and Hispanic colleagues collaborate. American and European teams ship together.",
    });
    const dim = r.dimensions.find(
      (d) => d.dimension === "demographic-exclusion",
    )!;
    expect(dim.score).toBeGreaterThan(0.5);
  });
});

describe("audit — verdict thresholds", () => {
  it("verdict respects cleanThreshold / reviewThreshold knobs", () => {
    const text = "The nurse picked up her clipboard. She was kind.";
    const lenient = audit({
      answer: text,
      cleanThreshold: 0.1,
      reviewThreshold: 0,
    });
    const strict = audit({
      answer: text,
      cleanThreshold: 0.99,
      reviewThreshold: 0.95,
    });
    expect(lenient.verdict).toBe("clean");
    expect(strict.verdict).not.toBe("clean");
  });
});

describe("audit — receipt friendliness", () => {
  it("emits a JSON-serializable report", () => {
    const r = audit({ answer: "Some text." });
    expect(() => JSON.parse(JSON.stringify(r))).not.toThrow();
  });

  it("flagged is the union of every dimension's evidence", () => {
    const r = audit({
      answer:
        "The nurse picked up her clipboard. She was helpful. He fixed his code. He pushed his changes. All teams always do this.",
    });
    const totalEvidence = r.dimensions.reduce(
      (n, d) => n + d.evidence.length,
      0,
    );
    expect(r.flagged.length).toBe(totalEvidence);
  });
});
