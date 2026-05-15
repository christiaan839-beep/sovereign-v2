/**
 * Tests for src/lib/prompt-cache.ts — Cook 102.
 */

import { describe, it, expect } from "vitest";
import { PromptLRU, hashKey } from "../prompt-cache";

describe("PromptLRU — basic", () => {
  it("rejects max <= 0", () => {
    expect(() => new PromptLRU({ max: 0 })).toThrow();
    expect(() => new PromptLRU({ max: -1 })).toThrow();
  });

  it("get returns undefined when key not set", () => {
    const c = new PromptLRU<string>({ max: 4 });
    expect(c.get("missing")).toBeUndefined();
    expect(c.stats().misses).toBe(1);
  });

  it("set + get round-trips", () => {
    const c = new PromptLRU<string>({ max: 4 });
    c.set("a", "alpha");
    expect(c.get("a")).toBe("alpha");
    expect(c.stats().hits).toBe(1);
  });
});

describe("PromptLRU — TTL", () => {
  it("expires entries after defaultTtlMs", () => {
    const c = new PromptLRU<string>({ max: 4, defaultTtlMs: 100 });
    c.set("a", "alpha", undefined, 1000);
    expect(c.get("a", 1050)).toBe("alpha");
    expect(c.get("a", 1200)).toBeUndefined();
  });

  it("supports per-set TTL override", () => {
    const c = new PromptLRU<string>({ max: 4, defaultTtlMs: 60_000 });
    c.set("a", "alpha", 10, 0);
    expect(c.get("a", 50)).toBeUndefined();
  });
});

describe("PromptLRU — eviction", () => {
  it("evicts the least-recently-used entry past max", () => {
    const c = new PromptLRU<string>({ max: 2 });
    c.set("a", "alpha");
    c.set("b", "bravo");
    c.set("c", "charlie");
    expect(c.has("a")).toBe(false);
    expect(c.has("b")).toBe(true);
    expect(c.has("c")).toBe(true);
    expect(c.stats().evictions).toBe(1);
  });

  it("touching a key moves it to most-recently-used", () => {
    const c = new PromptLRU<string>({ max: 2 });
    c.set("a", "alpha");
    c.set("b", "bravo");
    c.get("a"); // touch
    c.set("c", "charlie");
    expect(c.has("a")).toBe(true);
    expect(c.has("b")).toBe(false);
  });
});

describe("hashKey", () => {
  it("returns deterministic hash for strings", () => {
    expect(hashKey("hello")).toBe(hashKey("hello"));
    expect(hashKey("hello")).not.toBe(hashKey("world"));
  });

  it("returns deterministic hash for objects regardless of key order", () => {
    const a = hashKey({ a: 1, b: 2, c: 3 });
    const b = hashKey({ c: 3, a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it("differs across nested values", () => {
    const a = hashKey({ x: { y: 1 } });
    const b = hashKey({ x: { y: 2 } });
    expect(a).not.toBe(b);
  });
});
