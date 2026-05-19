/**
 * Tests for src/lib/deletion-receipts.ts.
 *
 * Mocks auditLog + pq-sign so the assertions focus on the receipt
 * shape, commitment-only persistence guarantees, and cascade-
 * surviving design (userId="system" never the deleted user).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHash, createHmac } from "node:crypto";

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
  signMlDsa65: () => signMock(),
  isPqDualSignEnabled: () => pqEnabledMock(),
}));

import {
  emitDeletionReceipt,
  canonicalizeDeletionReceipt,
  DELETION_RECEIPT_SCHEMA,
  type DeletionTableSummary,
} from "../deletion-receipts";

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
function hmacHex(pepper: string, s: string): string {
  return createHmac("sha256", pepper).update(s, "utf8").digest("hex");
}

const originalPepper = process.env.DELETION_RECEIPT_PEPPER;

beforeEach(() => {
  auditLogMock.mockClear();
  signMock.mockReset();
  signMock.mockReturnValue(null);
  pqEnabledMock.mockReset();
  pqEnabledMock.mockReturnValue(false);
  // Default: no pepper — bare sha256 commitments (preserves the
  // existing assertions). Specific tests override.
  delete process.env.DELETION_RECEIPT_PEPPER;
});

afterEach(() => {
  if (originalPepper === undefined) {
    delete process.env.DELETION_RECEIPT_PEPPER;
  } else {
    process.env.DELETION_RECEIPT_PEPPER = originalPepper;
  }
});

const TABLES: DeletionTableSummary[] = [
  { table: "settings", ok: true, rowsDeleted: 1 },
  { table: "subscriptions", ok: true, rowsDeleted: 1 },
  { table: "leads", ok: false, error: "table missing" },
];

describe("emitDeletionReceipt — commitment guarantees", () => {
  it("commits subjectId — never stores raw userId in audit row", async () => {
    const r = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "user_2x9KQrt8Yz",
      subjectEmail: "alice@example.com",
      legalBasis: "gdpr-art-17",
      requestedBy: "user_2x9KQrt8Yz",
      tablesAffected: TABLES,
    });
    expect(r.subjectCommitment).toBe(sha256Hex("user_2x9KQrt8Yz"));
    expect(r.emailCommitment).toBe(sha256Hex("alice@example.com"));

    // CRITICAL: the audit row body MUST NOT contain the raw userId or
    // email. Only sha256 commitments and the ticketId.
    const entry = auditLogMock.mock.calls[0][0] as {
      details: Record<string, unknown>;
    };
    const serialized = JSON.stringify(entry.details);
    expect(serialized).not.toContain("user_2x9KQrt8Yz");
    expect(serialized).not.toContain("alice@example.com");
  });

  it("lowercases email before hashing (case-insensitive identity)", async () => {
    const r = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "u",
      subjectEmail: "ALICE@Example.COM",
      legalBasis: "gdpr-art-17",
      requestedBy: "u",
      tablesAffected: [],
    });
    expect(r.emailCommitment).toBe(sha256Hex("alice@example.com"));
  });

  it("emailCommitment is null when no email provided", async () => {
    const r = await emitDeletionReceipt({
      subjectKind: "tenant",
      subjectId: "tenant_x",
      legalBasis: "operator-request",
      requestedBy: "admin_y",
      tablesAffected: [],
    });
    expect(r.emailCommitment).toBeNull();
  });
});

describe("emitDeletionReceipt — cascade-surviving persistence", () => {
  it("writes audit row with userId='system' (NOT the deleted user)", async () => {
    await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "deleted_user_123",
      legalBasis: "gdpr-art-17",
      requestedBy: "deleted_user_123",
      tablesAffected: TABLES,
    });
    const entry = auditLogMock.mock.calls[0][0] as {
      userId: string;
      action: string;
      resource: string;
    };
    // This is THE critical guarantee — if userId=deleted_user_123 here,
    // the cascade's `delete(audit_logs).where(userId = deleted_user_123)`
    // would nuke the only proof the deletion happened.
    expect(entry.userId).toBe("system");
    expect(entry.userId).not.toBe("deleted_user_123");
    expect(entry.action).toBe("data.delete-receipt");
    expect(entry.resource).toMatch(/^deletion:[a-f0-9-]{36}$/);
  });
});

describe("emitDeletionReceipt — summary correctness", () => {
  it("computes totals + per-status counts correctly", async () => {
    const r = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "u",
      legalBasis: "gdpr-art-17",
      requestedBy: "u",
      tablesAffected: TABLES,
    });
    expect(r.summary.totalTables).toBe(3);
    expect(r.summary.succeeded).toBe(2);
    expect(r.summary.failed).toBe(1);
  });

  it("summaryHash is deterministic for the same input regardless of array order", async () => {
    const a = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "u",
      legalBasis: "gdpr-art-17",
      requestedBy: "u",
      tablesAffected: TABLES,
    });
    const b = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "u",
      legalBasis: "gdpr-art-17",
      requestedBy: "u",
      tablesAffected: [...TABLES].reverse(),
    });
    expect(a.summaryHash).toBe(b.summaryHash);
  });
});

describe("canonicalizeDeletionReceipt", () => {
  it("emits a fixed key order", () => {
    const c = canonicalizeDeletionReceipt({
      schema: DELETION_RECEIPT_SCHEMA,
      ts: "2026-05-19T00:00:00.000Z",
      ticketId: "00000000-0000-0000-0000-000000000001",
      subjectKind: "user",
      subjectCommitment: "a".repeat(64),
      emailCommitment: null,
      legalBasis: "gdpr-art-17",
      requestedByCommitment: sha256Hex("u"),
      note: null,
      tablesAffected: TABLES,
      summary: { totalTables: 3, succeeded: 2, failed: 1 },
      summaryHash: "b".repeat(64),
    });
    expect(c.indexOf('"schema"')).toBeLessThan(c.indexOf('"ts"'));
    expect(c.indexOf('"ts"')).toBeLessThan(c.indexOf('"ticketId"'));
  });
});

describe("emitDeletionReceipt — requestedBy commitment", () => {
  it("commits requestedBy (never stores raw actor id)", async () => {
    await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "subject_only_id",
      legalBasis: "operator-request",
      requestedBy: "admin_xyz_123",
      tablesAffected: [],
    });
    const entry = auditLogMock.mock.calls[0][0] as {
      details: Record<string, unknown>;
    };
    expect(entry.details.requestedByCommitment).toBe(
      sha256Hex("admin_xyz_123"),
    );
    const serialized = JSON.stringify(entry.details);
    expect(serialized).not.toContain("admin_xyz_123");
  });

  it("self-deletion: subjectCommitment === requestedByCommitment when self-requested", async () => {
    const r = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "user_abc",
      legalBasis: "gdpr-art-17",
      requestedBy: "user_abc",
      tablesAffected: [],
    });
    expect(r.subjectCommitment).toBe(r.requestedByCommitment);
  });
});

describe("emitDeletionReceipt — pepper (preimage-guess defence)", () => {
  it("uses bare sha256 when DELETION_RECEIPT_PEPPER is unset (with operator warning)", async () => {
    const r = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "user_xyz",
      subjectEmail: "guessable@example.com",
      legalBasis: "gdpr-art-17",
      requestedBy: "user_xyz",
      tablesAffected: [],
    });
    expect(r.subjectCommitment).toBe(sha256Hex("user_xyz"));
    expect(r.emailCommitment).toBe(sha256Hex("guessable@example.com"));
  });

  it("uses HMAC-SHA256 with pepper when DELETION_RECEIPT_PEPPER is set (preimage attack defeated)", async () => {
    const pepper = "x".repeat(32);
    process.env.DELETION_RECEIPT_PEPPER = pepper;
    const r = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "user_xyz",
      subjectEmail: "guessable@example.com",
      legalBasis: "gdpr-art-17",
      requestedBy: "user_xyz",
      tablesAffected: [],
    });
    // The peppered HMAC differs from the bare sha256 — proves the
    // pepper is in the digest input.
    expect(r.subjectCommitment).not.toBe(sha256Hex("user_xyz"));
    expect(r.subjectCommitment).toBe(hmacHex(pepper, "user_xyz"));
    expect(r.emailCommitment).not.toBe(sha256Hex("guessable@example.com"));
    expect(r.emailCommitment).toBe(hmacHex(pepper, "guessable@example.com"));
  });

  it("rejects too-short pepper (< 16 chars) and falls back to bare sha256", async () => {
    process.env.DELETION_RECEIPT_PEPPER = "tooshort";
    const r = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "user_short",
      legalBasis: "gdpr-art-17",
      requestedBy: "user_short",
      tablesAffected: [],
    });
    expect(r.subjectCommitment).toBe(sha256Hex("user_short"));
  });
});

describe("emitDeletionReceipt — error sanitization", () => {
  it("maps 'relation does not exist' → 'missing_table' (no schema leak)", async () => {
    const r = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "u",
      legalBasis: "gdpr-art-17",
      requestedBy: "u",
      tablesAffected: [
        {
          table: "leads",
          ok: false,
          error: 'relation "secret_internal_table_v3" does not exist',
        },
      ],
    });
    expect(r.tablesAffected[0].error).toBe("missing_table");
    // The raw error string with internal table name MUST NOT appear
    // in the persisted audit row body.
    const serialized = JSON.stringify(auditLogMock.mock.calls[0][0].details);
    expect(serialized).not.toContain("secret_internal_table_v3");
    expect(serialized).not.toContain("does not exist");
  });

  it("maps foreign-key violations → 'fk_violation'", async () => {
    const r = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "u",
      legalBasis: "gdpr-art-17",
      requestedBy: "u",
      tablesAffected: [
        {
          table: "x",
          ok: false,
          error:
            "update or delete on table 'parents' violates foreign key constraint 'children_parent_fkey'",
        },
      ],
    });
    expect(r.tablesAffected[0].error).toBe("fk_violation");
    const serialized = JSON.stringify(auditLogMock.mock.calls[0][0].details);
    expect(serialized).not.toContain("children_parent_fkey");
  });

  it("maps permission errors → 'permission_denied'", async () => {
    const r = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "u",
      legalBasis: "gdpr-art-17",
      requestedBy: "u",
      tablesAffected: [
        { table: "x", ok: false, error: "permission denied for table users" },
      ],
    });
    expect(r.tablesAffected[0].error).toBe("permission_denied");
  });

  it("maps unknown errors → 'other' (never echoes raw text)", async () => {
    const r = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "u",
      legalBasis: "gdpr-art-17",
      requestedBy: "u",
      tablesAffected: [
        {
          table: "x",
          ok: false,
          error: "panic: nuclear launch codes leaked",
        },
      ],
    });
    expect(r.tablesAffected[0].error).toBe("other");
    const serialized = JSON.stringify(auditLogMock.mock.calls[0][0].details);
    expect(serialized).not.toContain("nuclear");
  });

  it("preserves undefined error on successful rows", async () => {
    const r = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "u",
      legalBasis: "gdpr-art-17",
      requestedBy: "u",
      tablesAffected: [{ table: "settings", ok: true }],
    });
    expect(r.tablesAffected[0].error).toBeUndefined();
  });
});

describe("emitDeletionReceipt — signing", () => {
  it("records mldsa65Sig + pqEnabled when key configured", async () => {
    signMock.mockReturnValueOnce("base64sig==");
    pqEnabledMock.mockReturnValue(true);
    const r = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "u",
      legalBasis: "gdpr-art-17",
      requestedBy: "u",
      tablesAffected: [],
    });
    expect(r.mldsa65Sig).toBe("base64sig==");
    expect(r.pqEnabled).toBe(true);
  });

  it("never throws when sign throws (graceful degrade)", async () => {
    signMock.mockImplementationOnce(() => {
      throw new Error("key file missing");
    });
    await expect(
      emitDeletionReceipt({
        subjectKind: "user",
        subjectId: "u",
        legalBasis: "gdpr-art-17",
        requestedBy: "u",
        tablesAffected: [],
      }),
    ).resolves.toBeDefined();
  });

  it("never throws when auditLog rejects (deletion still proceeds)", async () => {
    auditLogMock.mockRejectedValueOnce(new Error("db down"));
    await expect(
      emitDeletionReceipt({
        subjectKind: "user",
        subjectId: "u",
        legalBasis: "gdpr-art-17",
        requestedBy: "u",
        tablesAffected: [],
      }),
    ).resolves.toBeDefined();
  });
});

describe("emitDeletionReceipt — ticketId", () => {
  it("ticketId is a UUID v4 shape", async () => {
    const r = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "u",
      legalBasis: "gdpr-art-17",
      requestedBy: "u",
      tablesAffected: [],
    });
    expect(r.ticketId).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
    );
  });

  it("ticketIds are unique across calls", async () => {
    const a = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "u",
      legalBasis: "gdpr-art-17",
      requestedBy: "u",
      tablesAffected: [],
    });
    const b = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "u",
      legalBasis: "gdpr-art-17",
      requestedBy: "u",
      tablesAffected: [],
    });
    expect(a.ticketId).not.toBe(b.ticketId);
  });
});

describe("emitDeletionReceipt — legal basis enum", () => {
  it.each([
    "gdpr-art-17",
    "popia-s24",
    "hipaa-s164.526",
    "ccpa-s1798.105",
    "operator-request",
    "retention-expiry",
  ] as const)("accepts legalBasis=%s", async (basis) => {
    const r = await emitDeletionReceipt({
      subjectKind: "user",
      subjectId: "u",
      legalBasis: basis,
      requestedBy: "u",
      tablesAffected: [],
    });
    expect(r.legalBasis).toBe(basis);
  });
});
