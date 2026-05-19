/**
 * Tests for src/lib/honeypot-emitter.ts.
 *
 * The safeguards documented in wave 100 must be enforced by failing
 * tests, not docs:
 *   - Default OFF (HONEYPOT_AUTO_EMIT)
 *   - Severity ≥ 80 threshold
 *   - MIN_DISTINCT_SOURCES=3 (one operator can't poison the federation)
 *   - Dedup by fingerprintId
 *   - SIGNAL_RETENTION_HOURS=24 — stale signals dropped
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { auditLogMock, persistBulletinMock, signMock, pqEnabledMock } =
  vi.hoisted(() => ({
    auditLogMock: vi.fn(async () => undefined),
    persistBulletinMock: vi.fn(async () => ({
      persisted: true,
      bulletinId: "issuer:c".repeat(8),
    })),
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

// Intercept persistBulletin so the flush test doesn't hit auditLog again.
vi.mock("@/lib/federation-bulletin", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/federation-bulletin")
  >("@/lib/federation-bulletin");
  return {
    ...actual,
    persistBulletin: persistBulletinMock,
  };
});

import {
  recordHoneypotSignal,
  aggregateSignals,
  filterFreshSignals,
  flushHoneypotBulletin,
  isAutoEmitEnabled,
  FEDERATION_SEVERITY_THRESHOLD,
  MIN_DISTINCT_SOURCES,
  SIGNAL_RETENTION_HOURS,
  type SignalRecord,
} from "../honeypot-emitter";
import {
  extractAttackFingerprint,
  fingerprintId,
  type AttackFingerprint,
} from "../attack-fingerprint";

function fp(
  payload = "default",
  severity = 90,
  cls: AttackFingerprint["class"] = "jailbreak-prompt",
): AttackFingerprint {
  return extractAttackFingerprint({
    request: new Request("https://x.com/y", { method: "POST" }),
    attackClass: cls,
    severity,
    payload,
  });
}

const originalEnv = process.env.HONEYPOT_AUTO_EMIT;

beforeEach(() => {
  auditLogMock.mockClear();
  persistBulletinMock.mockClear();
  signMock.mockReset();
  signMock.mockReturnValue(null);
  pqEnabledMock.mockReset();
  pqEnabledMock.mockReturnValue(false);
  delete process.env.HONEYPOT_AUTO_EMIT;
});

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env.HONEYPOT_AUTO_EMIT;
  } else {
    process.env.HONEYPOT_AUTO_EMIT = originalEnv;
  }
});

describe("isAutoEmitEnabled — default-off gate", () => {
  it("returns false when env unset", () => {
    expect(isAutoEmitEnabled()).toBe(false);
  });
  it("returns false when env is anything other than 'true'", () => {
    process.env.HONEYPOT_AUTO_EMIT = "1";
    expect(isAutoEmitEnabled()).toBe(false);
    process.env.HONEYPOT_AUTO_EMIT = "yes";
    expect(isAutoEmitEnabled()).toBe(false);
  });
  it("returns true ONLY for exact 'true'", () => {
    process.env.HONEYPOT_AUTO_EMIT = "true";
    expect(isAutoEmitEnabled()).toBe(true);
  });
});

describe("recordHoneypotSignal — gating", () => {
  it("NO-OPs when HONEYPOT_AUTO_EMIT is unset (default)", async () => {
    await recordHoneypotSignal({
      fingerprint: fp("x", 95),
      source: { kind: "tenant", tenantId: "src1" },
    });
    expect(auditLogMock).not.toHaveBeenCalled();
  });

  it("NO-OPs when severity below FEDERATION_SEVERITY_THRESHOLD (80)", async () => {
    process.env.HONEYPOT_AUTO_EMIT = "true";
    await recordHoneypotSignal({
      fingerprint: fp("x", FEDERATION_SEVERITY_THRESHOLD - 1),
      source: { kind: "tenant", tenantId: "src1" },
    });
    expect(auditLogMock).not.toHaveBeenCalled();
  });

  it("emits signal when enabled AND severity ≥ threshold", async () => {
    process.env.HONEYPOT_AUTO_EMIT = "true";
    await recordHoneypotSignal({
      fingerprint: fp("x", 95),
      source: { kind: "tenant", tenantId: "src1" },
    });
    expect(auditLogMock).toHaveBeenCalledTimes(1);
    const entry = auditLogMock.mock.calls[0][0] as {
      userId: string;
      action: string;
      resource: string;
      details: Record<string, unknown>;
    };
    expect(entry.userId).toBe("system");
    expect(entry.action).toBe("honeypot.signal");
    expect(entry.resource).toMatch(/^signal:[a-f0-9]{16}$/);
    expect(entry.details.fingerprint).toBeTruthy();
    expect(entry.details.sourceHash).toMatch(/^[a-f0-9]{16}$/);
  });

  it("hashes server-trusted source — never persists raw identifier", async () => {
    process.env.HONEYPOT_AUTO_EMIT = "true";
    await recordHoneypotSignal({
      fingerprint: fp("x", 95),
      source: { kind: "tenant", tenantId: "tenant_abc_secret_id" },
    });
    const entry = auditLogMock.mock.calls[0][0] as {
      details: Record<string, unknown>;
    };
    const serialized = JSON.stringify(entry.details);
    expect(serialized).not.toContain("tenant_abc_secret_id");
  });

  it("different source KINDS with same value produce different hashes (kind-binding)", async () => {
    process.env.HONEYPOT_AUTO_EMIT = "true";
    await recordHoneypotSignal({
      fingerprint: fp("x", 95),
      source: { kind: "tenant", tenantId: "same-value" },
    });
    const tenantHash = (
      auditLogMock.mock.calls[0][0] as {
        details: { sourceHash: string };
      }
    ).details.sourceHash;

    auditLogMock.mockClear();
    await recordHoneypotSignal({
      fingerprint: fp("x", 95),
      source: { kind: "route", routeId: "same-value" },
    });
    const routeHash = (
      auditLogMock.mock.calls[0][0] as {
        details: { sourceHash: string };
      }
    ).details.sourceHash;

    // Same value under different kinds must NOT collide — otherwise
    // a "tenant_42" attack and a "route_42" attack would count toward
    // the same source-distinct threshold.
    expect(tenantHash).not.toBe(routeHash);
  });

  it("never throws when auditLog rejects", async () => {
    process.env.HONEYPOT_AUTO_EMIT = "true";
    auditLogMock.mockRejectedValueOnce(new Error("db down"));
    await expect(
      recordHoneypotSignal({
        fingerprint: fp("x", 95),
        source: { kind: "tenant", tenantId: "src1" },
      }),
    ).resolves.toBeUndefined();
  });
});

describe("aggregateSignals — distinct-source threshold (MIN_DISTINCT_SOURCES=3)", () => {
  function rec(
    fingerprint: AttackFingerprint,
    sourceHash: string,
  ): SignalRecord {
    return {
      fingerprint,
      fingerprintId: fingerprintId(fingerprint),
      sourceHash,
    };
  }

  it("drops fingerprints seen by < MIN_DISTINCT_SOURCES sources", () => {
    const a = fp("attack-a", 95);
    // Only 2 sources — below threshold.
    const out = aggregateSignals([
      rec(a, "src1"),
      rec(a, "src2"),
      rec(a, "src1"), // duplicate same source — doesn't count toward distinct
    ]);
    expect(out).toEqual([]);
  });

  it("includes fingerprints seen by ≥ MIN_DISTINCT_SOURCES sources", () => {
    const a = fp("attack-a", 95);
    const out = aggregateSignals([
      rec(a, "src1"),
      rec(a, "src2"),
      rec(a, "src3"),
    ]);
    expect(out).toHaveLength(1);
  });

  it("dedup is per-fingerprintId — different fingerprints don't collapse", () => {
    const a = fp("attack-a", 95);
    const b = fp("attack-b", 95, "ssrf-probe");
    const out = aggregateSignals([
      rec(a, "src1"),
      rec(a, "src2"),
      rec(a, "src3"),
      rec(b, "src1"),
      rec(b, "src2"),
      rec(b, "src3"),
    ]);
    expect(out).toHaveLength(2);
  });

  it("sorts by severity descending (higher-confidence first)", () => {
    const lower = fp("a", 80);
    const higher = fp("b", 95);
    const out = aggregateSignals([
      ...[1, 2, 3].map((i) => ({
        fingerprint: lower,
        fingerprintId: fingerprintId(lower),
        sourceHash: `src_low_${i}`,
      })),
      ...[1, 2, 3].map((i) => ({
        fingerprint: higher,
        fingerprintId: fingerprintId(higher),
        sourceHash: `src_high_${i}`,
      })),
    ]);
    expect(out[0].severity).toBe(95);
    expect(out[1].severity).toBe(80);
  });
});

describe("filterFreshSignals — retention enforcement", () => {
  it("drops signals older than SIGNAL_RETENTION_HOURS", () => {
    const now = new Date("2026-05-19T12:00:00.000Z");
    const a = fp("a", 95);
    const fresh = {
      fingerprint: a,
      fingerprintId: fingerprintId(a),
      sourceHash: "s1",
      ts: new Date(now.getTime() - 3600 * 1000).toISOString(),
    };
    const stale = {
      fingerprint: a,
      fingerprintId: fingerprintId(a),
      sourceHash: "s2",
      ts: new Date(
        now.getTime() - (SIGNAL_RETENTION_HOURS + 1) * 3600 * 1000,
      ).toISOString(),
    };
    const out = filterFreshSignals([fresh, stale], now);
    expect(out).toHaveLength(1);
    expect(out[0].sourceHash).toBe("s1");
  });
});

describe("flushHoneypotBulletin — end-to-end", () => {
  function makeRec(
    fingerprint: AttackFingerprint,
    sourceHash: string,
    tsOffsetSec = 0,
  ) {
    return {
      fingerprint,
      fingerprintId: fingerprintId(fingerprint),
      sourceHash,
      ts: new Date(Date.now() + tsOffsetSec * 1000).toISOString(),
    };
  }

  it("publishes a bulletin when fingerprints meet the threshold", async () => {
    const a = fp("a", 95);
    const records = [
      makeRec(a, "src1"),
      makeRec(a, "src2"),
      makeRec(a, "src3"),
    ];
    const result = await flushHoneypotBulletin(records, "test-issuer");
    expect(result.signalsRead).toBe(3);
    expect(result.fingerprintsAfterAggregate).toBe(1);
    expect(result.bulletinPublished).toBe(true);
    expect(persistBulletinMock).toHaveBeenCalledTimes(1);
  });

  it("produces NO bulletin when no fingerprints qualify", async () => {
    const a = fp("a", 95);
    // Only 2 distinct sources — below MIN_DISTINCT_SOURCES (3).
    const records = [makeRec(a, "src1"), makeRec(a, "src2")];
    const result = await flushHoneypotBulletin(records, "test-issuer");
    expect(result.fingerprintsAfterAggregate).toBe(0);
    expect(result.bulletinPublished).toBe(false);
    expect(persistBulletinMock).not.toHaveBeenCalled();
  });

  it("filters stale records before aggregation", async () => {
    const a = fp("a", 95);
    // 3 distinct sources BUT all stale — must be filtered out first,
    // then aggregateSignals sees zero, no bulletin.
    const stale = (s: string) =>
      makeRec(a, s, -(SIGNAL_RETENTION_HOURS + 1) * 3600);
    const result = await flushHoneypotBulletin(
      [stale("s1"), stale("s2"), stale("s3")],
      "test-issuer",
    );
    expect(result.fingerprintsAfterAggregate).toBe(0);
    expect(result.bulletinPublished).toBe(false);
  });

  it("constants are within documented bounds", () => {
    expect(FEDERATION_SEVERITY_THRESHOLD).toBe(80);
    expect(MIN_DISTINCT_SOURCES).toBe(3);
    expect(SIGNAL_RETENTION_HOURS).toBe(24);
  });
});
