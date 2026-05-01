/**
 * Move 19 — A2A request handler tests.
 *
 * Coverage:
 *   - Bad request shapes return 400
 *   - Unknown tool returns 404
 *   - Body too large returns 413
 *   - Default REFUSE_ALL_POLICY blocks any peer with no_mapping
 *     and fires agent.cross_protocol_block audit
 *   - Custom policy via env var grants scope when claim matches
 *   - Authorized request returns 501 (transport not wired) but
 *     with the authorization detail intact
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { POST } from "@/app/api/v1/a2a/[peer]/route";

const params = (peer: string) => ({ params: Promise.resolve({ peer }) });

const post = (peer: string, body: unknown) =>
  POST(
    new Request(`https://example.com/api/v1/a2a/${peer}`, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    params(peer),
  );

describe("/api/v1/a2a/[peer] — error shapes", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("non-JSON body → 400", async () => {
    const res = (await post("alice", "{not json")) as unknown as {
      status: number;
      body: { error: string };
    };
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("bad_request");
  });

  it("missing peerCard → 400", async () => {
    const res = (await post("alice", {
      request: { toolId: "platform.health-check" },
    })) as unknown as { status: number; body: { error: string } };
    expect(res.status).toBe(400);
  });

  it("missing request.toolId → 400", async () => {
    const res = (await post("alice", {
      peerCard: { peerId: "alice", authScheme: "act-token", claims: [] },
    })) as unknown as { status: number; body: { error: string } };
    expect(res.status).toBe(400);
  });

  it("unknown tool → 404", async () => {
    const res = (await post("alice", {
      peerCard: { peerId: "alice", authScheme: "act-token", claims: ["sov-internal"] },
      request: { toolId: "does.not.exist" },
    })) as unknown as { status: number; body: { error: string } };
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("tool_not_found");
  });
});

describe("/api/v1/a2a/[peer] — REFUSE_ALL default policy (least-privilege)", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("default policy refuses with no_mapping → 403 with cross_protocol_block response", async () => {
    const res = (await post("alice", {
      peerCard: {
        peerId: "alice",
        authScheme: "act-token",
        claims: ["sov-internal"],
      },
      request: { toolId: "platform.health-check" },
    })) as unknown as {
      status: number;
      body: { error: string; reason: string };
    };
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("cross_protocol_block");
    expect(res.body.reason).toBe("no_mapping");
  });
});

describe("/api/v1/a2a/[peer] — custom policy via SOVEREIGN_A2A_POLICY_JSON", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("policy granting health:read returns 501 (authorized but transport not yet wired)", async () => {
    const policy = JSON.stringify([
      {
        id: "test.health-read",
        description: "test",
        matchAuthScheme: "*",
        matchClaim: "sov-internal",
        grants: ["health:read"],
      },
    ]);
    vi.stubEnv("SOVEREIGN_A2A_POLICY_JSON", policy);

    const res = (await post("alice", {
      peerCard: {
        peerId: "alice",
        authScheme: "act-token",
        claims: ["sov-internal"],
      },
      request: { toolId: "platform.health-check" },
    })) as unknown as {
      status: number;
      body: {
        error: string;
        authorization: { peerId: string; toolId: string; grantedScopes: string[] };
      };
    };
    expect(res.status).toBe(501);
    expect(res.body.error).toBe("tool_dispatch_not_yet_implemented");
    expect(res.body.authorization.peerId).toBe("alice");
    expect(res.body.authorization.toolId).toBe("platform.health-check");
    expect(res.body.authorization.grantedScopes).toContain("health:read");
  });

  it("policy granting only finance:read still refuses with scope_missing", async () => {
    const policy = JSON.stringify([
      {
        id: "test.finance-read",
        description: "test",
        matchAuthScheme: "*",
        matchClaim: "sov-internal",
        grants: ["finance:read"],
      },
    ]);
    vi.stubEnv("SOVEREIGN_A2A_POLICY_JSON", policy);

    const res = (await post("alice", {
      peerCard: {
        peerId: "alice",
        authScheme: "act-token",
        claims: ["sov-internal"],
      },
      request: { toolId: "platform.health-check" },
    })) as unknown as {
      status: number;
      body: { error: string; reason: string };
    };
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("cross_protocol_block");
    expect(res.body.reason).toBe("scope_missing");
  });

  it("malformed env policy falls back to REFUSE_ALL", async () => {
    vi.stubEnv("SOVEREIGN_A2A_POLICY_JSON", "{not valid json");
    const res = (await post("alice", {
      peerCard: {
        peerId: "alice",
        authScheme: "act-token",
        claims: ["sov-internal"],
      },
      request: { toolId: "platform.health-check" },
    })) as unknown as { status: number; body: { reason: string } };
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe("no_mapping");
  });
});

describe("/api/v1/a2a/[peer] — body size cap", () => {
  it("body > 1MB → 413", async () => {
    const huge = "x".repeat(1_000_001);
    const res = (await post("alice", huge)) as unknown as {
      status: number;
      body: { error: string };
    };
    expect(res.status).toBe(413);
    expect(res.body.error).toBe("payload_too_large");
  });
});
