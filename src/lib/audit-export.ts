/**
 * CUSTOMER-MANAGED AUDIT-LOG EXPORT (signed batches).
 *
 * Round 45 — the enterprise deal-unlocker. Customers can export
 * their tenant's audit-log rows as a SIGNED batch, store it in
 * their own S3 / GCS / blob storage, and verify integrity offline
 * forever — even if Sovereign disappears.
 *
 * THE TRUST CONTRACT:
 *
 *   Customer (tenant)                Sovereign Platform
 *   ─────────────────                ─────────────────
 *   POST /api/admin/audit/export     ─→  filter audit_logs by userId
 *                                    ─→  compute Merkle-style batch root
 *                                    ─→  sign batch with platform key
 *   ←─ SignedAuditExport            ─
 *   store in customer S3 ─────────────→  customer S3 bucket
 *
 *   Years later, audit:
 *   load from S3 → run inspector → ✓ chain intact, signature valid
 *
 * This composes:
 *   - R26 audit_logs hash chain (per-row prev_hash + row_hash)
 *   - R44 platform Ed25519 signing key (for batch signature)
 *
 * The customer NEVER needs to trust Sovereign for the historical
 * record. The math is the truth, the customer holds the data, and
 * the inspector verifies it offline. Same trustless pattern as the
 * rest of the trust stack.
 */

import { createHash } from "node:crypto";
import {
  signMessage,
  verifySignature,
  canonicalJsonStringify,
} from "@/lib/agent-delegation";

// ── Types ──────────────────────────────────────────────────────────

/**
 * One audit-log row in canonical export form. Mirror of the
 * audit_logs row shape, with hashes always stringified.
 */
export interface ExportedAuditRow {
  id: string;
  userId: string;
  action: string;
  resource: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string; // ISO 8601
  prevHash: string | null;
  rowHash: string | null;
}

export interface AuditExportBatch {
  /** Tenant userId. Always present — exports are tenant-scoped. */
  userId: string;
  /** Filter window applied (informational; for audit reproducibility). */
  windowStart: string | null;
  windowEnd: string | null;
  /** Total rows in this batch. */
  rowCount: number;
  /** The exported rows (already chain-walked + verified server-side). */
  rows: ExportedAuditRow[];
  /** Merkle-style root: sha256 over canonical-JSON of all rows. */
  batchRoot: string;
  /** When the batch was assembled. */
  exportedAt: string;
}

export interface SignedAuditExport extends AuditExportBatch {
  /** Canonical batch message that was signed. */
  batchMessage: string;
  /** Base64URL Ed25519 signature over batchMessage. */
  batchSignature: string;
  /** Platform public key in effect at signing time. */
  platformPublicKey: string;
}

// ── Pure functions: batch root + canonical message ─────────────────

/**
 * Compute the Merkle-style batch root.
 *
 * Implementation: sha256 over canonical JSON of the row array.
 * Simpler than a full Merkle tree (single root, no proofs), but
 * has the same property: any tampering with any row changes the
 * root. Since the platform commits to the root in the signature,
 * any post-export tampering is detectable.
 *
 * Canonical JSON ensures key-order stability — same rows → same
 * root, every machine, every language.
 */
export function computeBatchRoot(rows: ExportedAuditRow[]): string {
  return createHash("sha256")
    .update(canonicalJsonStringify(rows))
    .digest("hex");
}

/**
 * Build the canonical batch-signing message. Same line-separated,
 * deterministic format as R34/R37/R38/R44. Verifier reconstructs
 * from the signed fields.
 */
export function buildBatchMessage(b: AuditExportBatch): string {
  return [
    "v1",
    "audit-export-batch",
    `user:${b.userId}`,
    `window:${b.windowStart ?? "all"}|${b.windowEnd ?? "all"}`,
    `rows:${b.rowCount}`,
    `batchRoot:${b.batchRoot}`,
    `exportedAt:${b.exportedAt}`,
  ].join("\n");
}

// ── Sign (impure — needs platform key) ─────────────────────────────

export function signAuditBatch(input: {
  batch: AuditExportBatch;
  platformPrivateKey: string;
  platformPublicKey: string;
}): SignedAuditExport {
  const message = buildBatchMessage(input.batch);
  const signature = signMessage(input.platformPrivateKey, message);
  return {
    ...input.batch,
    batchMessage: message,
    batchSignature: signature,
    platformPublicKey: input.platformPublicKey,
  };
}

// ── Verify (pure; ports to inspector) ───────────────────────────────

/**
 * Verify a signed audit export batch end-to-end.
 *
 * Pure function. Used both server-side (sanity check) and ported
 * to @sovereign/inspector for offline customer verification.
 *
 * Checks:
 *   1. Reconstructed canonical message matches the signed message.
 *   2. Recomputed batch root matches the embedded batchRoot.
 *   3. Ed25519 signature is valid against the platform key.
 *   4. (Optional caller assertion) the platform pubkey matches
 *      the currently-published key.
 *   5. The internal hash chain across the rows is intact (each
 *      row's prevHash equals the previous row's rowHash).
 */
export function verifyAuditBatch(input: {
  signedExport: SignedAuditExport;
  expectedPlatformPublicKey?: string;
}):
  | { valid: true; rowsVerified: number }
  | { valid: false; reason: string; rowIndex?: number } {
  const e = input.signedExport;

  // 1. Reconstruct canonical message.
  const expectedMessage = buildBatchMessage({
    userId: e.userId,
    windowStart: e.windowStart,
    windowEnd: e.windowEnd,
    rowCount: e.rowCount,
    rows: e.rows,
    batchRoot: e.batchRoot,
    exportedAt: e.exportedAt,
  });
  if (e.batchMessage !== expectedMessage) {
    return { valid: false, reason: "batch_message_mismatch" };
  }

  // 2. Recompute batch root.
  const recomputedRoot = computeBatchRoot(e.rows);
  if (recomputedRoot !== e.batchRoot) {
    return { valid: false, reason: "batch_root_mismatch" };
  }

  // 3. Verify signature.
  if (
    !verifySignature(
      e.platformPublicKey,
      e.batchMessage,
      e.batchSignature,
    )
  ) {
    return { valid: false, reason: "signature_invalid" };
  }

  // 4. Optional platform pubkey assertion.
  if (
    input.expectedPlatformPublicKey &&
    e.platformPublicKey !== input.expectedPlatformPublicKey
  ) {
    return { valid: false, reason: "platform_pubkey_mismatch" };
  }

  // 5. Walk the internal row chain.
  // Each row's prevHash must equal the previous row's rowHash.
  // Genesis-row prevHash is implementation-defined ("GENESIS" or NULL).
  for (let i = 1; i < e.rows.length; i++) {
    const cur = e.rows[i];
    const prev = e.rows[i - 1];
    // Skip rows that pre-date the chain (legacy NULL hashes — they
    // simply aren't part of the chain integrity check).
    if (cur.prevHash === null || prev.rowHash === null) {
      continue;
    }
    if (cur.prevHash !== prev.rowHash) {
      return {
        valid: false,
        reason: "row_chain_break",
        rowIndex: i,
      };
    }
  }

  return { valid: true, rowsVerified: e.rows.length };
}

/**
 * Tenant-scope guard. Pure function — given a userId and a row,
 * returns whether the row belongs to this tenant. Caller (route
 * handler) uses this as a defense-in-depth check before signing
 * an export, so even a SQL bug can't leak cross-tenant rows.
 */
export function isOwnedByTenant(row: ExportedAuditRow, userId: string): boolean {
  return row.userId === userId;
}
