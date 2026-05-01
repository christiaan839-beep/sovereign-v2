/**
 * Move 20 — /.well-known/aibom.json route tests.
 *
 * Coverage:
 *   - Route returns 200 + valid AIBOMDocument
 *   - Document hash matches recomputed
 *   - Components include models + tools + agents (mixed kinds)
 *   - Cache-Control public 1-hour
 *   - X-Sovereign-AIBOM-Hash header mirrors body
 *   - Builder is pure-function (deterministic for fixed inputs)
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

import { GET } from "@/app/.well-known/aibom.json/route";
import {
  validateAIBOMDocument,
  type AIBOMDocument,
} from "@/lib/supply-chain/aibom";
import { buildPlatformAIBOM } from "@/lib/aibom-builder";
import { AGENT_MANIFESTS } from "@/lib/agent-manifests.generated";

describe("/.well-known/aibom.json — public AIBOM publication (Move 20)", () => {
  it("returns 200 with a valid AIBOMDocument", async () => {
    const res = (await GET()) as unknown as {
      status: number;
      body: AIBOMDocument;
    };
    expect(res.status).toBe(200);
    const v = validateAIBOMDocument(res.body);
    expect(v.ok).toBe(true);
  });

  it("documentHash matches recomputation (anti-tampering anchor)", async () => {
    const res = (await GET()) as unknown as { body: AIBOMDocument };
    const v = validateAIBOMDocument(res.body);
    expect(v.ok).toBe(true);
  });

  it("X-Sovereign-AIBOM-Hash header mirrors body.documentHash", async () => {
    const res = (await GET()) as unknown as {
      headers: Map<string, string>;
      body: AIBOMDocument;
    };
    expect(res.headers.get("X-Sovereign-AIBOM-Hash")).toBe(res.body.documentHash);
  });

  it("Cache-Control allows public caching for 1 hour", async () => {
    const res = (await GET()) as unknown as { headers: Map<string, string> };
    const cc = res.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("public");
    expect(cc).toContain("max-age=3600");
  });

  it("CORS open (auditors can fetch from any origin)", async () => {
    const res = (await GET()) as unknown as { headers: Map<string, string> };
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("components include models AND tools AND agents (mixed kinds)", async () => {
    const res = (await GET()) as unknown as { body: AIBOMDocument };
    const kinds = new Set(res.body.components.map((c) => c.kind));
    expect(kinds.has("model")).toBe(true);
    expect(kinds.has("tool")).toBe(true);
    expect(kinds.has("agent")).toBe(true);
  });
});

describe("buildPlatformAIBOM — deterministic + pure", () => {
  it("same inputs produce same documentHash", () => {
    const a = buildPlatformAIBOM({
      agentManifests: AGENT_MANIFESTS,
      platformVersion: "test-v1",
      generatedAt: "2026-04-30T00:00:00.000Z",
    });
    const b = buildPlatformAIBOM({
      agentManifests: AGENT_MANIFESTS,
      platformVersion: "test-v1",
      generatedAt: "2026-04-30T00:00:00.000Z",
    });
    expect(a.documentHash).toBe(b.documentHash);
  });

  it("agent count in AIBOM matches AGENT_MANIFESTS count", () => {
    const doc = buildPlatformAIBOM({
      agentManifests: AGENT_MANIFESTS,
      platformVersion: "test-v1",
      generatedAt: "2026-04-30T00:00:00.000Z",
    });
    const agentComponents = doc.components.filter((c) => c.kind === "agent");
    expect(agentComponents.length).toBe(Object.keys(AGENT_MANIFESTS).length);
  });
});
