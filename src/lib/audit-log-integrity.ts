/**
 * SOVEREIGN MATRIX — Hash-chained audit-log integrity (Cook 179).
 *
 * The receipt-chain ratchet (Cook 94) makes the customer-facing
 * receipt log tamper-evident. This module does the same thing for
 * the OPERATOR-FACING audit log: every audit_logs row is bound to
 * its predecessor via a SHA-256 hash chain so any retroactive
 * tampering by an operator (or a compromised database) is
 * cryptographically detectable on verification.
 *
 * The chain head is a single hex string per tenant. Caller:
 *   1. Computes `nextHead = chainAppend(prevHead, row)` at write time.
 *   2. Persists `nextHead` alongside the row.
 *   3. Periodically verifies the full chain via `verifyChain(rows)`.
 *
 * Pure module — no DB writes, no I/O. Deterministic.
 *
 * Threat model addressed:
 *   - A malicious operator silently edits an old audit_logs row.
 *     Verification fails because the chain hash for that row no
 *     longer matches.
 *   - A compromised database insert/delete on the audit_logs table
 *     between rows. Verification detects the discontinuity.
 *
 * Not addressed (out of scope, intentional):
 *   - An attacker who can replay the ENTIRE chain from a known-good
 *     prior head, deleting everything that came after. Mitigated by
 *     the existing blockchain anchor primitive (Cook 169) anchoring
 *     periodic chain heads to a public chain.
 */

import { createHash } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface AuditLogRow {
  /** Stable row id (e.g. database primary key). */
  id: string;
  /** Unix ms when the action occurred. */
  occurredAt: number;
  /** Hashed user id (we never log raw user ids — see GDPR Processor doc). */
  userIdHash: string;
  /** Domain-separated action class — e.g. "auth:login", "billing:refund". */
  action: string;
  /** Canonical resource the action touched. */
  resource: string;
  /** Outcome / verdict — "success", "denied", "error", etc. */
  outcome: string;
  /** Optional caller-supplied metadata as a sorted JSON string. */
  metadata?: string;
}

export interface ChainedRow extends AuditLogRow {
  /** SHA-256 hex of the canonical row || previous head. */
  chainHead: string;
  /** Previous head this row was bound to. Empty string for the genesis row. */
  prevHead: string;
}

export interface VerifyOutcome {
  ok: boolean;
  /** Row id where verification failed; null when ok=true. */
  failedAtRowId: string | null;
  /**
   * Index in the chain where verification failed; null when ok=true.
   */
  failedAtIndex: number | null;
  reason?:
    | "chain-discontinuity"
    | "row-tampered"
    | "head-mismatch"
    | "non-monotonic-time";
}

// ── Canonical projection ─────────────────────────────────────────────────

/**
 * Compose the canonical byte string for a single row. Order is
 * fixed; every field is pipe-delimited under a domain separator
 * so cross-protocol attacks (re-using this hash elsewhere) fail.
 */
export function canonicalRow(row: AuditLogRow): string {
  return [
    "sovereign-audit-log-v1",
    row.id,
    String(row.occurredAt),
    row.userIdHash,
    row.action,
    row.resource,
    row.outcome,
    row.metadata ?? "",
  ].join("|");
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Compute the next chain head given the previous head and the row
 * being appended. Caller persists the return value alongside the
 * row.
 *
 * For the genesis row (no prior entries), pass an empty string as
 * `prevHead`.
 */
export function chainAppend(prevHead: string, row: AuditLogRow): string {
  const composite = `${canonicalRow(row)}||${prevHead}`;
  return createHash("sha256").update(composite).digest("hex");
}

/**
 * Verify a sequence of chained rows. Returns ok:true iff:
 *   - Every row's chainHead equals chainAppend(prevHead, row).
 *   - prev/next heads form a contiguous chain.
 *   - occurredAt is monotonically non-decreasing.
 *
 * `genesisPrevHead` is the head value that preceded the first row
 * in this batch — for the very first audit log row ever, use the
 * empty string. For incremental verifications (e.g. monthly drains)
 * pass the previous month's final chainHead so the verification
 * binds across drain boundaries.
 */
export function verifyChain(
  rows: ChainedRow[],
  genesisPrevHead: string = "",
): VerifyOutcome {
  let expectedPrev = genesisPrevHead;
  let lastTime = -Infinity;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (row.prevHead !== expectedPrev) {
      return {
        ok: false,
        failedAtRowId: row.id,
        failedAtIndex: i,
        reason: "chain-discontinuity",
      };
    }

    const recomputed = chainAppend(expectedPrev, row);
    if (recomputed !== row.chainHead) {
      // Either the row body was tampered with, or the chainHead
      // itself was tampered with. Either way the chain is broken
      // at this row.
      return {
        ok: false,
        failedAtRowId: row.id,
        failedAtIndex: i,
        reason: "row-tampered",
      };
    }

    if (row.occurredAt < lastTime) {
      // Time should be monotonically non-decreasing — a row appearing
      // earlier than its predecessor in the chain implies someone
      // reordered the chain (or clock skew was extreme).
      return {
        ok: false,
        failedAtRowId: row.id,
        failedAtIndex: i,
        reason: "non-monotonic-time",
      };
    }
    lastTime = row.occurredAt;
    expectedPrev = row.chainHead;
  }

  return { ok: true, failedAtRowId: null, failedAtIndex: null };
}

/**
 * Verify that a single ChainedRow is internally consistent with
 * its claimed predecessor. Convenience helper for spot-checks.
 */
export function verifyRow(row: ChainedRow): boolean {
  return chainAppend(row.prevHead, row) === row.chainHead;
}

/**
 * Compute a digest of the entire chain — useful for periodic
 * anchoring into the public-chain primitive (Cook 169). The
 * digest binds the final chainHead, the row count, and the
 * time range.
 *
 * Returns a 64-char hex string.
 */
export function chainDigest(rows: ChainedRow[]): string {
  if (rows.length === 0) {
    return createHash("sha256").update("empty").digest("hex");
  }
  const first = rows[0];
  const last = rows[rows.length - 1];
  return createHash("sha256")
    .update(
      [
        "sovereign-audit-chain-digest-v1",
        String(rows.length),
        String(first.occurredAt),
        String(last.occurredAt),
        last.chainHead,
      ].join("|"),
    )
    .digest("hex");
}
