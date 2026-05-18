/**
 * Tests for GET /api/openapi.json — public OpenAPI 3.1 schema for the
 * verification API.
 *
 * (Distinct from /openapi.json which is a different platform-wide
 * spec.) This route is the public-verification companion to the MCP
 * server at /api/mcp/verifier — both expose the same primitives but
 * via different protocols.
 *
 * Properties pinned:
 *   - Returns valid OpenAPI 3.1 envelope (openapi, info, paths)
 *   - Self-references the request origin in servers[0].url (preview
 *     deploys + white-label domains must produce valid contracts)
 *   - Lists all 5 documented endpoints with correct HTTP methods
 *   - Components/schemas referenced by paths actually exist
 *   - CORS + cache headers present
 *   - OPTIONS returns 204
 *
 * Once an external tool (Cursor, Postman, autogen typed client)
 * consumes this schema, its shape is effectively frozen. These tests
 * are the regression net.
 */

import { describe, it, expect } from "vitest";

async function loadRoute() {
  return await import("@/app/api/openapi.json/route");
}

describe("GET /api/openapi.json (public verification API)", () => {
  it("returns valid OpenAPI 3.1 envelope", async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request("https://example.test/api/openapi.json"));
    const body = await res.json();
    expect(body.openapi).toBe("3.1.0");
    expect(body.info).toBeDefined();
    expect(body.info.title).toContain("Sovereign");
    expect(body.info.version).toBeDefined();
    expect(body.info.contact).toBeDefined();
    expect(body.info.license).toBeDefined();
  });

  it("self-references the request origin in servers[0]", async () => {
    const { GET } = await loadRoute();
    const previewRes = await GET(
      new Request("https://preview.vercel.app/api/openapi.json"),
    );
    const previewBody = await previewRes.json();
    expect(previewBody.servers[0].url).toBe("https://preview.vercel.app");
    expect(previewBody.servers[0].description).toContain("This deployment");
    // Canonical production URL stays in servers[1] as fallback.
    expect(previewBody.servers[1].url).toBe("https://sovereignmatrix.agency");
  });

  it("documents all 5 public endpoints", async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request("https://example.test/api/openapi.json"));
    const body = await res.json();
    expect(body.paths["/api/verify"].post).toBeDefined();
    expect(body.paths["/api/agent-runs/{id}"].get).toBeDefined();
    expect(body.paths["/api/agent-runs/latest-public"].get).toBeDefined();
    expect(body.paths["/api/agent-runs/recent-public"].get).toBeDefined();
    expect(body.paths["/api/stats/public"].get).toBeDefined();
  });

  it("each endpoint has operationId + summary + 200 response", async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request("https://example.test/api/openapi.json"));
    const body = await res.json();
    const allOps = Object.values(body.paths).flatMap((pathItem) =>
      Object.values(pathItem as Record<string, unknown>),
    );
    for (const op of allOps as Array<{
      operationId?: string;
      summary?: string;
      responses?: Record<string, unknown>;
    }>) {
      expect(op.operationId).toBeDefined();
      expect(op.summary).toBeDefined();
      expect(op.responses).toBeDefined();
      // Success can be 200 (GET / verify-style) OR 201 (POST resource
      // creation per RFC 9110). Wave 22 added 201-responding endpoints
      // (token issue, ACP intent, clinical scribe).
      const hasSuccess =
        op.responses!["200"] !== undefined ||
        op.responses!["201"] !== undefined;
      expect(hasSuccess).toBe(true);
    }
  });

  it("all $ref schemas exist in components/schemas", async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request("https://example.test/api/openapi.json"));
    const body = await res.json();
    const json = JSON.stringify(body);
    const refs = Array.from(
      json.matchAll(/"#\/components\/schemas\/([A-Za-z0-9_]+)"/g),
    ).map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(body.components.schemas[ref]).toBeDefined();
    }
  });

  it("returns CORS + cache headers", async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request("https://example.test/api/openapi.json"));
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toContain("s-maxage=300");
    expect(res.headers.get("cache-control")).toContain(
      "stale-while-revalidate",
    );
  });

  it("OPTIONS preflight returns 204 with CORS", async () => {
    const { OPTIONS } = await loadRoute();
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("references VAOS spec as externalDocs", async () => {
    const { GET } = await loadRoute();
    const res = await GET(new Request("https://example.test/api/openapi.json"));
    const body = await res.json();
    expect(body.externalDocs.url).toContain("/spec");
  });
});
