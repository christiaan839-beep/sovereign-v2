/**
 * Tests for src/lib/hallucination-detector.ts — Cook 41 verifier layer 6.
 *
 *   - splitSentences: handles `.`/`?`/`!` plus common abbreviations.
 *   - detect():
 *       - returns "grounded" when every claim is supported by overlap.
 *       - returns "hallucinated" when sources are empty / unrelated.
 *       - returns "partial" between thresholds.
 *       - explicit [m-N] citation counts as support.
 *       - cited but unknown sources are ignored (model hallucinated id).
 *       - short sentences (< minSentenceTokens) skip evaluation.
 *       - thresholds are caller-tunable.
 *   - result shape is JSON-serializable.
 */

import { describe, it, expect } from "vitest";
import { detect, splitSentences } from "../hallucination-detector";

describe("splitSentences", () => {
  it("splits on . ? ! while preserving sentence text", () => {
    const out = splitSentences("Hi there. How are you? Great!");
    expect(out).toEqual(["Hi there.", "How are you?", "Great!"]);
  });

  it("does not split on common abbreviations", () => {
    const out = splitSentences("Companies like Acme Inc. ship daily. Done.");
    expect(out.length).toBe(2);
    expect(out[0]).toContain("Inc.");
  });

  it("returns a single entry for unpunctuated text", () => {
    expect(splitSentences("just one chunk")).toEqual(["just one chunk"]);
  });

  it("returns [] for empty input", () => {
    expect(splitSentences("")).toEqual([]);
  });
});

describe("detect — grounded answers", () => {
  it("returns verdict=grounded when every claim overlaps a source", () => {
    const result = detect({
      answer: "Alpha bravo charlie delta. Echo foxtrot golf hotel india.",
      sources: [
        { id: "m-1", body: "alpha bravo charlie delta november" },
        { id: "m-2", body: "echo foxtrot golf hotel india juliet" },
      ],
    });
    expect(result.verdict).toBe("grounded");
    expect(result.score).toBeGreaterThan(0.9);
    expect(result.ungroundedSentences).toHaveLength(0);
  });

  it("counts an explicit citation as support even without overlap", () => {
    const result = detect({
      answer: "Per [m-1] the policy applies to all clients.",
      sources: [{ id: "m-1", body: "(unrelated content)" }],
    });
    expect(result.verdict).toBe("grounded");
    expect(result.citedSources).toEqual(["m-1"]);
  });
});

describe("detect — hallucinated answers", () => {
  it("returns verdict=hallucinated when sources are empty", () => {
    const result = detect({
      answer: "Some claim about the moon. Another claim about Mars.",
      sources: [],
    });
    expect(result.verdict).toBe("hallucinated");
    expect(result.score).toBe(0);
    expect(result.ungroundedSentences.length).toBeGreaterThan(0);
  });

  it("returns verdict=hallucinated when sources are unrelated", () => {
    const result = detect({
      answer: "Quantum entanglement explains the result here.",
      sources: [{ id: "m-1", body: "The fox jumps over the lazy dog." }],
    });
    expect(result.verdict).toBe("hallucinated");
  });

  it("drops citations the model hallucinated against unknown ids", () => {
    const result = detect({
      answer: "Per [m-99] this is the rule.",
      sources: [{ id: "m-1", body: "totally different content" }],
    });
    expect(result.citedSources).toEqual([]);
  });
});

describe("detect — partial verdict", () => {
  it("returns verdict=partial when some but not most sentences are grounded", () => {
    const result = detect({
      answer:
        "Alpha bravo charlie delta echo foxtrot. Random unsupported claim. Another random claim. Yet another. One more random.",
      sources: [{ id: "m-1", body: "alpha bravo charlie delta echo foxtrot" }],
    });
    // 1/5 sentences grounded → score = 0.2 → hallucinated, not partial.
    // Use 2/3 to land in partial range.
    const partial = detect({
      answer:
        "Alpha bravo charlie delta. Echo foxtrot golf hotel. Wholly unrelated claim about widgets.",
      sources: [
        { id: "m-1", body: "alpha bravo charlie delta" },
        { id: "m-2", body: "echo foxtrot golf hotel" },
      ],
    });
    expect(result.verdict).toBe("hallucinated");
    expect(partial.verdict).toBe("partial");
    expect(partial.score).toBeGreaterThanOrEqual(0.4);
    expect(partial.score).toBeLessThan(0.7);
  });
});

describe("detect — threshold knobs", () => {
  it("verdictThreshold is caller-tunable", () => {
    const lenient = detect({
      answer:
        "Alpha bravo charlie. Random unsupported claim. Another random claim.",
      sources: [{ id: "m-1", body: "alpha bravo charlie" }],
      verdictThreshold: 0.2,
    });
    expect(lenient.verdict).toBe("grounded");

    const strict = detect({
      answer:
        "Alpha bravo charlie. Random unsupported claim. Another random claim.",
      sources: [{ id: "m-1", body: "alpha bravo charlie" }],
      verdictThreshold: 0.9,
    });
    expect(strict.verdict).toBe("hallucinated");
  });

  it("overlapThreshold gates per-sentence support", () => {
    const lenient = detect({
      answer: "Alpha bravo charlie delta echo foxtrot golf hotel.",
      sources: [{ id: "m-1", body: "alpha bravo" }],
      overlapThreshold: 0.1,
    });
    expect(lenient.sentences[0].grounded).toBe(true);

    const strict = detect({
      answer: "Alpha bravo charlie delta echo foxtrot golf hotel.",
      sources: [{ id: "m-1", body: "alpha bravo" }],
      overlapThreshold: 0.9,
    });
    expect(strict.sentences[0].grounded).toBe(false);
  });
});

describe("detect — short sentences", () => {
  it("treats too-short sentences as auto-grounded (don't poison score)", () => {
    const result = detect({
      answer: "Yes. Alpha bravo charlie delta echo foxtrot golf.",
      sources: [{ id: "m-1", body: "alpha bravo charlie delta echo foxtrot" }],
    });
    expect(result.verdict).toBe("grounded");
    // First sentence is too short to evaluate.
    expect(result.sentences[0].grounded).toBe(true);
    expect(result.sentences[0].bestOverlap).toBe(0);
  });
});

describe("detect — result is receipt-friendly", () => {
  it("returns a JSON-serializable result", () => {
    const result = detect({
      answer: "Alpha bravo charlie. Another claim.",
      sources: [{ id: "m-1", body: "alpha bravo charlie" }],
    });
    expect(() => JSON.parse(JSON.stringify(result))).not.toThrow();
  });
});
