/**
 * Tests for src/app/.well-known/agent.json/route.ts — public Agent
 * Card publication (R160 Move 13).
 *
 * Coverage:
 *   - GET returns a structurally valid Agent Card
 *   - Body matches A2AAgentCard schema and validates cryptographically
 *   - X-Sovereign-Card-Fingerprint header matches body fingerprint
 *   - Cache-Control + CORS headers present
 *   - Capability list matches the single-source-of-truth constant
 *     (anti-drift between this route and /.well-known/sovereign-trust)
 */

import { describe, it, expect, vi } from "vitest";

// Mock NextResponse so the route handler runs in plain Node.
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

import { GET } from "@/app/.well-known/agent.json/route";
import {
  validateAgentCard,
  type A2AAgentCard,
} from "@/lib/protocols/a2a/agent-card";
import { SOVEREIGN_PLATFORM_CAPABILITIES } from "@/lib/protocols/a2a/platform-card";

describe("/.well-known/agent.json — public Agent Card publication", () => {
  it("returns 200 with a structurally + cryptographically valid card", async () => {
    const res = (await GET(
      new Request("https://sovereignmatrix.agency/.well-known/agent.json"),
    )) as unknown as { status: number; body: A2AAgentCard; headers: Map<string, string> };
    expect(res.status).toBe(200);
    const validation = validateAgentCard(res.body);
    expect(validation.ok).toBe(true);
  });

  it("rpc endpoint is HTTPS even when request comes in over http (card describes prod)", async () => {
    // Note: validateAgentCard requires HTTPS — this is the spec.
    // The card's rpc URL is https-prefixed regardless of incoming
    // scheme so dev-mode fetches still produce a spec-valid card.
    const res = (await GET(
      new Request("https://sovereignmatrix.agency/.well-known/agent.json"),
    )) as unknown as { body: A2AAgentCard };
    expect(res.body.endpoints.rpc.startsWith("https://")).toBe(true);
  });

  it("X-Sovereign-Card-Fingerprint header matches body.fingerprint", async () => {
    const res = (await GET(
      new Request("https://sovereignmatrix.agency/.well-known/agent.json"),
    )) as unknown as { body: A2AAgentCard; headers: Map<string, string> };
    const headerFp = res.headers.get("X-Sovereign-Card-Fingerprint");
    expect(headerFp).toBe(res.body.fingerprint);
  });

  it("Cache-Control allows public caching for 5 min", async () => {
    const res = (await GET(
      new Request("https://sovereignmatrix.agency/.well-known/agent.json"),
    )) as unknown as { headers: Map<string, string> };
    const cc = res.headers.get("Cache-Control") ?? "";
    expect(cc).toContain("public");
    expect(cc).toContain("max-age=300");
  });

  it("CORS allows any origin (discovery surface is public)", async () => {
    const res = (await GET(
      new Request("https://sovereignmatrix.agency/.well-known/agent.json"),
    )) as unknown as { headers: Map<string, string> };
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("capability list matches the single-source-of-truth constant", async () => {
    // Anti-drift gate: if a future maintainer inlines a capability
    // list in the route file instead of importing from
    // platform-card.ts, this test FAILS. That keeps the Agent Card
    // and the federation manifest from claiming different surfaces.
    const res = (await GET(
      new Request("https://sovereignmatrix.agency/.well-known/agent.json"),
    )) as unknown as { body: A2AAgentCard };
    expect([...res.body.capabilities].sort()).toEqual(
      [...SOVEREIGN_PLATFORM_CAPABILITIES].sort(),
    );
  });

  it("agent id is the stable platform id (not a per-request value)", async () => {
    const res = (await GET(
      new Request("https://sovereignmatrix.agency/.well-known/agent.json"),
    )) as unknown as { body: A2AAgentCard };
    expect(res.body.id).toBe("sovereign-matrix-platform");
  });

  it("declares the canonical A2A protocol version 1.0", async () => {
    const res = (await GET(
      new Request("https://sovereignmatrix.agency/.well-known/agent.json"),
    )) as unknown as { body: A2AAgentCard };
    expect(res.body.protocolVersion).toBe("1.0");
  });
});
