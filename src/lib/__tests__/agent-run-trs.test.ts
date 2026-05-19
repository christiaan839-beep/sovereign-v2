/**
 * Tests for src/lib/agent-run-trs.ts.
 *
 * The module wires threshold signing onto recordRun's hot path. It
 * MUST:
 *   - degrade silently when threshold is not configured (no audit row,
 *     no log warn) — the v2 receipt path must be unaffected
 *   - persist a TRS attestation to audit_logs when configured
 *   - never throw (the caller is fire-and-forget)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { auditLogMock, isEnabledMock, signMock } = vi.hoisted(() => ({
  auditLogMock: vi.fn(async () => undefined),
  isEnabledMock: vi.fn(() => false),
  signMock: vi.fn(() => null as ReturnType<typeof signRet> | null),
}));

type signRet = {
  attestation: {
    scheme: "trs1";
    canonical: string;
    contentHash: string;
    threshold: { m: number; n: number };
    authorizedIssuers: string[];
    cosigners: Array<{ issuerId: string; signature: string }>;
    assembledAt: string;
  };
  quorumMet: boolean;
  localContributions: string[];
};

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/audit-log", () => ({
  auditLog: auditLogMock,
}));

vi.mock("@/lib/threshold-signer", () => ({
  isThresholdEnabled: () => isEnabledMock(),
  signThreshold: () => signMock(),
}));

import { persistRunTrsAttestation } from "../agent-run-trs";

function fakeSignResult(): signRet {
  return {
    attestation: {
      scheme: "trs1",
      canonical: "<canonical-bytes>",
      contentHash: "a".repeat(64),
      threshold: { m: 2, n: 4 },
      authorizedIssuers: ["sovereign-prod", "w1", "w2", "w3"],
      cosigners: [
        { issuerId: "sovereign-prod", signature: "v2=AAA" },
        { issuerId: "w1", signature: "v2=BBB" },
      ],
      assembledAt: "2026-05-19T00:00:00.000Z",
    },
    quorumMet: true,
    localContributions: ["sovereign-prod"],
  };
}

beforeEach(() => {
  auditLogMock.mockClear();
  isEnabledMock.mockReset();
  isEnabledMock.mockReturnValue(false);
  signMock.mockReset();
  signMock.mockReturnValue(null);
});

describe("persistRunTrsAttestation — disabled path", () => {
  it("does NOTHING when threshold signing is not configured", async () => {
    const r = await persistRunTrsAttestation({
      receiptId: "00000000-0000-0000-0000-000000000001",
      canonical: "x",
    });
    expect(r.persisted).toBe(false);
    expect(r.quorumMet).toBe(false);
    expect(r.localContributions).toEqual([]);
    // No audit row, no signing call — pure short-circuit.
    expect(auditLogMock).not.toHaveBeenCalled();
    expect(signMock).not.toHaveBeenCalled();
  });
});

describe("persistRunTrsAttestation — enabled path", () => {
  beforeEach(() => {
    isEnabledMock.mockReturnValue(true);
    signMock.mockReturnValue(fakeSignResult());
  });

  it("persists a trs.attestation audit row bound to the receipt id", async () => {
    const r = await persistRunTrsAttestation({
      receiptId: "00000000-0000-0000-0000-000000000abc",
      canonical: "<canonical-bytes>",
      tenantId: "tenant_1",
    });
    expect(r.persisted).toBe(true);
    expect(r.quorumMet).toBe(true);
    expect(r.localContributions).toEqual(["sovereign-prod"]);

    expect(auditLogMock).toHaveBeenCalledTimes(1);
    const entry = auditLogMock.mock.calls[0][0] as {
      userId: string;
      action: string;
      resource: string;
      details: Record<string, unknown>;
    };
    expect(entry.action).toBe("trs.attestation");
    expect(entry.resource).toBe(
      "agent_run:00000000-0000-0000-0000-000000000abc",
    );
    expect(entry.userId).toBe("system");
    expect(entry.details.schema).toBe("trs1");
    expect(entry.details.canonicalHash).toBe("a".repeat(64));
    expect(entry.details.quorumMet).toBe(true);
  });

  it("returns persisted=false but does NOT throw when audit write fails", async () => {
    auditLogMock.mockRejectedValueOnce(new Error("db down"));
    const r = await persistRunTrsAttestation({
      receiptId: "00000000-0000-0000-0000-000000000aaa",
      canonical: "x",
    });
    expect(r.persisted).toBe(false);
    // The signing itself succeeded — quorum + contributions reflect that.
    expect(r.quorumMet).toBe(true);
    expect(r.localContributions).toEqual(["sovereign-prod"]);
  });

  it("returns persisted=false when signThreshold throws", async () => {
    signMock.mockImplementationOnce(() => {
      throw new Error("key file missing");
    });
    const r = await persistRunTrsAttestation({
      receiptId: "00000000-0000-0000-0000-000000000bbb",
      canonical: "x",
    });
    expect(r.persisted).toBe(false);
    expect(auditLogMock).not.toHaveBeenCalled();
  });

  it("returns persisted=false when signThreshold returns null (env race)", async () => {
    signMock.mockReturnValueOnce(null);
    const r = await persistRunTrsAttestation({
      receiptId: "00000000-0000-0000-0000-000000000ccc",
      canonical: "x",
    });
    expect(r.persisted).toBe(false);
    expect(auditLogMock).not.toHaveBeenCalled();
  });

  it("records quorumMet=false when only one cosigner is present", async () => {
    const partial = fakeSignResult();
    partial.quorumMet = false;
    partial.attestation.cosigners = [
      { issuerId: "sovereign-prod", signature: "v2=AAA" },
    ];
    signMock.mockReturnValueOnce(partial);

    const r = await persistRunTrsAttestation({
      receiptId: "00000000-0000-0000-0000-000000000ddd",
      canonical: "x",
    });
    expect(r.persisted).toBe(true);
    expect(r.quorumMet).toBe(false);
    const details = auditLogMock.mock.calls[0][0].details as Record<
      string,
      unknown
    >;
    expect(details.quorumMet).toBe(false);
  });
});
