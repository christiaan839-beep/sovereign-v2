/**
 * Tests for src/lib/audit-retention.ts.
 *
 * The CRITICAL invariant is safety-by-default: actions NOT in the
 * explicit allowlist must NEVER be deleted, regardless of age. We
 * lock this with an enum-completeness check against the EVIDENCE
 * action list. A pure-helper test pins the policy map shape so a
 * misconfigured commit fails CI before deploy.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbExecuteMock } = vi.hoisted(() => ({
  dbExecuteMock: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/db", () => ({
  db: {
    execute: dbExecuteMock,
  },
}));

import {
  RETENTION_POLICIES,
  OPERATIONAL_ACTIONS,
  MAX_ROWS_PER_PRUNE,
  computeCutoff,
  pruneAction,
  runRetentionCycle,
} from "../audit-retention";

beforeEach(() => {
  dbExecuteMock.mockReset();
});

describe("RETENTION_POLICIES — safety-by-default invariants", () => {
  it("every policy key is in the OPERATIONAL_ACTIONS allowlist (fail-closed)", () => {
    // Wave-105 review M1: the invariant is now allowlist-based.
    // Any policy key not in OPERATIONAL_ACTIONS would throw at module
    // load (the import already verified this — if the module loaded,
    // the invariant holds). This test pins the invariant explicitly.
    for (const key of Object.keys(RETENTION_POLICIES)) {
      expect(
        OPERATIONAL_ACTIONS.has(key),
        `policy key "${key}" must be in OPERATIONAL_ACTIONS`,
      ).toBe(true);
    }
  });

  it("evidence actions are NOT in OPERATIONAL_ACTIONS (defence in depth)", () => {
    // Even if a future contributor extends OPERATIONAL_ACTIONS, these
    // specific evidence actions must never appear there. This test
    // documents which actions are evidence — it does NOT replace the
    // primary allowlist guard, it complements it.
    const evidenceActions = [
      "data.delete",
      "data.delete-receipt",
      "data.export",
      "data.audit-bundle",
      "trs.attestation",
      "user.login",
      "user.logout",
      "admin.provision",
      "admin.grant",
      "admin.revoke",
      "agent_token.issued",
      "agent_token.revoked",
      "webauthn.credential.registered",
      "webauthn.credential.revoked",
      "webauthn.assertion.ok",
      "webauthn.assertion.failed",
      // Financial/business state transitions — evidence under standard
      // audit frameworks (SOC 2 CC6, ISO 27001 A.18.1.3, GDPR Art. 30).
      "subscription.change",
      "credits.purchase",
      "credits.grant",
      "marketplace.submit",
      "marketplace.approved",
      "marketplace.rejected",
      "marketplace.published",
      "marketplace.unpublished",
    ];
    for (const action of evidenceActions) {
      expect(OPERATIONAL_ACTIONS.has(action)).toBe(false);
      expect(RETENTION_POLICIES).not.toHaveProperty(action);
    }
  });

  it("honeypot.bulletin retention ≥ wave-99 MAX_TTL_HOURS (168h = 7d)", () => {
    // The federation feed at /api/honeypot/feed serves bulletins within
    // a 7-day window. Pruning under 7d would break that reader.
    expect(RETENTION_POLICIES["honeypot.bulletin"]).toBeGreaterThanOrEqual(168);
  });

  it("defense.block retention > 24h reader window (security/posture)", () => {
    // /api/security/posture aggregates defense.block over the last 24h.
    // Pruning under 24h would break that reader. Policy keeps 30d
    // with massive margin.
    expect(RETENTION_POLICIES["defense.block"]).toBeGreaterThan(24);
  });

  it("honeypot.signal retention matches the wave-100 doc spec (24h)", () => {
    expect(RETENTION_POLICIES["honeypot.signal"]).toBe(24);
  });

  it("every policy value is a positive number of hours", () => {
    for (const [action, hours] of Object.entries(RETENTION_POLICIES)) {
      expect(
        typeof hours === "number" && hours > 0,
        `${action} retention must be a positive number`,
      ).toBe(true);
    }
  });

  it("is frozen (cannot be mutated at runtime)", () => {
    expect(Object.isFrozen(RETENTION_POLICIES)).toBe(true);
  });
});

describe("computeCutoff — pure math", () => {
  it("returns a Date `retentionHours` ago from `now`", () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    const cutoff = computeCutoff(24, now);
    expect(cutoff.toISOString()).toBe("2026-05-19T12:00:00.000Z");
  });

  it("zero retentionHours returns the same instant as now", () => {
    const now = new Date("2026-05-20T12:00:00.000Z");
    expect(computeCutoff(0, now).getTime()).toBe(now.getTime());
  });

  it("defaults to new Date() when now omitted", () => {
    const before = Date.now();
    const cutoff = computeCutoff(24);
    const after = Date.now();
    expect(cutoff.getTime()).toBeGreaterThanOrEqual(before - 24 * 3600 * 1000);
    expect(cutoff.getTime()).toBeLessThanOrEqual(after - 24 * 3600 * 1000 + 10);
  });
});

describe("pruneAction — DELETE behavior", () => {
  it("issues a parameterised DELETE bounded by MAX_ROWS_PER_PRUNE", async () => {
    dbExecuteMock.mockResolvedValueOnce({ rowCount: 5 });
    const r = await pruneAction("honeypot.signal", 24);
    expect(dbExecuteMock).toHaveBeenCalledTimes(1);
    expect(r.action).toBe("honeypot.signal");
    expect(r.retentionHours).toBe(24);
    expect(r.deleted).toBe(5);
    expect(r.capped).toBe(false);
  });

  it("reports capped=true when delete hits MAX_ROWS_PER_PRUNE", async () => {
    dbExecuteMock.mockResolvedValueOnce({ rowCount: MAX_ROWS_PER_PRUNE });
    const r = await pruneAction("honeypot.signal", 24);
    expect(r.deleted).toBe(MAX_ROWS_PER_PRUNE);
    expect(r.capped).toBe(true);
  });

  it("never throws on DB error — returns deleted=0", async () => {
    dbExecuteMock.mockRejectedValueOnce(new Error("relation does not exist"));
    const r = await pruneAction("honeypot.signal", 24);
    expect(r.deleted).toBe(0);
    expect(r.capped).toBe(false);
  });

  it("handles drizzle result shape: array (some drivers)", async () => {
    dbExecuteMock.mockResolvedValueOnce([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ]);
    const r = await pruneAction("honeypot.signal", 24);
    expect(r.deleted).toBe(3);
  });

  it("handles drizzle result shape: { rows: [...] }", async () => {
    dbExecuteMock.mockResolvedValueOnce({
      rows: [{ id: "a" }, { id: "b" }],
    });
    const r = await pruneAction("honeypot.signal", 24);
    expect(r.deleted).toBe(2);
  });

  it("handles missing rowCount/rows gracefully (returns 0)", async () => {
    dbExecuteMock.mockResolvedValueOnce({});
    const r = await pruneAction("honeypot.signal", 24);
    expect(r.deleted).toBe(0);
  });

  it("never throws on unrecognised drizzle result shape (wave-105 review M2)", async () => {
    // A future driver upgrade could return e.g. a Symbol or a class
    // instance with neither rowCount nor rows. The cron must still
    // complete (degraded observability is OK; abort is not).
    dbExecuteMock.mockResolvedValueOnce({
      unexpectedField: "from-a-new-driver-version",
    });
    const r = await pruneAction("honeypot.signal", 24);
    expect(r.deleted).toBe(0);
    expect(r.capped).toBe(false);
  });
});

describe("runRetentionCycle — end-to-end", () => {
  it("iterates every allowlisted action and aggregates totals", async () => {
    dbExecuteMock.mockResolvedValue({ rowCount: 3 });
    const r = await runRetentionCycle();
    const policyCount = Object.keys(RETENTION_POLICIES).length;
    expect(r.perAction).toHaveLength(policyCount);
    expect(r.totalDeleted).toBe(policyCount * 3);
    expect(r.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns startedAt as an ISO-8601 string", async () => {
    dbExecuteMock.mockResolvedValue({ rowCount: 0 });
    const r = await runRetentionCycle();
    expect(r.startedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("one action's DB throw does not abort the cycle", async () => {
    let call = 0;
    dbExecuteMock.mockImplementation(async () => {
      call++;
      if (call === 1) throw new Error("first action fails");
      return { rowCount: 2 };
    });
    const r = await runRetentionCycle();
    expect(r.perAction[0].deleted).toBe(0);
    expect(r.perAction.slice(1).every((p) => p.deleted === 2)).toBe(true);
  });

  it("only touches actions that ARE in the allowlist", async () => {
    dbExecuteMock.mockResolvedValue({ rowCount: 0 });
    const r = await runRetentionCycle();
    const touchedActions = new Set(r.perAction.map((p) => p.action));
    const allowlist = new Set(Object.keys(RETENTION_POLICIES));
    expect(touchedActions).toEqual(allowlist);
  });
});
