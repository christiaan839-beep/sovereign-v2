/**
 * Tests for src/lib/api-guard.ts — input sanitization + rate limiting
 *
 * Covers the pure helpers used at API boundaries. The Clerk-dependent
 * pieces (guardRoute) need a request context and are covered by
 * integration tests.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  sanitizeString,
  sanitizeNumber,
  sanitizeArray,
  validateRequired,
  checkRateLimit,
} from "@/lib/api-guard";

describe("sanitizeString", () => {
  it("trims whitespace", () => {
    expect(sanitizeString("  hello world  ")).toBe("hello world");
  });

  it("enforces maxLength", () => {
    const long = "x".repeat(3000);
    expect(sanitizeString(long, 100)).toHaveLength(100);
  });

  it("returns empty string for non-string input", () => {
    expect(sanitizeString(null)).toBe("");
    expect(sanitizeString(undefined)).toBe("");
    expect(sanitizeString(42)).toBe("");
    expect(sanitizeString({})).toBe("");
    expect(sanitizeString([])).toBe("");
    expect(sanitizeString(true)).toBe("");
  });

  it("defaults maxLength to 2000", () => {
    const long = "x".repeat(3000);
    expect(sanitizeString(long)).toHaveLength(2000);
  });

  it("preserves valid unicode", () => {
    expect(sanitizeString("Sovereign ⚡ 主權")).toBe("Sovereign ⚡ 主權");
  });

  it("handles empty string", () => {
    expect(sanitizeString("")).toBe("");
    expect(sanitizeString("   ")).toBe("");
  });
});

describe("sanitizeNumber", () => {
  it("clamps to min/max range", () => {
    expect(sanitizeNumber(5, 0, 10)).toBe(5);
    expect(sanitizeNumber(-5, 0, 10)).toBe(0);
    expect(sanitizeNumber(15, 0, 10)).toBe(10);
  });

  it("returns fallback for NaN", () => {
    expect(sanitizeNumber("abc", 0, 10, 7)).toBe(7);
    expect(sanitizeNumber(undefined, 0, 10, 7)).toBe(7);
    // objects convert to NaN via Number()
    expect(sanitizeNumber({}, 0, 10, 3)).toBe(3);
  });

  it("coerces numeric strings", () => {
    expect(sanitizeNumber("42", 0, 100)).toBe(42);
    expect(sanitizeNumber("3.14", 0, 100)).toBe(3.14);
  });

  it("uses sensible defaults (min=0, max=100, fallback=0)", () => {
    expect(sanitizeNumber(50)).toBe(50);
    expect(sanitizeNumber(-5)).toBe(0);
    expect(sanitizeNumber(200)).toBe(100);
    expect(sanitizeNumber("not a number")).toBe(0);
  });

  it("handles negative ranges", () => {
    expect(sanitizeNumber(-50, -100, -10)).toBe(-50);
    expect(sanitizeNumber(-200, -100, -10)).toBe(-100);
  });
});

describe("sanitizeArray", () => {
  it("returns empty array for non-array input", () => {
    expect(sanitizeArray(null)).toEqual([]);
    expect(sanitizeArray("string")).toEqual([]);
    expect(sanitizeArray({})).toEqual([]);
    expect(sanitizeArray(42)).toEqual([]);
  });

  it("enforces maxItems", () => {
    const items = Array.from({ length: 50 }, (_, i) => `item${i}`);
    expect(sanitizeArray(items, 10)).toHaveLength(10);
  });

  it("filters out empty strings", () => {
    expect(sanitizeArray(["a", "", "b", "   ", "c"])).toEqual(["a", "b", "c"]);
  });

  it("sanitizes each element as a string with 500-char limit", () => {
    const long = "x".repeat(600);
    const result = sanitizeArray([long, "short"]);
    expect(result[0]).toHaveLength(500);
    expect(result[1]).toBe("short");
  });

  it("coerces non-string elements to empty (filtered out)", () => {
    expect(sanitizeArray(["a", 42, null, "b", undefined, {}, "c"])).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("defaults maxItems to 20", () => {
    const items = Array.from({ length: 30 }, (_, i) => `item${i}`);
    expect(sanitizeArray(items)).toHaveLength(20);
  });
});

describe("validateRequired", () => {
  it("returns null when all fields are present and non-empty", () => {
    expect(
      validateRequired({ name: "Alice", email: "a@b.com" }, ["name", "email"]),
    ).toBeNull();
  });

  it("returns error message for missing field", () => {
    expect(validateRequired({ name: "Alice" }, ["name", "email"])).toBe(
      "Missing required field: email",
    );
  });

  it("treats undefined, null, and empty string as missing", () => {
    expect(validateRequired({ x: undefined }, ["x"])).toBe(
      "Missing required field: x",
    );
    expect(validateRequired({ x: null }, ["x"])).toBe(
      "Missing required field: x",
    );
    expect(validateRequired({ x: "" }, ["x"])).toBe(
      "Missing required field: x",
    );
  });

  it("treats 0 and false as present (only empty string/null/undefined are missing)", () => {
    expect(validateRequired({ count: 0 }, ["count"])).toBeNull();
    expect(validateRequired({ active: false }, ["active"])).toBeNull();
  });

  it("returns the FIRST missing field, not all of them", () => {
    expect(validateRequired({}, ["a", "b", "c"])).toBe(
      "Missing required field: a",
    );
  });

  it("handles empty required list", () => {
    expect(validateRequired({}, [])).toBeNull();
  });
});

describe("checkRateLimit", () => {
  // checkRateLimit keeps a module-level in-memory store, so tests use unique
  // userIds to avoid cross-test pollution. The function is async because it
  // optionally calls Upstash; tests run the in-memory fallback path (no
  // UPSTASH_REDIS_REST_URL configured).
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request and returns remaining=59 (60-1)", async () => {
    const result = await checkRateLimit(`user-first-${Math.random()}`);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
    expect(result.resetIn).toBeGreaterThan(0);
  });

  it("decrements remaining count across calls", async () => {
    const userId = `user-decrement-${Math.random()}`;
    const r1 = await checkRateLimit(userId);
    const r2 = await checkRateLimit(userId);
    const r3 = await checkRateLimit(userId);
    expect(r1.remaining).toBe(59);
    expect(r2.remaining).toBe(58);
    expect(r3.remaining).toBe(57);
    expect(r3.allowed).toBe(true);
  });

  it("blocks after 60 requests in a 60s window", async () => {
    const userId = `user-blocked-${Math.random()}`;
    for (let i = 0; i < 60; i++) {
      const result = await checkRateLimit(userId);
      expect(result.allowed).toBe(true);
    }
    const blocked = await checkRateLimit(userId);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("isolates state per userId", async () => {
    const userA = `user-iso-a-${Math.random()}`;
    const userB = `user-iso-b-${Math.random()}`;
    for (let i = 0; i < 60; i++) await checkRateLimit(userA);
    expect((await checkRateLimit(userA)).allowed).toBe(false);
    const b = await checkRateLimit(userB);
    expect(b.allowed).toBe(true);
    expect(b.remaining).toBe(59);
  });

  it("resets count after the window expires", async () => {
    vi.useFakeTimers();
    const userId = `user-reset-${Math.random()}`;
    for (let i = 0; i < 60; i++) await checkRateLimit(userId);
    expect((await checkRateLimit(userId)).allowed).toBe(false);

    vi.advanceTimersByTime(61_000);

    const fresh = await checkRateLimit(userId);
    expect(fresh.allowed).toBe(true);
    expect(fresh.remaining).toBe(59);
    vi.useRealTimers();
  });
});
