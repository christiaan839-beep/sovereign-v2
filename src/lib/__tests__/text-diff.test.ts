/**
 * Tests for text-diff — LCS correctness on small fixtures.
 */

import { describe, expect, it } from "vitest";
import { diffWords, similarity } from "../text-diff";

describe("diffWords()", () => {
  it("produces empty array for two empty inputs", () => {
    expect(diffWords("", "")).toEqual([]);
  });

  it("marks entirely-new content as add", () => {
    const r = diffWords("", "hello world");
    expect(r.length).toBe(1);
    expect(r[0].op).toBe("add");
    expect(r[0].text).toBe("hello world");
  });

  it("marks removed-only content as del", () => {
    const r = diffWords("hello world", "");
    expect(r.length).toBe(1);
    expect(r[0].op).toBe("del");
    expect(r[0].text).toBe("hello world");
  });

  it("identifies identical content as eq", () => {
    const r = diffWords("the quick brown fox", "the quick brown fox");
    expect(r.every((p) => p.op === "eq")).toBe(true);
    const joined = r.map((p) => p.text).join("");
    expect(joined).toBe("the quick brown fox");
  });

  it("finds a substitution at the middle of a sentence", () => {
    const r = diffWords("the quick brown fox", "the quick RED fox");
    // Must contain a del for "brown" and an add for "RED" among eqs.
    const ops = r.map((p) => p.op);
    expect(ops).toContain("del");
    expect(ops).toContain("add");
    expect(ops).toContain("eq");
    const addText = r.filter((p) => p.op === "add").map((p) => p.text).join("");
    const delText = r.filter((p) => p.op === "del").map((p) => p.text).join("");
    expect(addText).toContain("RED");
    expect(delText).toContain("brown");
  });

  it("coalesces adjacent same-op runs", () => {
    const r = diffWords("a b c", "x y z a b c");
    // Expect a single 'add' run at the start and a single 'eq' run for " a b c".
    const adds = r.filter((p) => p.op === "add");
    expect(adds.length).toBe(1);
  });

  it("clamps super-long inputs to avoid blow-up", () => {
    const long = "word ".repeat(5000);
    const r = diffWords(long, long);
    // No error; produces a bounded output.
    expect(r.length).toBeGreaterThan(0);
    const total = r.reduce((n, p) => n + p.text.length, 0);
    expect(total).toBeLessThanOrEqual(10_000 + 100);
  });
});

describe("similarity()", () => {
  it("returns 1 for identical strings", () => {
    expect(similarity("hello world", "hello world")).toBe(1);
  });

  it("returns a low similarity for strings that share only whitespace", () => {
    // Whitespace tokens count as eq (they carry formatting info);
    // for all-different words separated by spaces that's ~25–35%.
    expect(similarity("foo bar baz", "xyz qrs tuv")).toBeLessThan(0.4);
  });

  it("returns ~0 for strings with truly zero overlap (no whitespace in common)", () => {
    expect(similarity("foobarbaz", "xyzqrstuv")).toBeLessThan(0.05);
  });

  it("is between 0 and 1 for partial overlap", () => {
    const s = similarity(
      "the quick brown fox jumps",
      "the quick red fox runs",
    );
    expect(s).toBeGreaterThan(0.3);
    expect(s).toBeLessThan(1);
  });

  it("returns 0 for two empty strings (avoid divide-by-zero)", () => {
    expect(similarity("", "")).toBe(0);
  });
});
