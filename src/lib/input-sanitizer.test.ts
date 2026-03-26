import { describe, it, expect } from "vitest";
import { sanitizeInput } from "./input-sanitizer";

describe("sanitizeInput", () => {
  it("strips HTML tags", () => {
    expect(sanitizeInput("<script>alert('xss')</script>Hello")).toBe("alert('xss')Hello");
    expect(sanitizeInput("<b>bold</b> text")).toBe("bold text");
    expect(sanitizeInput('<img src="x" onerror="evil()" />')).toBe("");
  });

  it("removes null bytes", () => {
    expect(sanitizeInput("hello\0world")).toBe("helloworld");
  });

  it("collapses excessive whitespace", () => {
    expect(sanitizeInput("hello     world")).toBe("hello world");
    expect(sanitizeInput("hello\t\t\tworld")).toBe("hello world");
  });

  it("preserves single newlines", () => {
    expect(sanitizeInput("line1\nline2")).toBe("line1\nline2");
  });

  it("collapses 3+ newlines to 2", () => {
    expect(sanitizeInput("line1\n\n\n\nline2")).toBe("line1\n\nline2");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeInput("  hello  ")).toBe("hello");
  });

  it("enforces character limit (50,000)", () => {
    const longInput = "a".repeat(60_000);
    const result = sanitizeInput(longInput);
    expect(result.length).toBe(50_000);
  });

  it("handles empty input", () => {
    expect(sanitizeInput("")).toBe("");
  });

  it("handles mixed dangerous content", () => {
    const input = '<script>bad</script>\0  excessive   spaces\n\n\n\nnewlines';
    const result = sanitizeInput(input);
    expect(result).toBe("bad excessive spaces\n\nnewlines");
  });
});
