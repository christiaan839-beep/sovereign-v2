/**
 * Tests for src/lib/admin-controls.ts — Wave 156.
 *
 * Pure-function tests over `normalizeAction` + `validateTtlExtension`.
 * DB-backed writers smoke-tested via the guard paths.
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

import {
  normalizeAction,
  validateTtlExtension,
  markSessionAbandoned,
  markSessionFailed,
  extendSessionTtl,
} from "@/lib/admin-controls";

describe("normalizeAction", () => {
  it("returns null on null / undefined / empty", () => {
    expect(normalizeAction(null)).toBeNull();
    expect(normalizeAction(undefined)).toBeNull();
    expect(normalizeAction("")).toBeNull();
  });

  it("normalizes case + whitespace", () => {
    expect(normalizeAction("ABANDON")).toBe("abandon");
    expect(normalizeAction("  fail  ")).toBe("fail");
    expect(normalizeAction("Extend")).toBe("extend");
  });

  it("returns null for unknown actions", () => {
    expect(normalizeAction("kill")).toBeNull();
    expect(normalizeAction("delete")).toBeNull();
    expect(normalizeAction("drop-table")).toBeNull();
  });

  it("accepts every valid action", () => {
    expect(normalizeAction("abandon")).toBe("abandon");
    expect(normalizeAction("fail")).toBe("fail");
    expect(normalizeAction("extend")).toBe("extend");
  });
});

describe("validateTtlExtension", () => {
  it("returns null on non-numeric", () => {
    expect(validateTtlExtension(NaN)).toBeNull();
    expect(validateTtlExtension(Infinity)).toBeNull();
  });

  it("returns null below minimum (1)", () => {
    expect(validateTtlExtension(0)).toBeNull();
    expect(validateTtlExtension(-5)).toBeNull();
  });

  it("returns null above maximum (720 = 12h)", () => {
    expect(validateTtlExtension(721)).toBeNull();
    expect(validateTtlExtension(99999)).toBeNull();
  });

  it("returns the floored integer for valid input", () => {
    expect(validateTtlExtension(1)).toBe(1);
    expect(validateTtlExtension(60)).toBe(60);
    expect(validateTtlExtension(720)).toBe(720);
    expect(validateTtlExtension(15.7)).toBe(15);
  });
});

describe("markSessionAbandoned — guard paths", () => {
  it("returns ok=false on missing sessionId", async () => {
    const r = await markSessionAbandoned("", "user-1");
    expect(r.ok).toBe(false);
    expect(r.affected).toBe(0);
    expect(r.error).toMatch(/required/);
  });

  it("returns ok=false on missing userId", async () => {
    const r = await markSessionAbandoned("sess-1", "");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/required/);
  });
});

describe("markSessionFailed — guard paths", () => {
  it("returns ok=false on missing sessionId", async () => {
    const r = await markSessionFailed("", "user-1", "reason");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/required/);
  });
});

describe("extendSessionTtl — bounds enforcement", () => {
  it("returns ok=false when addMinutes is out of range", async () => {
    const tooBig = await extendSessionTtl("s", "u", 9999);
    expect(tooBig.ok).toBe(false);
    expect(tooBig.error).toMatch(/1\.\.720/);

    const tooSmall = await extendSessionTtl("s", "u", 0);
    expect(tooSmall.ok).toBe(false);

    const nonNumber = await extendSessionTtl("s", "u", NaN);
    expect(nonNumber.ok).toBe(false);
  });

  it("returns ok=false on missing sessionId even when minutes are valid", async () => {
    const r = await extendSessionTtl("", "u", 60);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/required/);
  });
});
