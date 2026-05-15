/**
 * Tests for src/lib/response-cache.ts — Cook 129.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetForTests,
  deriveEtag,
  deriveKey,
  lookup,
  matchesEtag,
  put,
  stats,
} from "../response-cache";

const KEY = { url: "/agents", method: "GET", varyHeaders: {} };

beforeEach(() => {
  _resetForTests();
});

describe("deriveKey", () => {
  it("returns identical hash for the same url + method + vary", () => {
    expect(deriveKey(KEY)).toBe(deriveKey({ ...KEY }));
  });

  it("differs when vary headers differ", () => {
    expect(deriveKey({ ...KEY, varyHeaders: { tenant: "a" } })).not.toBe(
      deriveKey({ ...KEY, varyHeaders: { tenant: "b" } }),
    );
  });

  it("is case-insensitive on header names", () => {
    expect(deriveKey({ ...KEY, varyHeaders: { Tenant: "a" } })).toBe(
      deriveKey({ ...KEY, varyHeaders: { tenant: "a" } }),
    );
  });
});

describe("deriveEtag", () => {
  it("returns deterministic quoted-hex etag", () => {
    expect(deriveEtag("hello")).toBe(deriveEtag("hello"));
    expect(deriveEtag("hello").startsWith('"')).toBe(true);
  });
});

describe("put + lookup", () => {
  it("miss when nothing cached", () => {
    expect(lookup(KEY).kind).toBe("miss");
  });

  it("fresh within freshMs window", () => {
    put(KEY, {
      body: "[1,2,3]",
      status: 200,
      contentType: "application/json",
    });
    const r = lookup(KEY, {}, Date.now() + 10);
    expect(r.kind).toBe("fresh");
  });

  it("stale within stale-while-revalidate window", () => {
    put(KEY, { body: "x", status: 200, contentType: "text/plain" }, {}, 0);
    const r = lookup(KEY, { freshMs: 100, swrMs: 1000 }, 500);
    expect(r.kind).toBe("stale");
  });

  it("evicts past stale window → miss", () => {
    put(KEY, { body: "x", status: 200, contentType: "text/plain" }, {}, 0);
    const r = lookup(KEY, { freshMs: 100, swrMs: 100 }, 1_000_000);
    expect(r.kind).toBe("miss");
  });

  it("rejects bodies above maxBodyBytes", () => {
    const big = "x".repeat(300_000);
    const stored = put(
      KEY,
      { body: big, status: 200, contentType: "text/plain" },
      { maxBodyBytes: 100 },
    );
    expect(stored).toBeNull();
  });
});

describe("matchesEtag", () => {
  it("returns true when If-None-Match equals the cached etag", () => {
    const entry = put(KEY, {
      body: "x",
      status: 200,
      contentType: "text/plain",
    })!;
    expect(matchesEtag(KEY, entry.etag)).toBe(true);
  });

  it("returns false for a stale or wrong etag", () => {
    put(KEY, { body: "x", status: 200, contentType: "text/plain" });
    expect(matchesEtag(KEY, '"wrong"')).toBe(false);
    expect(matchesEtag(KEY, null)).toBe(false);
  });
});

describe("LRU eviction", () => {
  it("evicts the oldest entry past maxEntries", () => {
    for (let i = 0; i < 10; i++) {
      put(
        { url: `/${i}`, method: "GET", varyHeaders: {} },
        { body: `${i}`, status: 200, contentType: "text/plain" },
        { maxEntries: 5 },
      );
    }
    expect(stats().entries).toBe(5);
  });
});

describe("stats", () => {
  it("reports entry count + total bytes", () => {
    put(KEY, { body: "hello", status: 200, contentType: "text/plain" });
    const s = stats();
    expect(s.entries).toBe(1);
    expect(s.bytes).toBeGreaterThan(0);
  });
});
