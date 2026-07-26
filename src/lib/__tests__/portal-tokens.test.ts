/**
 * Contract tests for portal-tokens (wave 122, BACKLOG H4).
 *
 * The portal token is the sole credential protecting /api/portal/metrics
 * — these cases pin the properties that make it safe:
 *   - roundtrip verify, subject binding, tamper rejection
 *   - fail-CLOSED when no signing secret is configured
 *   - TTL clamping [1h, 90d]
 *   - expiry enforcement
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mintPortalToken, verifyPortalToken } from "@/lib/portal-tokens";

const SECRET = "test-portal-secret-with-adequate-length";

beforeEach(() => {
  process.env.PORTAL_TOKEN_SIGNING_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.PORTAL_TOKEN_SIGNING_SECRET;
  vi.useRealTimers();
});

describe("portal-tokens", () => {
  it("mint → verify roundtrip succeeds for the matching clientId", () => {
    const minted = mintPortalToken({ clientId: "client@example.com" });
    const res = verifyPortalToken(minted.token, "client@example.com");
    expect(res.ok).toBe(true);
    expect(res.claims?.sub).toBe("client@example.com");
    expect(res.claims?.sco).toEqual(["portal:read"]);
  });

  it("rejects a token presented for a DIFFERENT clientId (subject binding)", () => {
    const minted = mintPortalToken({ clientId: "client@example.com" });
    const res = verifyPortalToken(minted.token, "victim@example.com");
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("wrong-subject");
  });

  it("rejects a tampered payload (signature check)", () => {
    const minted = mintPortalToken({ clientId: "client@example.com" });
    const [h, , s] = minted.token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({
        sub: "victim@example.com",
        sco: ["portal:read"],
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: "sovereignmatrix.agency",
      }),
      "utf8",
    )
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    const res = verifyPortalToken(
      `${h}.${forgedPayload}.${s}`,
      "victim@example.com",
    );
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("bad-signature");
  });

  it("rejects malformed tokens", () => {
    expect(verifyPortalToken("not-a-token", "x").reason).toBe("malformed");
    expect(verifyPortalToken("a.b", "x").reason).toBe("malformed");
    expect(verifyPortalToken("a.b.c", "x").reason).toBe("malformed");
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const minted = mintPortalToken({
      clientId: "client@example.com",
      ttlSeconds: 3600,
    });
    vi.setSystemTime(new Date("2026-01-01T02:00:00Z")); // 2h later
    const res = verifyPortalToken(minted.token, "client@example.com");
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("expired");
  });

  it("clamps TTL to [1 hour, 90 days]", () => {
    const short = mintPortalToken({ clientId: "c", ttlSeconds: 10 });
    expect(short.claims.exp - short.claims.iat).toBe(3600);
    const long = mintPortalToken({
      clientId: "c",
      ttlSeconds: 400 * 24 * 3600,
    });
    expect(long.claims.exp - long.claims.iat).toBe(90 * 24 * 3600);
  });

  it("fails CLOSED when no signing secret is configured", () => {
    const minted = mintPortalToken({ clientId: "client@example.com" });
    delete process.env.PORTAL_TOKEN_SIGNING_SECRET;
    const savedAgent = process.env.AGENT_RUN_SIGNING_SECRET;
    const savedCron = process.env.CRON_SECRET;
    delete process.env.AGENT_RUN_SIGNING_SECRET;
    delete process.env.CRON_SECRET;
    try {
      expect(() => mintPortalToken({ clientId: "x" })).toThrow(/signing/i);
      const res = verifyPortalToken(minted.token, "client@example.com");
      expect(res.ok).toBe(false);
      expect(res.reason).toBe("no-key");
    } finally {
      if (savedAgent) process.env.AGENT_RUN_SIGNING_SECRET = savedAgent;
      if (savedCron) process.env.CRON_SECRET = savedCron;
    }
  });

  it("rejects a short signing secret (<16 chars) at mint time", () => {
    process.env.PORTAL_TOKEN_SIGNING_SECRET = "short";
    const savedAgent = process.env.AGENT_RUN_SIGNING_SECRET;
    const savedCron = process.env.CRON_SECRET;
    delete process.env.AGENT_RUN_SIGNING_SECRET;
    delete process.env.CRON_SECRET;
    try {
      expect(() => mintPortalToken({ clientId: "x" })).toThrow();
    } finally {
      if (savedAgent) process.env.AGENT_RUN_SIGNING_SECRET = savedAgent;
      if (savedCron) process.env.CRON_SECRET = savedCron;
    }
  });
});
