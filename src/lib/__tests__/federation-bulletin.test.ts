/**
 * Tests for src/lib/federation-bulletin.ts.
 *
 * Locks the ethics constraints into the gate:
 *   - TTL bounded (1h..7d, no permanent blacklists)
 *   - Fingerprint count bounded (no audit-row blow-up)
 *   - Signed when key configured
 *   - Cascade-surviving persistence via userId='system'
 *   - Active filtering by TTL is a HARD constraint (not a hint)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { auditLogMock, signMock, pqEnabledMock } = vi.hoisted(() => ({
  auditLogMock: vi.fn(async () => undefined),
  signMock: vi.fn<() => string | null>(() => null),
  pqEnabledMock: vi.fn(() => false),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/audit-log", () => ({
  auditLog: auditLogMock,
}));

vi.mock("@/lib/pq-sign", () => ({
  signMlDsa65: () => signMock(),
  isPqDualSignEnabled: () => pqEnabledMock(),
}));

import {
  buildBulletin,
  persistBulletin,
  activeBulletins,
  contentHashOf,
  canonicalizeBulletin,
  BULLETIN_SCHEMA,
  DEFAULT_TTL_HOURS,
  MAX_TTL_HOURS,
  MAX_FINGERPRINTS_PER_BULLETIN,
  type FederationBulletin,
} from "../federation-bulletin";
import {
  extractAttackFingerprint,
  type AttackFingerprint,
} from "../attack-fingerprint";

function fp(
  cls: AttackFingerprint["class"] = "scanner-recon",
  payload = "abc",
): AttackFingerprint {
  return extractAttackFingerprint({
    request: new Request("https://x.example.com/y", { method: "GET" }),
    attackClass: cls,
    severity: 50,
    payload,
  });
}

beforeEach(() => {
  auditLogMock.mockClear();
  signMock.mockReset();
  signMock.mockReturnValue(null);
  pqEnabledMock.mockReset();
  pqEnabledMock.mockReturnValue(false);
});

describe("buildBulletin — input validation", () => {
  it("rejects empty issuerId", () => {
    expect(() => buildBulletin({ issuerId: "", fingerprints: [fp()] })).toThrow(
      /issuerId/,
    );
    expect(() =>
      buildBulletin({ issuerId: "   ", fingerprints: [fp()] }),
    ).toThrow(/issuerId/);
  });

  it("rejects empty fingerprint list", () => {
    expect(() =>
      buildBulletin({ issuerId: "issuer", fingerprints: [] }),
    ).toThrow(/at least one/);
  });

  it("rejects fingerprint list exceeding MAX_FINGERPRINTS_PER_BULLETIN", () => {
    const fps = Array.from({ length: MAX_FINGERPRINTS_PER_BULLETIN + 1 }, () =>
      fp(),
    );
    expect(() =>
      buildBulletin({ issuerId: "issuer", fingerprints: fps }),
    ).toThrow(/exceeds MAX/);
  });
});

describe("buildBulletin — TTL bounds (ethics gate)", () => {
  it("defaults to DEFAULT_TTL_HOURS=24h", () => {
    const b = buildBulletin({ issuerId: "x", fingerprints: [fp()] });
    const diffMs =
      new Date(b.expiresAt).getTime() - new Date(b.issuedAt).getTime();
    expect(diffMs).toBeCloseTo(DEFAULT_TTL_HOURS * 3600 * 1000, -3);
  });

  it("clamps TTL to MAX_TTL_HOURS=7d (no permanent blacklists)", () => {
    const b = buildBulletin({
      issuerId: "x",
      fingerprints: [fp()],
      ttlHours: 10_000, // 416 days — must clamp
    });
    const diffMs =
      new Date(b.expiresAt).getTime() - new Date(b.issuedAt).getTime();
    expect(diffMs).toBeCloseTo(MAX_TTL_HOURS * 3600 * 1000, -3);
  });

  it("clamps TTL to at least 1 hour", () => {
    const b = buildBulletin({
      issuerId: "x",
      fingerprints: [fp()],
      ttlHours: 0,
    });
    const diffMs =
      new Date(b.expiresAt).getTime() - new Date(b.issuedAt).getTime();
    expect(diffMs).toBeCloseTo(3600 * 1000, -3);
  });
});

describe("buildBulletin — content + signing", () => {
  it("sets schema + issuerId + sorted contentHash", () => {
    const fps = [fp("scanner-recon"), fp("jailbreak-prompt", "different")];
    const b = buildBulletin({ issuerId: "myissuer", fingerprints: fps });
    expect(b.schema).toBe(BULLETIN_SCHEMA);
    expect(b.issuerId).toBe("myissuer");
    expect(b.contentHash).toBe(contentHashOf(fps));
  });

  it("contentHash is order-independent (sorted by fingerprintId)", () => {
    const a = fp("scanner-recon", "x");
    const b = fp("jailbreak-prompt", "y");
    expect(contentHashOf([a, b])).toBe(contentHashOf([b, a]));
  });

  it("attaches ML-DSA-65 sig when key configured", () => {
    signMock.mockReturnValueOnce("base64sig==");
    pqEnabledMock.mockReturnValue(true);
    const b = buildBulletin({ issuerId: "x", fingerprints: [fp()] });
    expect(b.mldsa65Sig).toBe("base64sig==");
    expect(b.pqEnabled).toBe(true);
  });

  it("mldsa65Sig is null when no key configured (graceful)", () => {
    const b = buildBulletin({ issuerId: "x", fingerprints: [fp()] });
    expect(b.mldsa65Sig).toBeNull();
    expect(b.pqEnabled).toBe(false);
  });
});

describe("canonicalizeBulletin — fixed projection", () => {
  it("produces deterministic bytes (sorted fingerprints — same issuedAt)", () => {
    // Build a single bulletin, then re-canonicalise it with the
    // fingerprint order reversed. Reusing the same bulletin object
    // pins issuedAt/expiresAt to the same millisecond — the prior
    // test built two bulletins which sometimes landed in different
    // milliseconds and produced a flaky byte mismatch unrelated to
    // the sort-order invariant we actually care about.
    const a = fp("scanner-recon", "a");
    const c = fp("jailbreak-prompt", "c");
    const b1 = buildBulletin({ issuerId: "x", fingerprints: [a, c] });
    const b2 = {
      ...b1,
      fingerprints: [...b1.fingerprints].reverse(),
    };
    expect(canonicalizeBulletin(b1)).toBe(canonicalizeBulletin(b2));
  });
});

describe("persistBulletin — cascade-surviving persistence", () => {
  it("writes audit row with userId='system' and action='honeypot.bulletin'", async () => {
    const b = buildBulletin({ issuerId: "issuer_1", fingerprints: [fp()] });
    const r = await persistBulletin(b);
    expect(r.persisted).toBe(true);
    expect(r.bulletinId).toBe(`issuer_1:${b.contentHash}`);

    const entry = auditLogMock.mock.calls[0][0] as {
      userId: string;
      action: string;
      resource: string;
    };
    expect(entry.userId).toBe("system");
    expect(entry.action).toBe("honeypot.bulletin");
    expect(entry.resource).toContain("bulletin:issuer_1:");
  });

  it("returns persisted=false but does NOT throw when audit write fails", async () => {
    auditLogMock.mockRejectedValueOnce(new Error("db down"));
    const b = buildBulletin({ issuerId: "x", fingerprints: [fp()] });
    const r = await persistBulletin(b);
    expect(r.persisted).toBe(false);
  });
});

describe("activeBulletins — TTL filtering is a HARD gate", () => {
  function bull(expiresAtIso: string): FederationBulletin {
    return {
      schema: BULLETIN_SCHEMA,
      issuedAt: "2026-05-19T00:00:00.000Z",
      expiresAt: expiresAtIso,
      issuerId: "x",
      fingerprints: [fp()],
      contentHash: "h".repeat(64),
      mldsa65Sig: null,
      pqEnabled: false,
    };
  }

  it("filters out expired bulletins (no stale signatures served)", () => {
    const now = new Date("2026-05-19T12:00:00.000Z");
    const a = bull("2026-05-19T11:59:00.000Z"); // 1 min expired
    const b = bull("2026-05-19T13:00:00.000Z"); // 1h active
    const c = bull("2026-05-12T00:00:00.000Z"); // 7d expired
    expect(activeBulletins([a, b, c], now)).toEqual([b]);
  });

  it("returns empty list when all expired", () => {
    const now = new Date("2026-05-19T12:00:00.000Z");
    const a = bull("2026-05-19T11:00:00.000Z");
    expect(activeBulletins([a], now)).toEqual([]);
  });
});
