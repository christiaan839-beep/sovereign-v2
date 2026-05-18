/**
 * Tests for GET /.well-known/security.txt — RFC 9116 disclosure.
 *
 * Covers:
 *   - returns 200 with text/plain UTF-8
 *   - open CORS for crawlers
 *   - includes all RFC 9116 required + recommended fields
 *   - Expires field is in the future + ISO-8601 with Z suffix
 *   - cache header is conservative (24h)
 */
import { describe, it, expect } from "vitest";

async function load() {
  return await import("@/app/.well-known/security.txt/route");
}

describe("GET /.well-known/security.txt — RFC 9116", () => {
  it("returns 200 + text/plain UTF-8 + open CORS", async () => {
    const { GET } = await load();
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(res.headers.get("Content-Type")).toContain("utf-8");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("has 24h cache (rarely changes)", async () => {
    const { GET } = await load();
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toContain("max-age=86400");
  });

  it("includes RFC 9116 required Contact + Expires fields", async () => {
    const { GET } = await load();
    const res = await GET();
    const body = await res.text();
    // Contact field — must include at least one.
    expect(body).toMatch(/^Contact: /m);
    expect(body).toMatch(/^Contact: mailto:security@sovereignmatrix\.agency$/m);
    expect(body).toMatch(/^Expires: /m);
  });

  it("includes recommended Policy + Acknowledgments + Encryption fields", async () => {
    const { GET } = await load();
    const res = await GET();
    const body = await res.text();
    expect(body).toMatch(/^Policy: https?:\/\//m);
    expect(body).toMatch(/^Acknowledgments: https?:\/\//m);
    expect(body).toMatch(/^Encryption: https?:\/\//m);
    expect(body).toMatch(/^Canonical: https?:\/\//m);
    expect(body).toMatch(/^Preferred-Languages: /m);
  });

  it("Expires field is ISO-8601 with Z suffix and in the future", async () => {
    const { GET } = await load();
    const res = await GET();
    const body = await res.text();
    const match = body.match(/^Expires: (.+)$/m);
    expect(match).not.toBeNull();
    const expiresStr = match![1];
    expect(expiresStr).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    const expires = new Date(expiresStr);
    expect(expires.getTime()).toBeGreaterThan(Date.now());
  });
});
