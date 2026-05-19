/**
 * Tests for src/lib/capability-receipts.ts.
 *
 * Mirrors the structure of defense-receipts.test.ts. We mock auditLog
 * + pq-sign so we can assert the SHAPE of what gets written and signed
 * without needing real keys or a live DB.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { auditLogMock, signMock, pqEnabledMock } = vi.hoisted(() => ({
  auditLogMock: vi.fn(async () => undefined),
  signMock: vi.fn<() => string | null>(() => null),
  pqEnabledMock: vi.fn(() => false),
}));

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

vi.mock("@/lib/pq-sign", () => ({
  signMlDsa65: (...args: unknown[]) => signMock(...args),
  isPqDualSignEnabled: () => pqEnabledMock(),
}));

import {
  emitCapabilityReceipt,
  canonicalizeCapabilityReceipt,
  commit,
  CAPABILITY_RECEIPT_SCHEMA,
} from "../capability-receipts";

beforeEach(() => {
  auditLogMock.mockClear();
  signMock.mockReset();
  signMock.mockReturnValue(null);
  pqEnabledMock.mockReset();
  pqEnabledMock.mockReturnValue(false);
});

describe("commit", () => {
  it("produces a 64-char hex SHA-256", () => {
    expect(commit("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("differs across inputs", () => {
    expect(commit("a")).not.toBe(commit("b"));
  });
});

describe("canonicalizeCapabilityReceipt", () => {
  it("emits a fixed key order — never depends on insertion order", () => {
    const c = canonicalizeCapabilityReceipt({
      schema: CAPABILITY_RECEIPT_SCHEMA,
      ts: "2026-01-01T00:00:00.000Z",
      ruleId: "x",
      kind: "fetch",
      outcome: "allowed",
      summary: "ok",
      commitments: { z: "1", a: "2" },
      durationMs: 10,
      responseBytes: 100,
      policyMode: "allowlist",
      tenantId: null,
      userId: null,
    });
    expect(c.indexOf('"schema"')).toBeLessThan(c.indexOf('"ts"'));
    // commitments keys sorted alphabetically.
    expect(c.indexOf('"a":"2"')).toBeLessThan(c.indexOf('"z":"1"'));
  });

  it("is byte-identical for the same logical receipt", () => {
    const r = {
      schema: CAPABILITY_RECEIPT_SCHEMA as typeof CAPABILITY_RECEIPT_SCHEMA,
      ts: "2026-01-01T00:00:00.000Z",
      ruleId: "x",
      kind: "fetch" as const,
      outcome: "allowed" as const,
      summary: "ok",
      commitments: { a: "1" },
      durationMs: 5,
      responseBytes: 50,
      policyMode: "allowlist",
      tenantId: null,
      userId: null,
    };
    expect(canonicalizeCapabilityReceipt(r)).toBe(
      canonicalizeCapabilityReceipt(r),
    );
  });
});

describe("emitCapabilityReceipt", () => {
  it("writes audit_logs row with action='capability.invoke'", async () => {
    await emitCapabilityReceipt({
      ruleId: "agent.research-fetch",
      kind: "fetch",
      outcome: "allowed",
      summary: "GET wikipedia.org → 200 (4.2KB)",
      sensitive: { url: "https://en.wikipedia.org/wiki/AI" },
      policyMode: "allowlist",
      tenantId: "tenant_1",
      userId: "user_1",
      durationMs: 312,
      responseBytes: 4200,
    });
    expect(auditLogMock).toHaveBeenCalledTimes(1);
    const entry = auditLogMock.mock.calls[0][0] as {
      userId: string;
      action: string;
      resource: string;
      details: Record<string, unknown>;
    };
    expect(entry.action).toBe("capability.invoke");
    expect(entry.resource).toBe("fetch:agent.research-fetch");
    expect(entry.userId).toBe("user_1");
    expect(entry.details.schema).toBe(CAPABILITY_RECEIPT_SCHEMA);
    expect(entry.details.outcome).toBe("allowed");
  });

  it("hashes sensitive identifiers — never stores raw URL", async () => {
    const url = "https://api.openai.com/v1/chat?token=secret-do-not-leak";
    const r = await emitCapabilityReceipt({
      ruleId: "agent.llm-call",
      kind: "external-api",
      outcome: "allowed",
      summary: "POST openai.com",
      sensitive: { url },
    });
    // Receipt commitment is the hash, not the raw URL.
    expect(r.commitments.url).toBe(commit(url));
    // Audit row also contains only the hash.
    const details = auditLogMock.mock.calls[0][0].details as Record<
      string,
      unknown
    >;
    const json = JSON.stringify(details);
    expect(json).not.toContain("secret-do-not-leak");
    expect(json).not.toContain("api.openai.com/v1/chat");
  });

  it("merges sensitive + commitments inputs", async () => {
    const r = await emitCapabilityReceipt({
      ruleId: "x",
      kind: "fetch",
      outcome: "allowed",
      summary: "x",
      sensitive: { url: "https://x.com" },
      commitments: { precomputed: "abc123" },
    });
    expect(r.commitments.url).toBe(commit("https://x.com"));
    expect(r.commitments.precomputed).toBe("abc123");
  });

  it("normalises invalid durationMs / responseBytes to null", async () => {
    const r = await emitCapabilityReceipt({
      ruleId: "x",
      kind: "fetch",
      outcome: "allowed",
      summary: "x",
      durationMs: NaN,
      responseBytes: -1,
    });
    expect(r.durationMs).toBeNull();
    // -1 clamps to 0 (Math.max(0, ...))
    expect(r.responseBytes).toBe(0);
  });

  it("records mldsa65Sig when signing key is configured", async () => {
    signMock.mockReturnValueOnce("base64Sig==");
    pqEnabledMock.mockReturnValue(true);
    const r = await emitCapabilityReceipt({
      ruleId: "x",
      kind: "fetch",
      outcome: "allowed",
      summary: "x",
    });
    expect(r.mldsa65Sig).toBe("base64Sig==");
    expect(r.pqEnabled).toBe(true);
    const canonicalArg = signMock.mock.calls[0][0] as string;
    expect(canonicalArg).toContain(`"schema":"${CAPABILITY_RECEIPT_SCHEMA}"`);
    expect(canonicalArg).toContain('"kind":"fetch"');
  });

  it("never throws when auditLog rejects", async () => {
    auditLogMock.mockRejectedValueOnce(new Error("db down"));
    await expect(
      emitCapabilityReceipt({
        ruleId: "x",
        kind: "fetch",
        outcome: "allowed",
        summary: "x",
      }),
    ).resolves.toBeDefined();
  });

  it("never throws when sign throws", async () => {
    signMock.mockImplementationOnce(() => {
      throw new Error("key file missing");
    });
    await expect(
      emitCapabilityReceipt({
        ruleId: "x",
        kind: "fetch",
        outcome: "allowed",
        summary: "x",
      }),
    ).resolves.toBeDefined();
  });

  it("uses 'system' userId when none provided", async () => {
    await emitCapabilityReceipt({
      ruleId: "x",
      kind: "fetch",
      outcome: "allowed",
      summary: "x",
    });
    expect(auditLogMock.mock.calls[0][0].userId).toBe("system");
  });

  it("supports all CapabilityKind values", async () => {
    const kinds = [
      "fetch",
      "file-read",
      "file-write",
      "shell-exec",
      "db-read",
      "db-write",
      "llm-call",
      "secret-access",
      "external-api",
      "tool-call",
    ] as const;
    for (const kind of kinds) {
      auditLogMock.mockClear();
      const r = await emitCapabilityReceipt({
        ruleId: "x",
        kind,
        outcome: "allowed",
        summary: "x",
      });
      expect(r.kind).toBe(kind);
      expect(auditLogMock.mock.calls[0][0].resource).toBe(`${kind}:x`);
    }
  });
});
