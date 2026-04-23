/**
 * Tests for IP rate limiting (api-guard extensions).
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetRateLimitStoreForTests,
  checkIpRateLimit,
  extractClientIp,
} from "../api-guard";

describe("extractClientIp()", () => {
  it("picks the first entry from x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(extractClientIp(h)).toBe("1.2.3.4");
  });

  it("trims whitespace around the first x-forwarded-for entry", () => {
    const h = new Headers({ "x-forwarded-for": "  9.9.9.9  ,  1.1.1.1" });
    expect(extractClientIp(h)).toBe("9.9.9.9");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const h = new Headers({ "x-real-ip": "10.10.10.10" });
    expect(extractClientIp(h)).toBe("10.10.10.10");
  });

  it("returns 'unknown' when no proxy headers are present", () => {
    const h = new Headers();
    expect(extractClientIp(h)).toBe("unknown");
  });
});

describe("checkIpRateLimit()", () => {
  beforeEach(() => _resetRateLimitStoreForTests());

  it("allows the first N requests", () => {
    for (let i = 1; i <= 3; i++) {
      const r = checkIpRateLimit("1.1.1.1", { bucket: "x", max: 3 });
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(3 - i);
    }
  });

  it("blocks on the (N+1)th request", () => {
    for (let i = 0; i < 3; i++) checkIpRateLimit("1.1.1.1", { bucket: "x", max: 3 });
    const r = checkIpRateLimit("1.1.1.1", { bucket: "x", max: 3 });
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.resetIn).toBeGreaterThan(0);
  });

  it("tracks different buckets independently", () => {
    for (let i = 0; i < 3; i++) checkIpRateLimit("1.1.1.1", { bucket: "a", max: 3 });
    const rBlocked = checkIpRateLimit("1.1.1.1", { bucket: "a", max: 3 });
    const rClean = checkIpRateLimit("1.1.1.1", { bucket: "b", max: 3 });
    expect(rBlocked.allowed).toBe(false);
    expect(rClean.allowed).toBe(true);
  });

  it("tracks different IPs independently within the same bucket", () => {
    for (let i = 0; i < 3; i++) checkIpRateLimit("1.1.1.1", { bucket: "x", max: 3 });
    const rBlocked = checkIpRateLimit("1.1.1.1", { bucket: "x", max: 3 });
    const rClean = checkIpRateLimit("2.2.2.2", { bucket: "x", max: 3 });
    expect(rBlocked.allowed).toBe(false);
    expect(rClean.allowed).toBe(true);
  });

  it("defaults to 10/hour when options are minimal", () => {
    for (let i = 1; i <= 10; i++) {
      const r = checkIpRateLimit("3.3.3.3", { bucket: "default" });
      expect(r.allowed).toBe(true);
    }
    const r = checkIpRateLimit("3.3.3.3", { bucket: "default" });
    expect(r.allowed).toBe(false);
  });
});
