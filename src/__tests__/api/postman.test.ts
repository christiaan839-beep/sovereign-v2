/**
 * Tests for GET /api/postman.json — Postman 2.1 collection generator.
 *
 * Companion to the openapi-public.test.ts suite. The Postman collection
 * is the one-click import path compliance teams + auditors actually
 * use during procurement; pinning its shape keeps the import working
 * once any tool consumes it.
 *
 * Properties pinned:
 *   - Valid Postman 2.1 envelope (info, schema, item, variable)
 *   - Self-references the request origin in the `host` variable
 *     (preview deploys + white-label produce valid collections)
 *   - All 5 documented endpoints present with correct HTTP method
 *   - Variables include {{host}} and {{receiptId}} placeholders
 *   - Schema URL points at the v2.1 Postman spec
 *   - CORS + cache headers
 *   - OPTIONS returns 204
 */

import { describe, it, expect } from "vitest";

async function loadRoute() {
  return await import("@/app/api/postman.json/route");
}

describe("GET /api/postman.json", () => {
  it("returns a valid Postman 2.1 collection envelope", async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request("https://example.test/api/postman.json"));
    const body = await res.json();
    expect(body.info).toBeDefined();
    expect(body.info.name).toContain("Sovereign");
    expect(body.info.schema).toContain("v2.1.0");
    expect(body.item).toBeInstanceOf(Array);
    expect(body.variable).toBeInstanceOf(Array);
  });

  it("self-references the request origin in the host variable", async () => {
    const { GET } = await loadRoute();
    const previewRes = await GET(
      new Request("https://preview.vercel.app/api/postman.json"),
    );
    const previewBody = await previewRes.json();
    const hostVar = previewBody.variable.find(
      (v: { key: string }) => v.key === "host",
    );
    expect(hostVar.value).toBe("https://preview.vercel.app");
  });

  it("includes all 5 documented endpoints with correct HTTP method", async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request("https://example.test/api/postman.json"));
    const body = await res.json();
    const items = body.item as Array<{
      name: string;
      request: { method: string; url: { path: string[] } };
    }>;
    // Wave 22 made the collection additive — it now includes the
    // original 5 verification endpoints plus the elite-tier slice.
    // The contract this test guards is "the 5 originals are still
    // present"; we no longer pin the total to exactly 5.
    expect(items.length).toBeGreaterThanOrEqual(5);
    const byPath = (path: string) =>
      items.find((it) => it.request.url.path.join("/").includes(path));
    expect(byPath("verify")?.request.method).toBe("POST");
    expect(byPath("agent-runs/{{receiptId}}")?.request.method).toBe("GET");
    expect(byPath("latest-public")?.request.method).toBe("GET");
    expect(byPath("recent-public")?.request.method).toBe("GET");
    expect(byPath("stats/public")?.request.method).toBe("GET");
  });

  it("declares both {{host}} and {{receiptId}} variables", async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request("https://example.test/api/postman.json"));
    const body = await res.json();
    const keys = (body.variable as Array<{ key: string }>).map((v) => v.key);
    expect(keys).toContain("host");
    expect(keys).toContain("receiptId");
  });

  it("returns CORS + cache headers", async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request("https://example.test/api/postman.json"));
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toContain("s-maxage=300");
  });

  it("OPTIONS preflight returns 204", async () => {
    const { OPTIONS } = await loadRoute();
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("the verify endpoint includes a body example with canonical+signature", async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request("https://example.test/api/postman.json"));
    const body = await res.json();
    const verifyItem = (
      body.item as Array<{
        name: string;
        request: { body?: { raw: string } };
      }>
    ).find((it) => it.name.toLowerCase().includes("verify"));
    expect(verifyItem?.request.body?.raw).toContain("canonical");
    expect(verifyItem?.request.body?.raw).toContain("signature");
  });
});
