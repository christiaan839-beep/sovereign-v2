/**
 * Tests for src/lib/input-sanitizer.ts — pre-LLM input hygiene
 *
 * Runs on every user prompt before it reaches a model. Bugs here have
 * wide blast radius: too aggressive = valid input gets mangled, too loose
 * = HTML/null-bytes/size-bombs leak into prompts.
 */
import { describe, it, expect } from "vitest";
import { sanitizeInput } from "@/lib/input-sanitizer";

describe("sanitizeInput", () => {
  describe("HTML stripping", () => {
    it("removes simple tags", () => {
      expect(sanitizeInput("<p>hello</p>")).toBe("hello");
      expect(sanitizeInput("<div>world</div>")).toBe("world");
    });

    it("removes tags with attributes", () => {
      expect(sanitizeInput('<a href="evil.com">click</a>')).toBe("click");
      expect(sanitizeInput('<img src="x.png" alt="y" />')).toBe("");
    });

    it("removes self-closing tags", () => {
      expect(sanitizeInput("line1<br/>line2")).toBe("line1line2");
      expect(sanitizeInput("a<br />b")).toBe("ab");
    });

    it("removes script tags and preserves the gap between pieces", () => {
      // The regex strips tags but leaves text content — this is intentional
      // (no content-stripping, just de-HTML-ification)
      const result = sanitizeInput("before<script>alert(1)</script>after");
      expect(result).toBe("beforealert(1)after");
      // Critical: no angle brackets remain
      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
    });

    it("removes nested tags fully", () => {
      expect(sanitizeInput("<div><span>x</span></div>")).toBe("x");
    });

    it("preserves content that looks like tags but isn't (math expressions)", () => {
      // "<3" and "3>" aren't real tags since the regex requires [a-zA-Z]
      // after the opening bracket
      const result = sanitizeInput("I <3 math and 2 > 1");
      expect(result).toContain("<3");
      expect(result).toContain("> 1");
    });
  });

  describe("null-byte removal", () => {
    it("strips literal null bytes", () => {
      expect(sanitizeInput("hello\0world")).toBe("helloworld");
    });

    it("strips multiple null bytes", () => {
      expect(sanitizeInput("\0\0\0text\0\0")).toBe("text");
    });
  });

  describe("whitespace normalization", () => {
    it("collapses runs of spaces into one", () => {
      expect(sanitizeInput("hello    world")).toBe("hello world");
    });

    it("collapses tab runs", () => {
      expect(sanitizeInput("a\t\t\tb")).toBe("a b");
    });

    it("collapses mixed space/tab runs", () => {
      expect(sanitizeInput("a \t \t b")).toBe("a b");
    });

    it("preserves single spaces", () => {
      expect(sanitizeInput("the quick brown fox")).toBe("the quick brown fox");
    });

    it("collapses 3+ newlines to 2 (paragraph boundary)", () => {
      expect(sanitizeInput("para1\n\n\n\n\npara2")).toBe("para1\n\npara2");
    });

    it("preserves double newlines (intentional paragraph break)", () => {
      expect(sanitizeInput("para1\n\npara2")).toBe("para1\n\npara2");
    });

    it("preserves single newlines (line breaks)", () => {
      expect(sanitizeInput("line1\nline2")).toBe("line1\nline2");
    });
  });

  describe("trim", () => {
    it("strips leading and trailing whitespace", () => {
      expect(sanitizeInput("   hello   ")).toBe("hello");
      expect(sanitizeInput("\n\nhi\n\n")).toBe("hi");
      expect(sanitizeInput("\t hello \t")).toBe("hello");
    });
  });

  describe("size limit", () => {
    it("truncates to 50,000 characters", () => {
      const huge = "x".repeat(60_000);
      const result = sanitizeInput(huge);
      expect(result).toHaveLength(50_000);
    });

    it("passes content under the 50,000-char limit unchanged in length", () => {
      const ok = "y".repeat(49_999);
      const result = sanitizeInput(ok);
      expect(result).toHaveLength(49_999);
    });

    it("applies limit AFTER trimming/normalization (so a giant whitespace-only input becomes empty)", () => {
      // 60k spaces → trim to "" → well under limit
      expect(sanitizeInput(" ".repeat(60_000))).toBe("");
    });
  });

  describe("edge cases", () => {
    it("returns empty string for empty input", () => {
      expect(sanitizeInput("")).toBe("");
    });

    it("returns empty string for whitespace-only input", () => {
      expect(sanitizeInput("   \t\n  ")).toBe("");
    });

    it("preserves unicode", () => {
      expect(sanitizeInput("Sovereign ⚡ 主權 🚀")).toBe("Sovereign ⚡ 主權 🚀");
    });

    it("handles realistic prompt with HTML injection + extra whitespace", () => {
      const input = "  Please analyze this: <script>fetch('/steal')</script>    urgent!  ";
      const result = sanitizeInput(input);
      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
      expect(result.startsWith("Please")).toBe(true);
      expect(result.endsWith("urgent!")).toBe(true);
    });
  });
});
