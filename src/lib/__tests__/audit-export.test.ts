/**
 * audit-export — tests.
 *
 * Pure-function batch root + signer + verifier. Same trustless
 * invariants as R34/R37/R38/R44.
 *
 * Covers:
 *   - Empty batch root is deterministic
 *   - Same rows → same root (key-order-stable canonical JSON)
 *   - Sign + verify roundtrip
 *   - Tampering: mutated row, mutated root, mutated message,
 *     forged signature
 *   - Internal row chain walk: 3 chained rows verify; chain break
 *     at row 2 surfaces with rowIndex
 *   - Cross-tenant defense (isOwnedByTenant)
 *   - Pubkey rotation safety (expectedPlatformPublicKey gate)
 */

import { describe, it, expect } from "vitest";
import {
  computeBatchRoot,
  buildBatchMessage,
  signAuditBatch,
  verifyAuditBatch,
  isOwnedByTenant,
  type ExportedAuditRow,
  type AuditExportBatch,
} from "../audit-export";
import { generateKeyPair } from "../agent-delegation";

function row(
  i: number,
  prevHash: string | null,
  rowHash: string | null,
  userId = "user_alice",
): ExportedAuditRow {
  return {
    id: `row-${i}`,
    userId,
    action: "test.action",
    resource: `resource-${i}`,
    details: `details for ${i}`,
    ipAddress: "127.0.0.1",
    createdAt: `2026-04-${String(20 + i).padStart(2, "0")}T00:00:00.000Z`,
    prevHash,
    rowHash,
  };
}

describe("computeBatchRoot — pure", () => {
  it("empty batch produces a deterministic hash", () => {
    expect(computeBatchRoot([])).toBe(computeBatchRoot([]));
  });

  it("same rows produce the same root", () => {
    const rows = [row(1, null, "h1"), row(2, "h1", "h2")];
    expect(computeBatchRoot(rows)).toBe(computeBatchRoot(rows));
  });

  it("different rows produce different roots", () => {
    const a = [row(1, null, "h1")];
    const b = [row(2, null, "h2")];
    expect(computeBatchRoot(a)).not.toBe(computeBatchRoot(b));
  });

  it("any single field change changes the root", () => {
    const r = row(1, null, "h1");
    const root = computeBatchRoot([r]);
    expect(computeBatchRoot([{ ...r, action: "different" }])).not.toBe(root);
    expect(computeBatchRoot([{ ...r, ipAddress: "1.2.3.4" }])).not.toBe(root);
    expect(computeBatchRoot([{ ...r, rowHash: "tampered" }])).not.toBe(root);
  });
});

describe("isOwnedByTenant — defense in depth", () => {
  it("returns true for matching userId", () => {
    expect(isOwnedByTenant(row(1, null, "h1", "alice"), "alice")).toBe(true);
  });
  it("returns false for non-matching userId", () => {
    expect(isOwnedByTenant(row(1, null, "h1", "alice"), "bob")).toBe(false);
  });
});

describe("signAuditBatch + verifyAuditBatch — roundtrip", () => {
  it("signs and the same key verifies", () => {
    const kp = generateKeyPair();
    const rows = [
      row(1, null, "h1"),
      row(2, "h1", "h2"),
      row(3, "h2", "h3"),
    ];
    const batchRoot = computeBatchRoot(rows);
    const batch: AuditExportBatch = {
      userId: "user_alice",
      windowStart: null,
      windowEnd: null,
      rowCount: rows.length,
      rows,
      batchRoot,
      exportedAt: "2026-04-29T12:00:00.000Z",
    };
    const signed = signAuditBatch({
      batch,
      platformPrivateKey: kp.privateKey,
      platformPublicKey: kp.publicKey,
    });
    const result = verifyAuditBatch({ signedExport: signed });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.rowsVerified).toBe(3);
    }
  });

  it("verifies an empty batch (no rows)", () => {
    const kp = generateKeyPair();
    const rows: ExportedAuditRow[] = [];
    const batch: AuditExportBatch = {
      userId: "user_alice",
      windowStart: null,
      windowEnd: null,
      rowCount: 0,
      rows,
      batchRoot: computeBatchRoot(rows),
      exportedAt: "2026-04-29T12:00:00.000Z",
    };
    const signed = signAuditBatch({
      batch,
      platformPrivateKey: kp.privateKey,
      platformPublicKey: kp.publicKey,
    });
    const result = verifyAuditBatch({ signedExport: signed });
    expect(result.valid).toBe(true);
  });

  it("expectedPlatformPublicKey assertion catches rotated keys", () => {
    const real = generateKeyPair();
    const attacker = generateKeyPair();
    const batch: AuditExportBatch = {
      userId: "alice",
      windowStart: null,
      windowEnd: null,
      rowCount: 1,
      rows: [row(1, null, "h1")],
      batchRoot: computeBatchRoot([row(1, null, "h1")]),
      exportedAt: "2026-04-29T12:00:00.000Z",
    };
    const signed = signAuditBatch({
      batch,
      platformPrivateKey: real.privateKey,
      platformPublicKey: real.publicKey,
    });
    // Attacker swaps the embedded pubkey to their own.
    const tampered = { ...signed, platformPublicKey: attacker.publicKey };
    const result = verifyAuditBatch({
      signedExport: tampered,
      expectedPlatformPublicKey: real.publicKey,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(["signature_invalid", "platform_pubkey_mismatch"]).toContain(
        result.reason,
      );
    }
  });
});

describe("Tampering detection", () => {
  function freshSigned() {
    const kp = generateKeyPair();
    const rows = [row(1, null, "h1"), row(2, "h1", "h2")];
    const batch: AuditExportBatch = {
      userId: "alice",
      windowStart: null,
      windowEnd: null,
      rowCount: 2,
      rows,
      batchRoot: computeBatchRoot(rows),
      exportedAt: "2026-04-29T12:00:00.000Z",
    };
    return {
      signed: signAuditBatch({
        batch,
        platformPrivateKey: kp.privateKey,
        platformPublicKey: kp.publicKey,
      }),
      kp,
    };
  }

  it("mutating a row body fails batch root recompute", () => {
    const { signed } = freshSigned();
    const tampered = {
      ...signed,
      rows: [{ ...signed.rows[0], action: "tampered" }, signed.rows[1]],
    };
    const result = verifyAuditBatch({ signedExport: tampered });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("batch_root_mismatch");
    }
  });

  it("mutating the batchRoot field fails message reconstruction", () => {
    const { signed } = freshSigned();
    const tampered = { ...signed, batchRoot: "0".repeat(64) };
    const result = verifyAuditBatch({ signedExport: tampered });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      // batchRoot is a field in the canonical message.
      expect(result.reason).toBe("batch_message_mismatch");
    }
  });

  it("mutating rowCount changes the message", () => {
    const { signed } = freshSigned();
    const tampered = { ...signed, rowCount: 99 };
    const result = verifyAuditBatch({ signedExport: tampered });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("batch_message_mismatch");
    }
  });

  it("forging a signature fails verification", () => {
    const { signed } = freshSigned();
    const sigChars = signed.batchSignature.split("");
    sigChars[5] = sigChars[5] === "A" ? "B" : "A";
    const tampered = { ...signed, batchSignature: sigChars.join("") };
    const result = verifyAuditBatch({ signedExport: tampered });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("signature_invalid");
    }
  });
});

describe("Row chain walk — internal integrity", () => {
  it("3 chained rows verify cleanly", () => {
    const kp = generateKeyPair();
    const rows = [
      row(1, null, "h1"),
      row(2, "h1", "h2"),
      row(3, "h2", "h3"),
    ];
    const batch: AuditExportBatch = {
      userId: "alice",
      windowStart: null,
      windowEnd: null,
      rowCount: 3,
      rows,
      batchRoot: computeBatchRoot(rows),
      exportedAt: "2026-04-29T12:00:00.000Z",
    };
    const signed = signAuditBatch({
      batch,
      platformPrivateKey: kp.privateKey,
      platformPublicKey: kp.publicKey,
    });
    const result = verifyAuditBatch({ signedExport: signed });
    expect(result.valid).toBe(true);
  });

  it("a broken chain at row 2 is detected with rowIndex", () => {
    const kp = generateKeyPair();
    // Row 2's prevHash should be "h1" but is "wrong-prev" — chain break.
    const rows = [
      row(1, null, "h1"),
      // Build a row whose prevHash is incorrect
      { ...row(2, "wrong-prev", "h2") },
    ];
    const batch: AuditExportBatch = {
      userId: "alice",
      windowStart: null,
      windowEnd: null,
      rowCount: 2,
      rows,
      batchRoot: computeBatchRoot(rows),
      exportedAt: "2026-04-29T12:00:00.000Z",
    };
    const signed = signAuditBatch({
      batch,
      platformPrivateKey: kp.privateKey,
      platformPublicKey: kp.publicKey,
    });
    const result = verifyAuditBatch({ signedExport: signed });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBe("row_chain_break");
      expect(result.rowIndex).toBe(1);
    }
  });

  it("legacy rows with NULL hashes are skipped (back-compat)", () => {
    const kp = generateKeyPair();
    // Row 0 is a legacy row with no chain hash; row 1 is a fresh chain.
    const rows = [
      row(1, null, null), // legacy
      row(2, null, "h2"), // first hashed row, prev=null is fine
    ];
    const batch: AuditExportBatch = {
      userId: "alice",
      windowStart: null,
      windowEnd: null,
      rowCount: 2,
      rows,
      batchRoot: computeBatchRoot(rows),
      exportedAt: "2026-04-29T12:00:00.000Z",
    };
    const signed = signAuditBatch({
      batch,
      platformPrivateKey: kp.privateKey,
      platformPublicKey: kp.publicKey,
    });
    const result = verifyAuditBatch({ signedExport: signed });
    expect(result.valid).toBe(true);
  });
});

describe("buildBatchMessage — canonical format", () => {
  it("produces v1 line-separated format with all key fields", () => {
    const rows = [row(1, null, "h1")];
    const batch: AuditExportBatch = {
      userId: "alice",
      windowStart: null,
      windowEnd: null,
      rowCount: 1,
      rows,
      batchRoot: computeBatchRoot(rows),
      exportedAt: "2026-04-29T12:00:00.000Z",
    };
    const msg = buildBatchMessage(batch);
    expect(msg.startsWith("v1\naudit-export-batch\n")).toBe(true);
    expect(msg).toContain("user:alice");
    expect(msg).toContain("rows:1");
    expect(msg).toContain("exportedAt:2026-04-29T12:00:00.000Z");
  });

  it("renders no-window as 'all|all'", () => {
    const rows: ExportedAuditRow[] = [];
    const batch: AuditExportBatch = {
      userId: "alice",
      windowStart: null,
      windowEnd: null,
      rowCount: 0,
      rows,
      batchRoot: computeBatchRoot(rows),
      exportedAt: "2026-04-29T12:00:00.000Z",
    };
    const msg = buildBatchMessage(batch);
    expect(msg).toContain("window:all|all");
  });
});
