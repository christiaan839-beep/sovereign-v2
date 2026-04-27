/**
 * safe-json — never-throw JSON helpers used across the codebase wherever
 * we read JSON-blob columns out of Postgres (settings.apiKeys/config,
 * subscriptions.metadata, etc.).
 *
 * The contract these tests enforce:
 *   - null/undefined/empty input → empty container (NOT a throw)
 *   - corrupt JSON → empty container + warning log (NOT a throw)
 *   - top-level value of the wrong shape (string/number/array/object) →
 *     empty container of the EXPECTED shape, not the wrong one
 *   - valid input → fresh, mutable copy (no aliasing surprise)
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { safeJsonParseObject, safeJsonParseArray } from "@/lib/safe-json";

describe("safeJsonParseObject", () => {
  it("returns {} for null", () => {
    expect(safeJsonParseObject(null)).toEqual({});
  });

  it("returns {} for undefined", () => {
    expect(safeJsonParseObject(undefined)).toEqual({});
  });

  it("returns {} for empty string", () => {
    expect(safeJsonParseObject("")).toEqual({});
  });

  it("returns {} for malformed JSON without throwing", () => {
    expect(() => safeJsonParseObject("{not valid")).not.toThrow();
    expect(safeJsonParseObject("{not valid")).toEqual({});
  });

  it("returns parsed object for valid JSON", () => {
    expect(safeJsonParseObject('{"a":1,"b":"two"}')).toEqual({ a: 1, b: "two" });
  });

  it("returns {} when top-level is an array (wrong shape)", () => {
    // The whole reason this exists: a corrupt blob that happens to be a
    // valid array would otherwise be spread into an object context and
    // cause subtle downstream bugs. Reject up front.
    expect(safeJsonParseObject('[1, 2, 3]')).toEqual({});
  });

  it("returns {} when top-level is null (`null` is valid JSON)", () => {
    expect(safeJsonParseObject('null')).toEqual({});
  });

  it("returns {} when top-level is a primitive", () => {
    expect(safeJsonParseObject('42')).toEqual({});
    expect(safeJsonParseObject('"a string"')).toEqual({});
    expect(safeJsonParseObject('true')).toEqual({});
  });

  it("returns a mutable copy — caller can spread/extend without aliasing", () => {
    const r1 = safeJsonParseObject<Record<string, unknown>>('{"a":1}');
    r1.b = 2;
    const r2 = safeJsonParseObject<Record<string, unknown>>('{"a":1}');
    // r2 should NOT see b — it's a fresh parse.
    expect(r2).toEqual({ a: 1 });
  });

  it("type parameter narrows correctly without runtime cost", () => {
    // Type intersected with Record<string, unknown> so the constraint
    // is satisfied. The narrowed shape gives type-safe access to known
    // fields while keeping the bag-of-unknowns elsewhere.
    type ApiKeys = { anthropic?: string; openai?: string } & Record<
      string,
      unknown
    >;
    const keys = safeJsonParseObject<ApiKeys>('{"anthropic":"sk-x"}');
    expect(keys.anthropic).toBe("sk-x");
    expect(keys.openai).toBeUndefined();
  });
});

describe("safeJsonParseArray", () => {
  it("returns [] for null/undefined/empty", () => {
    expect(safeJsonParseArray(null)).toEqual([]);
    expect(safeJsonParseArray(undefined)).toEqual([]);
    expect(safeJsonParseArray("")).toEqual([]);
  });

  it("returns [] for malformed JSON without throwing", () => {
    expect(() => safeJsonParseArray("[bad")).not.toThrow();
    expect(safeJsonParseArray("[bad")).toEqual([]);
  });

  it("returns parsed array for valid JSON", () => {
    expect(safeJsonParseArray<number>('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it("returns [] when top-level is an object (wrong shape)", () => {
    expect(safeJsonParseArray('{"a":1}')).toEqual([]);
  });

  it("returns [] when top-level is a primitive", () => {
    expect(safeJsonParseArray('42')).toEqual([]);
    expect(safeJsonParseArray('null')).toEqual([]);
  });
});
