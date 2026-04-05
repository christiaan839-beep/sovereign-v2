/**
 * Tests for src/lib/cache.ts — response cache
 *
 * Covers the deterministic stringifier (which was the source of a cache-key
 * collision bug) and the public cacheGet/cacheSet/getCacheStats surface.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("deterministicStringify", () => {
  it("serializes primitives correctly", async () => {
    const { deterministicStringify } = await import("@/lib/cache");
    expect(deterministicStringify("hello")).toBe('"hello"');
    expect(deterministicStringify(42)).toBe("42");
    expect(deterministicStringify(true)).toBe("true");
    expect(deterministicStringify(null)).toBe("null");
    expect(deterministicStringify(undefined)).toBe("null");
  });

  it("sorts top-level keys alphabetically", async () => {
    const { deterministicStringify } = await import("@/lib/cache");
    expect(deterministicStringify({ c: 3, a: 1, b: 2 })).toBe('{"a":1,"b":2,"c":3}');
  });

  it("sorts keys at every nesting level (fixes the original bug)", async () => {
    const { deterministicStringify } = await import("@/lib/cache");
    const a = deterministicStringify({ x: 1, y: 2, z: [3, { b: 2, a: 1 }] });
    const b = deterministicStringify({ z: [3, { a: 1, b: 2 }], y: 2, x: 1 });
    expect(a).toBe(b);
  });

  it("preserves nested content (does NOT strip nested keys — the original bug)", async () => {
    const { deterministicStringify } = await import("@/lib/cache");
    const p1 = deterministicStringify({ agent: "leads", data: { size: 10 } });
    const p2 = deterministicStringify({ agent: "leads", data: { size: 20 } });
    // The ORIGINAL impl using JSON.stringify(..., keysArray) collapsed
    // these both to {"agent":"leads","data":{}}, causing cache collisions
    expect(p1).not.toBe(p2);
    expect(p1).toContain("10");
    expect(p2).toContain("20");
  });

  it("preserves array element order (arrays are ordered)", async () => {
    const { deterministicStringify } = await import("@/lib/cache");
    expect(deterministicStringify([3, 1, 2])).toBe("[3,1,2]");
    // Different element order = different serialization
    expect(deterministicStringify([1, 2])).not.toBe(deterministicStringify([2, 1]));
  });

  it("handles empty objects and arrays", async () => {
    const { deterministicStringify } = await import("@/lib/cache");
    expect(deterministicStringify({})).toBe("{}");
    expect(deterministicStringify([])).toBe("[]");
  });

  it("handles deeply nested structures", async () => {
    const { deterministicStringify } = await import("@/lib/cache");
    const deep = { a: { b: { c: { d: [1, 2, { e: "x" }] } } } };
    expect(deterministicStringify(deep)).toBe(
      '{"a":{"b":{"c":{"d":[1,2,{"e":"x"}]}}}}'
    );
  });
});

describe("cacheGet / cacheSet", () => {
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    // Force memory mode
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    // Reset module so USE_UPSTASH re-evaluates
    vi.resetModules();
  });

  afterEach(() => {
    if (originalUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    vi.useRealTimers();
  });

  it("returns null for a cache miss", async () => {
    const { cacheGet } = await import("@/lib/cache");
    const result = await cacheGet("never-set", { key: "value" });
    expect(result).toBeNull();
  });

  it("roundtrips payloads: set then get returns the same value", async () => {
    const { cacheGet, cacheSet } = await import("@/lib/cache");
    const payload = { query: "SaaS companies", limit: 10 };
    const response = { results: [1, 2, 3], count: 3 };
    await cacheSet("leads", payload, response, 60);
    const got = await cacheGet("leads", payload);
    expect(got).toEqual(response);
  });

  it("isolates entries by agent name", async () => {
    const { cacheGet, cacheSet } = await import("@/lib/cache");
    const payload = { q: "test" };
    await cacheSet("agent-a", payload, { answer: "A" }, 60);
    await cacheSet("agent-b", payload, { answer: "B" }, 60);
    expect(await cacheGet("agent-a", payload)).toEqual({ answer: "A" });
    expect(await cacheGet("agent-b", payload)).toEqual({ answer: "B" });
  });

  it("distinguishes nested payloads that differ only in deep fields (no collision)", async () => {
    const { cacheGet, cacheSet } = await import("@/lib/cache");
    await cacheSet("agent", { data: { size: 10 } }, { response: "small" }, 60);
    await cacheSet("agent", { data: { size: 20 } }, { response: "large" }, 60);
    expect(await cacheGet("agent", { data: { size: 10 } })).toEqual({ response: "small" });
    expect(await cacheGet("agent", { data: { size: 20 } })).toEqual({ response: "large" });
  });

  it("treats key-order-different payloads as identical", async () => {
    const { cacheGet, cacheSet } = await import("@/lib/cache");
    await cacheSet("agent", { a: 1, b: 2 }, { answer: 42 }, 60);
    // Same keys, different order — should hit the same cache entry
    expect(await cacheGet("agent", { b: 2, a: 1 })).toEqual({ answer: 42 });
  });

  it("expires entries after TTL", async () => {
    vi.useFakeTimers();
    const { cacheGet, cacheSet } = await import("@/lib/cache");
    await cacheSet("agent", { q: "test" }, { answer: "hi" }, 10); // 10s TTL
    expect(await cacheGet("agent", { q: "test" })).toEqual({ answer: "hi" });

    // Advance past TTL
    vi.advanceTimersByTime(11_000);
    expect(await cacheGet("agent", { q: "test" })).toBeNull();
  });
});

describe("getCacheStats", () => {
  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.resetModules();
  });

  it("reports memory mode when Upstash is not configured", async () => {
    const { getCacheStats } = await import("@/lib/cache");
    const stats = getCacheStats();
    expect(stats.mode).toBe("memory");
    expect(stats.maxSize).toBe(500);
    expect(stats.entries).toBeGreaterThanOrEqual(0);
  });

  it("returns maxSize=500", async () => {
    const { getCacheStats } = await import("@/lib/cache");
    expect(getCacheStats().maxSize).toBe(500);
  });
});
