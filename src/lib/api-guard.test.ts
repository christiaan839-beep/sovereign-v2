import { describe, it, expect } from "vitest";
import { sanitizeString, sanitizeNumber, sanitizeArray, validateRequired, checkRateLimit } from "./api-guard";

describe("sanitizeString", () => {
  it("trims and truncates strings", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
    expect(sanitizeString("a".repeat(3000), 100)).toBe("a".repeat(100));
  });

  it("returns empty string for non-strings", () => {
    expect(sanitizeString(null)).toBe("");
    expect(sanitizeString(undefined)).toBe("");
    expect(sanitizeString(123)).toBe("");
  });
});

describe("sanitizeNumber", () => {
  it("clamps to range", () => {
    expect(sanitizeNumber(50, 0, 100)).toBe(50);
    expect(sanitizeNumber(150, 0, 100)).toBe(100);
    expect(sanitizeNumber(-10, 0, 100)).toBe(0);
  });

  it("returns fallback for NaN", () => {
    expect(sanitizeNumber("abc", 0, 100, 42)).toBe(42);
    expect(sanitizeNumber(undefined, 0, 100, 0)).toBe(0);
  });
});

describe("sanitizeArray", () => {
  it("limits array size and sanitizes items", () => {
    const input = Array.from({ length: 30 }, (_, i) => `item-${i}`);
    const result = sanitizeArray(input, 5);
    expect(result).toHaveLength(5);
  });

  it("returns empty array for non-arrays", () => {
    expect(sanitizeArray(null)).toEqual([]);
    expect(sanitizeArray("string")).toEqual([]);
  });

  it("filters out empty strings", () => {
    expect(sanitizeArray(["hello", "", "world"])).toEqual(["hello", "world"]);
  });
});

describe("validateRequired", () => {
  it("returns null when all fields present", () => {
    expect(validateRequired({ name: "test", email: "a@b.c" }, ["name", "email"])).toBeNull();
  });

  it("returns error for missing fields", () => {
    expect(validateRequired({ name: "test" }, ["name", "email"])).toBe("Missing required field: email");
  });

  it("catches empty string as missing", () => {
    expect(validateRequired({ name: "" }, ["name"])).toBe("Missing required field: name");
  });
});

describe("checkRateLimit", () => {
  it("allows requests under limit", () => {
    const userId = `test-user-${Date.now()}`;
    const result = checkRateLimit(userId);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it("blocks after exceeding limit", () => {
    const userId = `flood-user-${Date.now()}`;
    for (let i = 0; i < 60; i++) {
      checkRateLimit(userId);
    }
    const result = checkRateLimit(userId);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
