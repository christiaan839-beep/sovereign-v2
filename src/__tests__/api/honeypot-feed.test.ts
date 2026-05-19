/**
 * Contract tests for GET /api/honeypot/feed — public federation feed.
 *
 * The shape MUST stay stable: federation members + independent
 * researchers consume it. A silent regression breaks every consumer.
 *
 * Critical invariants to lock:
 *   - Expired bulletins are filtered server-side (TTL enforcement)
 *   - Malformed rows are dropped silently (don't poison the feed)
 *   - Empty feed returned on DB unavailability (stable shape)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { dbLimitMock } = vi.hoisted(() => ({
  dbLimitMock: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({
            limit: () => Promise.resolve(dbLimitMock()),
          }),
        }),
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  auditLogs: {
    action: "auditLogs.action",
    details: "auditLogs.details",
    createdAt: "auditLogs.createdAt",
  },
}));

import { GET } from "@/app/api/honeypot/feed/route";

const originalAllowlist = process.env.HONEYPOT_TRUSTED_ISSUERS;

beforeEach(() => {
  dbLimitMock.mockReset();
  // Default test config — trust all the issuer ids the test fixtures use.
  process.env.HONEYPOT_TRUSTED_ISSUERS =
    "issuer_1,active,expired,issuer_a,issuer_b,trusted,untrusted";
});

afterEach(() => {
  if (originalAllowlist === undefined) {
    delete process.env.HONEYPOT_TRUSTED_ISSUERS;
  } else {
    process.env.HONEYPOT_TRUSTED_ISSUERS = originalAllowlist;
  }
});

function bulletinRow(
  expiresAt: string,
  issuerId = "issuer_1",
  createdAt: Date = new Date(),
) {
  return {
    details: JSON.stringify({
      schema: "vaos-honeypot-bulletin-v1",
      issuedAt: "2026-05-19T00:00:00.000Z",
      expiresAt,
      issuerId,
      fingerprints: [
        {
          schema: "vaos-attack-fingerprint-v1",
          ts: "2026-05-19T00:00:00.000Z",
          class: "scanner-recon",
          ja4: null,
          userAgentDigest: "a".repeat(16),
          pathDigest: "b".repeat(16),
          method: "GET",
          payloadDigest: null,
          countryHint: "DE",
          severity: 50,
        },
      ],
      contentHash: "c".repeat(64),
      mldsa65Sig: null,
      pqEnabled: false,
    }),
    createdAt,
  };
}

describe("/api/honeypot/feed — TTL filtering (ethics gate)", () => {
  it("returns active bulletins, filters expired ones", async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const past = new Date(Date.now() - 3600_000).toISOString();
    dbLimitMock.mockReturnValue([
      bulletinRow(future, "active"),
      bulletinRow(past, "expired"),
    ]);
    const res = await GET(new Request("http://x/y"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalActive).toBe(1);
    expect(body.totalExpiredSuppressed).toBe(1);
    expect(body.bulletins[0].issuerId).toBe("active");
  });

  it("returns empty when all bulletins expired", async () => {
    const past = new Date(Date.now() - 3600_000).toISOString();
    dbLimitMock.mockReturnValue([bulletinRow(past), bulletinRow(past)]);
    const res = await GET(new Request("http://x/y"));
    const body = await res.json();
    expect(body.totalActive).toBe(0);
    expect(body.totalExpiredSuppressed).toBe(2);
    expect(body.bulletins).toEqual([]);
  });
});

describe("/api/honeypot/feed — malformed-row resilience", () => {
  it("drops malformed JSON rows without failing the request", async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    dbLimitMock.mockReturnValue([
      { details: "{not-valid-json", createdAt: new Date() },
      bulletinRow(future),
      { details: null, createdAt: new Date() },
    ]);
    const res = await GET(new Request("http://x/y"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalActive).toBe(1);
  });

  it("drops rows with wrong schema id", async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    dbLimitMock.mockReturnValue([
      {
        details: JSON.stringify({
          schema: "some-other-schema",
          expiresAt: future,
          issuerId: "x",
          fingerprints: [],
        }),
        createdAt: new Date(),
      },
    ]);
    const res = await GET(new Request("http://x/y"));
    const body = await res.json();
    expect(body.totalActive).toBe(0);
  });
});

describe("/api/honeypot/feed — DB unavailability", () => {
  it("returns empty feed (not 500) when audit_logs throws", async () => {
    dbLimitMock.mockImplementation(() => {
      throw new Error("relation audit_logs does not exist");
    });
    const res = await GET(new Request("http://x/y"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalActive).toBe(0);
    expect(body.bulletins).toEqual([]);
  });
});

describe("/api/honeypot/feed — headers + shape contract", () => {
  it("sets open CORS for federation consumption", async () => {
    dbLimitMock.mockReturnValue([]);
    const res = await GET(new Request("http://x/y"));
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("cache-control")).toContain("max-age=60");
  });

  it("response includes generatedAt + notes documenting ethics constraints", async () => {
    dbLimitMock.mockReturnValue([]);
    const res = await GET(new Request("http://x/y"));
    const body = await res.json();
    expect(body.generatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(body.notes).toContain("TTL");
    expect(body.notes).toContain("non-PII");
  });
});

describe("/api/honeypot/feed — issuer allowlist (security review H2)", () => {
  it("drops bulletins from issuers NOT in HONEYPOT_TRUSTED_ISSUERS", async () => {
    process.env.HONEYPOT_TRUSTED_ISSUERS = "trusted";
    const future = new Date(Date.now() + 3600_000).toISOString();
    dbLimitMock.mockReturnValue([
      bulletinRow(future, "trusted"),
      bulletinRow(future, "untrusted"),
      bulletinRow(future, "evil_forgery_attempt"),
    ]);
    const res = await GET(new Request("http://x/y"));
    const body = await res.json();
    expect(body.totalActive).toBe(1);
    expect(body.bulletins[0].issuerId).toBe("trusted");
  });

  it("empty allowlist (unset) means zero bulletins trusted", async () => {
    delete process.env.HONEYPOT_TRUSTED_ISSUERS;
    const future = new Date(Date.now() + 3600_000).toISOString();
    dbLimitMock.mockReturnValue([
      bulletinRow(future, "anyone"),
      bulletinRow(future, "anyone_else"),
    ]);
    const res = await GET(new Request("http://x/y"));
    const body = await res.json();
    expect(body.totalActive).toBe(0);
  });
});

describe("/api/honeypot/feed — TTL is ENFORCED, not honor-system (M1)", () => {
  it("clamps a bulletin claiming expiry in year 2099 to createdAt + MAX_TTL_HOURS (7d)", async () => {
    process.env.HONEYPOT_TRUSTED_ISSUERS = "trusted";
    // Row was created 1 day ago. Attacker rewrote `expiresAt` to a far-
    // future date. The feed must cap the effective expiry at
    // createdAt + 7d (not honour the rewritten value).
    const createdAt = new Date(Date.now() - 24 * 3600_000);
    const farFuture = "2099-12-31T00:00:00.000Z";
    dbLimitMock.mockReturnValue([bulletinRow(farFuture, "trusted", createdAt)]);
    const res = await GET(new Request("http://x/y"));
    const body = await res.json();
    expect(body.totalActive).toBe(1);
    // Effective expiry must be createdAt + 7d (= 6 days from now), NOT
    // year 2099. Allow a 60s drift for test execution time.
    const expectedCapMs = createdAt.getTime() + 7 * 24 * 3600_000;
    const actualExpiryMs = new Date(body.bulletins[0].expiresAt).getTime();
    expect(actualExpiryMs).toBeCloseTo(expectedCapMs, -3);
    expect(body.bulletins[0].expiresAt).not.toContain("2099");
  });

  it("a row created 8 days ago is fully suppressed even with honest expiresAt", async () => {
    process.env.HONEYPOT_TRUSTED_ISSUERS = "trusted";
    // SQL-level prefilter would normally drop this; we simulate the
    // row slipping through to test the in-Node TTL cap as the second
    // line of defence.
    const createdAt = new Date(Date.now() - 8 * 24 * 3600_000);
    const futureClaim = new Date(Date.now() + 3600_000).toISOString();
    dbLimitMock.mockReturnValue([
      bulletinRow(futureClaim, "trusted", createdAt),
    ]);
    const res = await GET(new Request("http://x/y"));
    const body = await res.json();
    // createdAt + 7d is already past → activeBulletins filters it out.
    expect(body.totalActive).toBe(0);
    expect(body.totalExpiredSuppressed).toBe(1);
  });
});
