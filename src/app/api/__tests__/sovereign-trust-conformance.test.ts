/**
 * Sovereign Trust Manifest 1.0 — conformance test.
 *
 * Validates that the live /.well-known/sovereign-trust output conforms
 * to the published spec at docs/SOVEREIGN_TRUST_MANIFEST_SPEC.md.
 *
 * Pure structural validation in plain TypeScript — no ajv dependency.
 * Mirrors the JSON Schema in public/.well-known/sovereign-trust.schema.json.
 *
 * If this test fails, EITHER:
 *   (a) The implementation drifted from the spec → fix the route, OR
 *   (b) The spec needs a new field → bump the version, update the schema,
 *       update this test, AND mention the change in the commit.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      body,
      status: init?.status ?? 200,
      headers: new Map(Object.entries(init?.headers ?? {})),
      json: async () => body,
    }),
  },
}));

import { GET } from "@/app/.well-known/sovereign-trust/route";

const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const HEX_64 = /^[0-9a-f]{64}$/;
const SCHEMA_VERSION_URL = /^https?:\/\/.+\/v\d+\.\d+\.\d+$/;
const KEBAB_OR_R_TAGGED = /^[a-z][a-z0-9-]*(-r\d+)?$/;
const KEBAB_PLAIN = /^[a-z][a-z0-9-]*$/;
const CAMEL = /^[a-zA-Z][a-zA-Z0-9]*$/;
const MAX_AGE = /max-age=(\d+)/;

const fetchManifest = async () => {
  const res = (await GET(
    new Request("https://sovereignmatrix.agency/.well-known/sovereign-trust"),
  )) as unknown as { status: number; body: Record<string, unknown>; headers: Map<string, string> };
  return res;
};

describe("/.well-known/sovereign-trust — conformance to Manifest 1.0", () => {
  it("returns 200 + Content-Type application/json", async () => {
    const res = await fetchManifest();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
  });

  it("Cache-Control allows no more than 1 hour caching (spec section 1)", async () => {
    const res = await fetchManifest();
    const cc = res.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("public");
    const m = cc.match(MAX_AGE);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThanOrEqual(3600);
  });

  it("CORS allows any origin (spec section 1)", async () => {
    const res = await fetchManifest();
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("body matches the v1.0 document shape (spec section 2)", async () => {
    const { body: doc } = await fetchManifest();

    expect(typeof doc.$schema).toBe("string");
    expect(doc.$schema as string).toMatch(SCHEMA_VERSION_URL);

    expect(typeof doc.generatedAt).toBe("string");
    expect(doc.generatedAt as string).toMatch(ISO_8601);

    const identity = doc.identity as Record<string, unknown>;
    expect(typeof identity.name).toBe("string");
    expect((identity.name as string).length).toBeGreaterThan(0);
    expect(typeof identity.canonicalUrl).toBe("string");
    expect((identity.canonicalUrl as string).startsWith("http")).toBe(true);
    expect(typeof identity.description).toBe("string");
    if (identity.keyFingerprint !== null) {
      expect(typeof identity.keyFingerprint).toBe("string");
      expect(identity.keyFingerprint as string).toMatch(HEX_64);
    }

    const caps = doc.capabilities as Record<string, unknown>;
    for (const [k, v] of Object.entries(caps)) {
      expect(k).toMatch(CAMEL);
      expect(typeof v).toBe("boolean");
    }

    const endpoints = doc.endpoints as Record<string, unknown>;
    for (const [k, v] of Object.entries(endpoints)) {
      expect(k).toMatch(CAMEL);
      expect(typeof v).toBe("string");
      expect((v as string).startsWith("http")).toBe(true);
    }

    const pc = doc.platformCapabilities;
    if (pc !== undefined) {
      expect(Array.isArray(pc)).toBe(true);
      for (const cap of pc as string[]) {
        if (cap === "inspector-verifiable") continue;
        expect(cap).toMatch(KEBAB_OR_R_TAGGED);
      }
    }

    const vs = doc.verifierSurfaces;
    if (vs !== undefined) {
      expect(Array.isArray(vs)).toBe(true);
      for (const surface of vs as string[]) {
        expect(surface).toMatch(KEBAB_PLAIN);
      }
    }

    const verifier = doc.verifier as Record<string, unknown>;
    expect(typeof verifier.npmPackage).toBe("string");
    expect(typeof verifier.install).toBe("string");
    expect(typeof verifier.source).toBe("string");
  });

  it("publicVerifierEndpoint capability is true and verifier endpoint is published", async () => {
    const { body } = await fetchManifest();
    const caps = body.capabilities as Record<string, boolean>;
    const endpoints = body.endpoints as Record<string, string>;
    expect(caps.publicVerifierEndpoint).toBe(true);
    expect(typeof endpoints.verifier).toBe("string");
    expect(typeof endpoints.verifierIndex).toBe("string");
  });

  it("verifier surfaces array advertises all 6 standard surfaces (spec section 5)", async () => {
    const { body } = await fetchManifest();
    const surfaces = (body.verifierSurfaces as string[]) ?? [];
    expect(surfaces).toContain("audit-chain");
    expect(surfaces).toContain("agent-card");
    expect(surfaces).toContain("aibom");
    expect(surfaces).toContain("scope-evaluation");
    expect(surfaces).toContain("bridge-authorization");
    expect(surfaces).toContain("memory-payload");
  });

  it("inspector npm package coordinates are stable", async () => {
    const { body } = await fetchManifest();
    const verifier = body.verifier as { npmPackage: string; install: string };
    expect(verifier.npmPackage).toBe("@sovereign/inspector");
    expect(verifier.install).toContain("npm install");
    expect(verifier.install).toContain("@sovereign/inspector");
  });
});

describe("Sovereign Trust Manifest spec — co-located artifacts", () => {
  it("docs/SOVEREIGN_TRUST_MANIFEST_SPEC.md exists", async () => {
    const fs = await import("node:fs");
    expect(
      fs.existsSync(
        "/Users/christiaanwillemdewet/Projects/sovereign-v2/.claude/worktrees/wizardly-benz/docs/SOVEREIGN_TRUST_MANIFEST_SPEC.md",
      ),
    ).toBe(true);
  });

  it("public/.well-known/sovereign-trust.schema.json exists", async () => {
    const fs = await import("node:fs");
    expect(
      fs.existsSync(
        "/Users/christiaanwillemdewet/Projects/sovereign-v2/.claude/worktrees/wizardly-benz/public/.well-known/sovereign-trust.schema.json",
      ),
    ).toBe(true);
  });
});
