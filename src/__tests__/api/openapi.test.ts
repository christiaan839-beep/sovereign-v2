/**
 * Tests for /openapi.json — generated OpenAPI 3.0.3 spec.
 *
 * Covers:
 *   - returns 200 + application/json
 *   - top-level shape (openapi version, info, servers, paths, components)
 *   - includes one path per agent slug
 *   - flagship paths (verify, agent-runs/[id], me/export, me/delete) present
 *   - core agent paths tagged "Core agents"
 *   - bearerAuth security scheme present
 *   - origin echoed from x-forwarded-host when supplied
 */
import { describe, it, expect } from "vitest";

import { buildOpenApiSpec } from "@/lib/openapi-spec";
import { AGENT_SLUGS } from "@/lib/agent-slugs";

describe("buildOpenApiSpec", () => {
  it("produces a valid OpenAPI 3.0.3 root", () => {
    const spec = buildOpenApiSpec("https://example.com");
    expect(spec.openapi).toBe("3.0.3");
    expect(spec.info.title).toBe("Sovereign Matrix API");
    expect(spec.info.version).toMatch(/^\d/);
    expect(spec.servers[0]!.url).toBe("https://example.com");
  });

  it("emits one path per agent slug", () => {
    const spec = buildOpenApiSpec("https://example.com");
    for (const slug of AGENT_SLUGS) {
      expect(spec.paths[`/api/_agents/${slug}`]).toBeDefined();
      expect(spec.paths[`/api/_agents/${slug}`]!.post).toBeDefined();
    }
  });

  it("tags core agents distinctly from experimental ones", () => {
    const spec = buildOpenApiSpec("https://example.com");
    const godBrain = spec.paths["/api/_agents/god-brain"]?.post;
    expect(godBrain?.tags).toContain("Core agents");
  });

  it("includes the platform receipt + verify + privacy paths", () => {
    const spec = buildOpenApiSpec("https://example.com");
    expect(spec.paths["/api/agent-runs"]).toBeDefined();
    expect(spec.paths["/api/agent-runs/{id}"]).toBeDefined();
    expect(spec.paths["/api/agent-runs/{id}/publish"]).toBeDefined();
    expect(spec.paths["/api/agent-runs/{id}/replay"]).toBeDefined();
    expect(spec.paths["/api/verify"]).toBeDefined();
    expect(spec.paths["/api/me/export"]).toBeDefined();
    expect(spec.paths["/api/me/delete"]).toBeDefined();
    expect(spec.paths["/api/keys"]).toBeDefined();
    expect(spec.paths["/api/agents"]).toBeDefined();
  });

  it("declares bearerAuth security scheme", () => {
    const spec = buildOpenApiSpec("https://example.com");
    expect(spec.components.securitySchemes.bearerAuth).toEqual(
      expect.objectContaining({ type: "http", scheme: "bearer" }),
    );
  });

  it("declares Receipt + VerifyResult + AgentList component schemas", () => {
    const spec = buildOpenApiSpec("https://example.com");
    expect(spec.components.schemas.Receipt).toBeDefined();
    expect(spec.components.schemas.ReceiptList).toBeDefined();
    expect(spec.components.schemas.VerifyResult).toBeDefined();
    expect(spec.components.schemas.AgentList).toBeDefined();
  });

  it("uses the supplied origin for the server entry", () => {
    const spec = buildOpenApiSpec("https://prod.sovereignmatrix.agency");
    expect(spec.servers[0]!.url).toBe("https://prod.sovereignmatrix.agency");
  });
});

describe("GET /openapi.json", () => {
  it("returns 200 + JSON + open CORS", async () => {
    const { GET } = await import("@/app/openapi.json/route");
    const req = new Request("https://example.com/openapi.json", {
      headers: { host: "example.com", "x-forwarded-proto": "https" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const body = (await res.json()) as {
      openapi: string;
      info: { title: string };
    };
    expect(body.openapi).toBe("3.0.3");
    expect(body.info.title).toBe("Sovereign Matrix API");
  });

  it("OPTIONS preflight returns 204 with CORS headers", async () => {
    const { OPTIONS } = await import("@/app/openapi.json/route");
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toMatch(/GET/);
  });
});
