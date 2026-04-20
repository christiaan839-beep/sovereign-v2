/**
 * Tests for src/lib/csv.ts — CSV export helpers.
 *
 * csvEscape is security-sensitive (OWASP CSV formula injection).
 * Every mitigation that was in the original inline copies should
 * survive the move to the shared lib.
 */
import { describe, it, expect } from "vitest";

import { csvEscape, safeRefDomain } from "@/lib/csv";

describe("csvEscape", () => {
  it("returns empty string for null/undefined", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("passes plain text through unchanged", () => {
    expect(csvEscape("hello")).toBe("hello");
    expect(csvEscape("123")).toBe("123");
  });

  it("wraps values containing commas in quotes (RFC 4180)", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
  });

  it("doubles internal quotes and wraps the field (RFC 4180)", () => {
    expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""');
  });

  it("wraps values containing newlines or carriage returns", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
    // \r not in position 0 → just RFC 4180 wrapping (formula guard is ^-anchored).
    expect(csvEscape("has\rCR")).toBe('"has\rCR"');
  });

  it("applies formula guard + wrapping when CR is the first char", () => {
    // Leading \r triggers formula guard (prepends \t), and the result
    // still contains \r so it also gets wrapped.
    expect(csvEscape("\rbad")).toBe('"\t\rbad"');
  });

  it("prefixes formula-injection payloads with a tab (OWASP)", () => {
    expect(csvEscape("=HYPERLINK(\"evil\",\"click\")")).toBe(
      '"\t=HYPERLINK(""evil"",""click"")"',
    );
    expect(csvEscape("+cmd|/c calc")).toBe("\t+cmd|/c calc");
    expect(csvEscape("-1+2")).toBe("\t-1+2");
    expect(csvEscape("@SUM(A1)")).toBe("\t@SUM(A1)");
  });

  it("does not treat = in the middle of a cell as formula (safe)", () => {
    expect(csvEscape("use x=5 here")).toBe("use x=5 here");
  });

  it("coerces numbers and other primitives to string first", () => {
    // @ts-expect-error — intentionally wrong type to prove runtime guard
    expect(csvEscape(42)).toBe("42");
  });
});

describe("safeRefDomain", () => {
  it("returns empty string for null/undefined/empty", () => {
    expect(safeRefDomain(null)).toBe("");
    expect(safeRefDomain(undefined)).toBe("");
    expect(safeRefDomain("")).toBe("");
  });

  it("extracts hostname and strips leading www", () => {
    expect(safeRefDomain("https://www.google.com/search?q=foo")).toBe("google.com");
    expect(safeRefDomain("https://example.com/")).toBe("example.com");
    expect(safeRefDomain("https://news.ycombinator.com/item?id=1")).toBe(
      "news.ycombinator.com",
    );
  });

  it("returns the raw string (truncated) on URL parse failure", () => {
    expect(safeRefDomain("not a url")).toBe("not a url");
    const long = "a".repeat(200);
    expect(safeRefDomain(long)).toBe("a".repeat(80));
  });
});
