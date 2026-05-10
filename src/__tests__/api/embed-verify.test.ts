/**
 * Tests for /embed/verify.js — embeddable verified badge.
 *
 * Covers:
 *   - returns 200 + application/javascript content-type
 *   - JS body is non-empty IIFE
 *   - long-lived cacheable + immutable
 *   - X-Content-Type-Options nosniff
 *   - Open CORS for cross-origin script tag use
 *   - Reads expected data attributes (sanity check via string includes)
 */
import { describe, it, expect } from "vitest";

describe("GET /embed/verify.js", () => {
  it("returns 200 + application/javascript", async () => {
    const { GET } = await import("@/app/embed/verify.js/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/javascript/);
  });

  it("body is a non-empty IIFE", async () => {
    const { GET } = await import("@/app/embed/verify.js/route");
    const body = await (await GET()).text();
    expect(body.length).toBeGreaterThan(500);
    expect(body.startsWith("(function ()")).toBe(true);
  });

  it("sets long cache + immutable + nosniff + open CORS", async () => {
    const { GET } = await import("@/app/embed/verify.js/route");
    const res = await GET();
    expect(res.headers.get("cache-control")).toMatch(/max-age=86400/);
    expect(res.headers.get("cache-control")).toMatch(/immutable/);
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("reads data-receipt and data-receipt-id attributes", async () => {
    const { GET } = await import("@/app/embed/verify.js/route");
    const body = await (await GET()).text();
    expect(body).toContain("data-receipt");
    expect(body).toContain("data-receipt-id");
  });

  it("calls /api/agent-runs/<id> and /api/verify", async () => {
    const { GET } = await import("@/app/embed/verify.js/route");
    const body = await (await GET()).text();
    expect(body).toContain("/api/agent-runs/");
    expect(body).toContain("/api/verify");
  });
});
