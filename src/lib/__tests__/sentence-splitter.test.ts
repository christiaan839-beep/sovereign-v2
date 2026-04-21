/**
 * sentence-splitter.ts — tests.
 *
 * Pure-function streaming module. Incrementally buffers LLM output
 * tokens and emits complete sentences as they form, so the TTS stage
 * can start synthesis BEFORE the LLM has finished generating.
 *
 * Critical edge cases: abbreviations ("Dr.", "e.g.") must NOT split,
 * and rapid-fire partial tokens must not double-emit or drop text.
 */

import { describe, it, expect } from "vitest";
import { SentenceBuffer } from "@/lib/sentence-splitter";

describe("SentenceBuffer.push", () => {
  it("emits nothing on partial input", () => {
    const b = new SentenceBuffer();
    expect(b.push("Hello")).toEqual([]);
    expect(b.push(" world")).toEqual([]);
  });

  it("emits a complete sentence on terminator + space", () => {
    const b = new SentenceBuffer();
    expect(b.push("Hello world. Next")).toEqual(["Hello world."]);
  });

  it("emits two sentences when both boundaries are present", () => {
    const b = new SentenceBuffer();
    const out = b.push("First sentence. Second sentence. Third");
    expect(out).toEqual(["First sentence.", "Second sentence."]);
  });

  it("handles ! and ? terminators", () => {
    const b = new SentenceBuffer();
    expect(b.push("Really? Yes! Good")).toEqual(["Really?", "Yes!"]);
  });

  it("does NOT split on 'Dr. Smith'", () => {
    const b = new SentenceBuffer();
    expect(b.push("Dr. Smith is here. He arrived")).toEqual(["Dr. Smith is here."]);
  });

  it("does NOT split on 'Mr.', 'Mrs.', 'Ms.'", () => {
    const b = new SentenceBuffer();
    expect(b.push("Mr. Smith saw Mrs. Jones and Ms. Lee. All greeted")).toEqual([
      "Mr. Smith saw Mrs. Jones and Ms. Lee.",
    ]);
  });

  it("does NOT split on 'e.g.' or 'i.e.'", () => {
    const b = new SentenceBuffer();
    expect(b.push("Examples, e.g. the first one. Then more")).toEqual([
      "Examples, e.g. the first one.",
    ]);
  });

  it("does NOT split on 'etc.' followed by more text", () => {
    const b = new SentenceBuffer();
    expect(b.push("Apples, oranges, etc. are fruit. Unlike")).toEqual([
      "Apples, oranges, etc. are fruit.",
    ]);
  });

  it("handles rapid-fire token arrivals correctly", () => {
    const b = new SentenceBuffer();
    let out: string[] = [];
    out = out.concat(b.push("Hel"));
    out = out.concat(b.push("lo"));
    out = out.concat(b.push(" world"));
    out = out.concat(b.push("."));
    out = out.concat(b.push(" "));
    out = out.concat(b.push("Next"));
    expect(out).toEqual(["Hello world."]);
  });

  it("handles the period-at-end-of-token pattern", () => {
    // When a token ends with ". " (period+space), we expect emit on next non-space push
    const b = new SentenceBuffer();
    expect(b.push("First.")).toEqual([]);          // no trailing space yet
    expect(b.push(" Second")).toEqual(["First."]); // space arrives, boundary clears
  });

  it("emits on terminator + newline", () => {
    const b = new SentenceBuffer();
    expect(b.push("Hello.\nWorld")).toEqual(["Hello."]);
  });

  it("does NOT emit on sentence fragment ending without whitespace", () => {
    const b = new SentenceBuffer();
    // "Foo." alone — could be abbreviation or end. Keep buffering.
    expect(b.push("Foo.")).toEqual([]);
  });

  it("preserves quotation marks around sentences", () => {
    const b = new SentenceBuffer();
    expect(b.push('He said "Hello." Then')).toEqual(['He said "Hello."']);
  });
});

describe("SentenceBuffer.flush", () => {
  it("returns empty array when buffer is empty", () => {
    const b = new SentenceBuffer();
    expect(b.flush()).toEqual([]);
  });

  it("returns the trailing fragment as a single emit", () => {
    const b = new SentenceBuffer();
    b.push("Hello");
    expect(b.flush()).toEqual(["Hello"]);
  });

  it("does NOT double-emit after push already emitted", () => {
    const b = new SentenceBuffer();
    expect(b.push("First. Second")).toEqual(["First."]);
    expect(b.flush()).toEqual(["Second"]);
  });

  it("flushes a trailing period-ended fragment (no space after)", () => {
    const b = new SentenceBuffer();
    b.push("Final.");
    // At flush time, the period-at-end IS a complete sentence — there's
    // no more text coming, so we emit it.
    expect(b.flush()).toEqual(["Final."]);
  });

  it("empties the buffer — second flush returns empty", () => {
    const b = new SentenceBuffer();
    b.push("Hello");
    expect(b.flush()).toEqual(["Hello"]);
    expect(b.flush()).toEqual([]);
  });
});

describe("SentenceBuffer.reset", () => {
  it("clears the buffer without emitting", () => {
    const b = new SentenceBuffer();
    b.push("unfinished");
    b.reset();
    expect(b.flush()).toEqual([]);
  });
});
