/**
 * Tests for src/lib/agent-tokens.ts — Wave 16.
 *
 * Covers the JWT-style issue / verify / revoke lifecycle without
 * touching a live DB. The Drizzle db module is mocked: inserts and
 * selects are captured in module-level slots so tests assert on the
 * row Sovereign would have persisted, plus the offline-verifiable
 * signature path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomBytes } from "crypto";

// ── Mock DB ───────────────────────────────────────────────────────────

const insertedRows: Array<Record<string, unknown>> = [];
let storedRows: Array<Record<string, unknown>> = [];

const mockDb = {
  insert: vi.fn(() => ({
    values: (v: Record<string, unknown>) => {
      insertedRows.push(v);
      storedRows.push(v);
      return Promise.resolve();
    },
  })),
  select: vi.fn(() => ({
    from: () => ({
      where: (_clause: unknown) => ({
        limit: () => Promise.resolve(storedRows),
      }),
    }),
  })),
  update: vi.fn(() => ({
    set: (s: Record<string, unknown>) => ({
      where: (_clause: unknown) => {
        for (const row of storedRows) {
          Object.assign(row, s);
        }
        return Promise.resolve();
      },
    }),
  })),
};

vi.mock("@/db", () => ({ db: mockDb }));
vi.mock("@/db/schema", () => ({
  agentTokens: {
    id: "id",
    agentSlug: "agentSlug",
    tenantId: "tenantId",
    userId: "userId",
    scopes: "scopes",
    scheme: "scheme",
    expiresAt: "expiresAt",
    issuedAt: "issuedAt",
    revokedAt: "revokedAt",
    revokeReason: "revokeReason",
  },
}));
vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ _and: args }),
  eq: (a: unknown, b: unknown) => ({ _eq: [a, b] }),
  gt: (a: unknown, b: unknown) => ({ _gt: [a, b] }),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// ── Setup ─────────────────────────────────────────────────────────────

const originalSecret = process.env.AGENT_RUN_SIGNING_SECRET;
const originalEd = process.env.AGENT_RUN_ED25519_PRIVATE_KEY;

beforeEach(() => {
  insertedRows.length = 0;
  storedRows = [];
  vi.clearAllMocks();
  delete process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
  process.env.AGENT_RUN_SIGNING_SECRET = randomBytes(24).toString("hex");
});

afterAll();
function afterAll() {
  // Best-effort restore — vitest doesn't always run an afterAll global
  // hook in describe-less suites, so wrap manually.
  process.on("beforeExit", () => {
    if (originalSecret !== undefined)
      process.env.AGENT_RUN_SIGNING_SECRET = originalSecret;
    else delete process.env.AGENT_RUN_SIGNING_SECRET;
    if (originalEd !== undefined)
      process.env.AGENT_RUN_ED25519_PRIVATE_KEY = originalEd;
  });
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("issueAgentToken", () => {
  it("returns a 3-segment JWT-style token with v1 scheme when no Ed25519 key set", async () => {
    const { issueAgentToken } = await import("@/lib/agent-tokens");
    const out = await issueAgentToken({
      agentSlug: "lead-blitz",
      scopes: ["agent:run", "tool:fetch"],
    });
    expect(out.token.split(".")).toHaveLength(3);
    expect(out.tokenId).toMatch(/^[0-9a-f-]{36}$/);
    expect(out.claims.agt).toBe("lead-blitz");
    expect(out.claims.iss).toBe("sovereignmatrix.agency");
    expect(out.claims.sco).toEqual(["agent:run", "tool:fetch"]);
    expect(out.expiresAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("persists a row to agent_tokens with the same id as the JWT claims.aid", async () => {
    const { issueAgentToken } = await import("@/lib/agent-tokens");
    const out = await issueAgentToken({
      agentSlug: "x",
      scopes: ["agent:run"],
    });
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]!.id).toBe(out.tokenId);
    expect(insertedRows[0]!.agentSlug).toBe("x");
    expect(insertedRows[0]!.scheme).toBe("v1");
    expect(JSON.parse(insertedRows[0]!.scopes as string)).toEqual([
      "agent:run",
    ]);
  });

  it("clamps ttlSeconds to [60, 3600]", async () => {
    const { issueAgentToken } = await import("@/lib/agent-tokens");
    const tiny = await issueAgentToken({
      agentSlug: "a",
      scopes: ["agent:run"],
      ttlSeconds: 1,
    });
    const huge = await issueAgentToken({
      agentSlug: "b",
      scopes: ["agent:run"],
      ttlSeconds: 999_999,
    });
    expect(tiny.claims.exp - tiny.claims.iat).toBe(60);
    expect(huge.claims.exp - huge.claims.iat).toBe(3600);
  });

  it("deduplicates scopes", async () => {
    const { issueAgentToken } = await import("@/lib/agent-tokens");
    const out = await issueAgentToken({
      agentSlug: "x",
      scopes: ["agent:run", "agent:run", "tool:fetch"],
    });
    expect(out.claims.sco).toEqual(["agent:run", "tool:fetch"]);
  });

  it("throws on empty scopes", async () => {
    const { issueAgentToken } = await import("@/lib/agent-tokens");
    await expect(
      issueAgentToken({ agentSlug: "x", scopes: [] }),
    ).rejects.toThrow(/non-empty/);
  });
});

describe("verifyAgentToken", () => {
  it("accepts a fresh self-issued token", async () => {
    const { issueAgentToken, verifyAgentToken } =
      await import("@/lib/agent-tokens");
    const out = await issueAgentToken({
      agentSlug: "x",
      scopes: ["agent:run"],
    });
    // Drop revocation check — our mock returns all rows on select so
    // the issued row appears to have no revokedAt anyway.
    const v = await verifyAgentToken(out.token, { checkRevoked: false });
    expect(v.ok).toBe(true);
    expect(v.claims?.agt).toBe("x");
  });

  it("rejects malformed tokens with reason 'malformed'", async () => {
    const { verifyAgentToken } = await import("@/lib/agent-tokens");
    const r = await verifyAgentToken("not.a.real.jwt.really", {
      checkRevoked: false,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("malformed");
  });

  it("rejects tokens whose header.typ is not sov-agent", async () => {
    const { verifyAgentToken } = await import("@/lib/agent-tokens");
    const headerB64 = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const payloadB64 = Buffer.from(
      JSON.stringify({
        aid: "x",
        agt: "y",
        ten: null,
        usr: null,
        sco: ["agent:run"],
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 60,
        iss: "sovereignmatrix.agency",
      }),
    )
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const r = await verifyAgentToken(`${headerB64}.${payloadB64}.fake`, {
      checkRevoked: false,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("bad-header");
  });

  it("rejects expired tokens with reason 'expired'", async () => {
    const { issueAgentToken, verifyAgentToken } =
      await import("@/lib/agent-tokens");
    // Mint with minimum ttl, then time-travel past the expiry.
    const out = await issueAgentToken({
      agentSlug: "x",
      scopes: ["agent:run"],
      ttlSeconds: 60,
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.now() + 120_000));
    const r = await verifyAgentToken(out.token, { checkRevoked: false });
    vi.useRealTimers();
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("expired");
  });

  it("rejects tokens with a tampered signature", async () => {
    const { issueAgentToken, verifyAgentToken } =
      await import("@/lib/agent-tokens");
    const out = await issueAgentToken({
      agentSlug: "x",
      scopes: ["agent:run"],
    });
    const tampered = out.token.slice(0, -4) + "AAAA";
    const r = await verifyAgentToken(tampered, { checkRevoked: false });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("bad-signature");
  });
});

describe("revoke + status", () => {
  it("getTokenStatus reports active=false after revokeAgentToken", async () => {
    const { issueAgentToken, revokeAgentToken, getTokenStatus } =
      await import("@/lib/agent-tokens");
    const out = await issueAgentToken({
      agentSlug: "x",
      scopes: ["agent:run"],
      ttlSeconds: 300,
    });
    const beforeStatus = await getTokenStatus(out.tokenId);
    expect(beforeStatus.exists).toBe(true);
    expect(beforeStatus.active).toBe(true);

    const r = await revokeAgentToken(out.tokenId, "test-revoke");
    expect(r.ok).toBe(true);

    const afterStatus = await getTokenStatus(out.tokenId);
    expect(afterStatus.active).toBe(false);
    expect(afterStatus.revokedAt).not.toBeNull();
    expect(afterStatus.revokeReason).toBe("test-revoke");
  });

  it("verifyAgentToken returns 'revoked' once the row is flipped", async () => {
    const { issueAgentToken, revokeAgentToken, verifyAgentToken } =
      await import("@/lib/agent-tokens");
    const out = await issueAgentToken({
      agentSlug: "x",
      scopes: ["agent:run"],
      ttlSeconds: 300,
    });
    await revokeAgentToken(out.tokenId, "policy");
    const v = await verifyAgentToken(out.token); // default checkRevoked=true
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("revoked");
  });
});

describe("listActiveTokens", () => {
  it("returns the issued token with sanitized fields", async () => {
    const { issueAgentToken, listActiveTokens } =
      await import("@/lib/agent-tokens");
    await issueAgentToken({ agentSlug: "z", scopes: ["agent:run"] });
    const rows = await listActiveTokens({ limit: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.agentSlug).toBe("z");
    expect(rows[0]!.scopes).toEqual(["agent:run"]);
    expect(rows[0]!.issuedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });
});
