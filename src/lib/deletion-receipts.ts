/**
 * SOVEREIGN MATRIX — Cryptographic-deletion receipts (GDPR Art. 17).
 *
 * When a right-to-erasure request is honoured, this module produces
 * a signed, commitment-only receipt that survives the deletion cascade.
 * The data subject (or their regulator) can later present the
 * ticketId at `/api/privacy/deletion-receipt/<ticketId>` and verify:
 *
 *   1. That a deletion was recorded at time T (audit row exists)
 *   2. That the subject identifier hashes to the committed value in
 *      the receipt (subject can confirm "this was about me" by
 *      recomputing sha256 of their former userId/email locally)
 *   3. That the receipt wasn't tampered with after issuance (ML-DSA-65
 *      signature against the public key at
 *      /.well-known/sovereign-receipts/mldsa65.b64)
 *
 * Persistence model — why this works despite the cascade:
 *   The receipt is written to `audit_logs` with userId="system"
 *   (NOT the deleted user), so when `/api/me/delete` later runs
 *   `db.delete(audit_logs).where(eq(audit_logs.userId, deletedUserId))`
 *   the receipt survives. The deleted user's identifier appears in
 *   the receipt only as a SHA-256 commitment, so the receipt itself
 *   is not "personal data" under GDPR — it's cryptographic evidence
 *   of an act, not a record about a person.
 *
 * Wire schema id: `vaos-deletion-event-v1`.
 *
 * Honesty:
 *   - This receipt proves deletion was RECORDED, not that every byte
 *     was atomically purged from every replica. PostgreSQL WAL,
 *     Neon branch backups, and downstream sub-processors (Stripe,
 *     Clerk, Sentry) need separate evidence pipelines (handled by
 *     /sub-processors page + DPA contracts).
 *   - The legal basis enum captures the request reason; it does NOT
 *     adjudicate the request's legitimacy (that's the operator's
 *     responsibility before invoking the cascade).
 */

import { createHash, createHmac, randomUUID } from "node:crypto";
import { auditLog } from "@/lib/audit-log";
import { signMlDsa65, isPqDualSignEnabled } from "@/lib/pq-sign";
import { createLogger } from "@/lib/logger";

const log = createLogger("deletion-receipts");

let warnedNoPepper = false;
/**
 * Commit an identifier to a hex digest. Uses HMAC-SHA256 with a
 * server-side pepper when DELETION_RECEIPT_PEPPER is configured —
 * this defeats the email-preimage guessing attack flagged by the
 * wave-97 security review (an attacker who suspects `alice@x.com`
 * could otherwise compute sha256(alice@x.com) and confirm presence
 * in a fetched receipt).
 *
 * Falls back to bare sha256 when no pepper is configured, and logs
 * a one-shot warning so operators see the deploy hint. The fallback
 * keeps the system functional in dev / migration windows; production
 * deployments handling real PII MUST set DELETION_RECEIPT_PEPPER to
 * honour the documented privacy guarantee.
 */
function commitId(value: string): string {
  const pepper = process.env.DELETION_RECEIPT_PEPPER;
  if (pepper && pepper.length >= 16) {
    return createHmac("sha256", pepper).update(value, "utf8").digest("hex");
  }
  if (!warnedNoPepper) {
    log.warn(
      "DELETION_RECEIPT_PEPPER unset (or < 16 chars) — commitments use bare sha256, " +
        "vulnerable to preimage guessing for low-entropy identifiers (e.g. emails). " +
        "Set a 32+ char random pepper before handling real PII deletions.",
    );
    warnedNoPepper = true;
  }
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Sanitize a driver error message before persistence. Per-table
 * delete failures can carry schema hints (column names, constraint
 * names, internal table names) that a publicly-fetchable receipt
 * would leak — wave-97 security finding M2. Map to a fixed enum
 * so the audit body never echoes raw Postgres internals.
 */
function sanitizeError(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase();
  if (lower.includes("does not exist") || lower.includes("relation")) {
    return "missing_table";
  }
  if (lower.includes("foreign key") || lower.includes("violates")) {
    return "fk_violation";
  }
  if (lower.includes("permission") || lower.includes("denied")) {
    return "permission_denied";
  }
  if (lower.includes("timeout") || lower.includes("connection")) {
    return "transient_error";
  }
  return "other";
}

export const DELETION_RECEIPT_SCHEMA = "vaos-deletion-event-v1";

export type DeletionLegalBasis =
  | "gdpr-art-17"
  | "popia-s24"
  | "hipaa-s164.526"
  | "ccpa-s1798.105"
  | "operator-request"
  | "retention-expiry";

export type DeletionSubjectKind = "user" | "tenant" | "organization";

export interface DeletionTableSummary {
  table: string;
  ok: boolean;
  /** Optional rows-deleted count. Caller fills only when the driver returned one. */
  rowsDeleted?: number;
  error?: string;
}

export interface DeletionReceiptInput {
  /** What kind of subject was erased. */
  subjectKind: DeletionSubjectKind;
  /**
   * The subject's primary identifier (userId, tenantId, orgId). HASHED
   * before persistence — the raw value never enters the receipt.
   */
  subjectId: string;
  /**
   * Optional secondary identifier (email is the most common). HASHED.
   * Useful for the subject to verify the receipt by recomputing both
   * commitments against their identifiers.
   */
  subjectEmail?: string;
  /** Which legal regime initiated the deletion. */
  legalBasis: DeletionLegalBasis;
  /** Per-table outcome of the cascade. Counts/booleans only. */
  tablesAffected: DeletionTableSummary[];
  /** Who triggered the deletion (operator/admin userId, "system" for cron). */
  requestedBy: string;
  /** Free-form note (e.g. "ticket #1234", "automated retention purge"). */
  note?: string;
}

export interface DeletionReceipt {
  schema: typeof DELETION_RECEIPT_SCHEMA;
  ts: string;
  /** UUID returned to the caller — included in /api/me/delete response. */
  ticketId: string;
  subjectKind: DeletionSubjectKind;
  /** sha256 hex of the raw subjectId — never the raw id itself. */
  subjectCommitment: string;
  /** sha256 hex of the email (when supplied); null otherwise. */
  emailCommitment: string | null;
  legalBasis: DeletionLegalBasis;
  /**
   * sha256 hex of the actor that triggered the deletion. Hashed (not
   * raw) because when the data subject requests their own erasure,
   * requestedBy == subjectId — storing it raw would leak the very
   * identifier the receipt is supposed to abstract away. Verifiers
   * recompute sha256(their_former_userId) and confirm equality with
   * either subjectCommitment or requestedByCommitment.
   */
  requestedByCommitment: string;
  note: string | null;
  tablesAffected: DeletionTableSummary[];
  /** Aggregate: total tables, succeeded, failed. */
  summary: {
    totalTables: number;
    succeeded: number;
    failed: number;
  };
  /** sha256 over the canonical table-summary projection (tampering tripwire). */
  summaryHash: string;
  /** ML-DSA-65 signature over canonical bytes; null when no key configured. */
  mldsa65Sig: string | null;
  pqEnabled: boolean;
}

/** Stable, sortable projection of table summaries for hashing/signing. */
function tablesCanonical(tables: DeletionTableSummary[]): string {
  return JSON.stringify(
    [...tables]
      .sort((a, b) => a.table.localeCompare(b.table))
      .map((t) => ({
        table: t.table,
        ok: t.ok,
        rowsDeleted: typeof t.rowsDeleted === "number" ? t.rowsDeleted : null,
      })),
  );
}

/** Fixed key-order canonicalisation. Verifier reproducibility contract. */
export function canonicalizeDeletionReceipt(
  r: Omit<DeletionReceipt, "mldsa65Sig" | "pqEnabled">,
): string {
  return JSON.stringify({
    schema: r.schema,
    ts: r.ts,
    ticketId: r.ticketId,
    subjectKind: r.subjectKind,
    subjectCommitment: r.subjectCommitment,
    emailCommitment: r.emailCommitment,
    legalBasis: r.legalBasis,
    requestedByCommitment: r.requestedByCommitment,
    note: r.note,
    // Use the sorted projection so the canonical bytes are stable
    // regardless of the order the cascade returned summaries in.
    tablesAffected: JSON.parse(tablesCanonical(r.tablesAffected)),
    summary: r.summary,
    summaryHash: r.summaryHash,
  });
}

/**
 * Emit a deletion receipt. Best-effort — never throws, never blocks
 * the cascade. Returns the structured receipt so the caller can
 * surface the ticketId to the data subject in the response.
 *
 * CRITICAL: persists with userId="system" so the audit row is NOT
 * deleted when the cascade runs `delete(auditLogs).where(userId = X)`
 * later in the same request. The deleted user's identifier appears
 * in the receipt only as sha256 commitments.
 */
export async function emitDeletionReceipt(
  input: DeletionReceiptInput,
): Promise<DeletionReceipt> {
  const ticketId = randomUUID();
  const ts = new Date().toISOString();

  // Sanitize per-table error strings BEFORE they're hashed or persisted.
  // Raw Postgres errors leak schema names; the receipt is publicly
  // fetchable, so we map every error to a fixed enum (wave-97
  // security finding M2).
  const sanitizedTables: DeletionTableSummary[] = input.tablesAffected.map(
    (t) => ({
      table: t.table,
      ok: t.ok,
      rowsDeleted: t.rowsDeleted,
      error: sanitizeError(t.error),
    }),
  );

  const succeeded = sanitizedTables.filter((t) => t.ok).length;
  const failed = sanitizedTables.length - succeeded;
  const summaryHash = createHash("sha256")
    .update(tablesCanonical(sanitizedTables), "utf8")
    .digest("hex");

  const unsigned: Omit<DeletionReceipt, "mldsa65Sig" | "pqEnabled"> = {
    schema: DELETION_RECEIPT_SCHEMA,
    ts,
    ticketId,
    subjectKind: input.subjectKind,
    subjectCommitment: commitId(input.subjectId),
    emailCommitment:
      typeof input.subjectEmail === "string" && input.subjectEmail.length > 0
        ? commitId(input.subjectEmail.toLowerCase())
        : null,
    legalBasis: input.legalBasis,
    requestedByCommitment: commitId(input.requestedBy),
    note: input.note ?? null,
    tablesAffected: sanitizedTables,
    summary: {
      totalTables: sanitizedTables.length,
      succeeded,
      failed,
    },
    summaryHash,
  };

  const canonical = canonicalizeDeletionReceipt(unsigned);
  let mldsa65Sig: string | null = null;
  try {
    mldsa65Sig = signMlDsa65(canonical);
  } catch (err) {
    log.warn("deletion receipt ML-DSA-65 signing failed", {
      error: String(err),
    });
  }

  const receipt: DeletionReceipt = {
    ...unsigned,
    mldsa65Sig,
    pqEnabled: isPqDualSignEnabled(),
  };

  // CASCADE-SURVIVING: userId="system", NOT the deleted user.
  // Resource carries the ticketId, NOT the user id.
  // Details carry only sha256 commitments of the subject + email.
  try {
    await auditLog({
      userId: "system",
      action: "data.delete-receipt",
      resource: `deletion:${ticketId}`,
      details: {
        schema: receipt.schema,
        ts: receipt.ts,
        ticketId: receipt.ticketId,
        subjectKind: receipt.subjectKind,
        subjectCommitment: receipt.subjectCommitment,
        emailCommitment: receipt.emailCommitment,
        legalBasis: receipt.legalBasis,
        requestedByCommitment: receipt.requestedByCommitment,
        note: receipt.note,
        tablesAffected: receipt.tablesAffected,
        summary: receipt.summary,
        summaryHash: receipt.summaryHash,
        mldsa65Sig: receipt.mldsa65Sig,
        pqEnabled: receipt.pqEnabled,
      },
    });
  } catch (err) {
    log.error("deletion receipt audit write failed", {
      ticketId,
      error: String(err),
    });
  }

  return receipt;
}
