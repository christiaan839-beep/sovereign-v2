/**
 * SOVEREIGN MATRIX — Zero-knowledge-style cohort proofs (Wave 147).
 *
 * Publishes proofs of platform claims ("Sovereign ran ≥ N runs with
 * ≥ X% auto-approval in window W") WITHOUT exposing any per-user
 * or per-receipt data.
 *
 * Pragmatic approach — NOT a full zk-SNARK (which requires circom +
 * trusted setup + 2 days of weight). Instead uses three composable
 * cryptographic primitives that give similar guarantees for cohort-
 * level claims:
 *
 *   1. PEDERSEN-STYLE HASH COMMITMENT to the receipt id set
 *      "I commit to having signed these N receipts" without revealing
 *      which receipts. Auditor can later challenge: produce M of N
 *      receipts that match this commitment.
 *
 *   2. RANGE PROOF via salted hash chain
 *      "The count is in [floor, ceiling]" published as the hash of
 *      ( floor || ceiling || nonce ). The nonce is revealed at proof
 *      time; the cohort commitment binds the actual count.
 *
 *   3. PROOF OF POSITIVE-RATE
 *      "≥ X% of these had trust_decision=auto-approved" published as
 *      the same range-proof structure over the approved subset.
 *
 * These are NOT zero-knowledge in the cryptographic sense. They are
 * "selective disclosure proofs" — the platform commits NOW, and can
 * reveal LATER under audit. The properties we get:
 *   - Unforgeability: can't claim a higher count later without
 *     contradicting the cohort commitment
 *   - Public commitment: anyone can witness the daily commit
 *   - Audit-on-demand: an auditor with subpoena power can request
 *     the full receipt set + verify against the commitment
 *
 * For full zk: swap CohortCommitment for a zk-SNARK over the same
 * shape. The wire format is designed to be drop-in compatible.
 */

import { createHash, randomBytes } from "node:crypto";

const HASH_VERSION = "sovereign-cohort-v1";

export interface CohortCommitment {
  /** Version string so future formats are unambiguous. */
  version: string;
  /** UTC date window — start..end inclusive. */
  windowStart: string;
  windowEnd: string;
  /**
   * SHA-256 over the canonical concatenation of all receipt IDs in
   * sorted order. Auditor receives the ID list later + re-hashes to
   * verify.
   */
  receiptSetHash: string;
  /** Hash-commitment to the receipt count + a fresh nonce. */
  countCommitment: string;
  /** Hash-commitment to the auto-approved subset count + nonce. */
  approvalCommitment: string;
  /** The bracket [floor, ceiling] the count falls into — public. */
  countBracket: { floor: number; ceiling: number };
  /** Approval-rate bracket [low, high] as a 0-1 percentage. */
  approvalBracket: { low: number; high: number };
  /** ISO timestamp of publication. */
  generatedAt: string;
}

export interface CommitmentSecret {
  /** Hex nonce used in countCommitment — needed to verify the bracket. */
  countNonce: string;
  approvalNonce: string;
  /** Actual count (private). */
  actualCount: number;
  /** Actual approval rate (private, 0-1). */
  actualApprovalRate: number;
}

export interface CohortPublication {
  commitment: CohortCommitment;
  /** Secret stored in operator-only storage; revealed at audit time. */
  secret: CommitmentSecret;
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Build a receipt-set hash. Input must be a sorted unique array of
 * receipt UUIDs. Returns SHA-256 over the canonical concatenation.
 */
export function hashReceiptSet(receiptIds: string[]): string {
  const sorted = [...new Set(receiptIds)].sort();
  if (sorted.length === 0) return sha256(`${HASH_VERSION}:empty`);
  return sha256(`${HASH_VERSION}:${sorted.join(",")}`);
}

/**
 * Pure bracket calculator — given a value, returns the [floor, ceiling]
 * power-of-10 bracket. Examples:
 *   42       → [10, 100]
 *   500      → [100, 1000]
 *   17_842   → [10_000, 100_000]
 *
 * Bracketing hides exact counts while preserving order-of-magnitude
 * truth. Auditor can verify "we said in [10_000, 100_000]" by
 * confirming the commitment matches the revealed nonce + count.
 */
export function powerOfTenBracket(n: number): {
  floor: number;
  ceiling: number;
} {
  if (n <= 0) return { floor: 0, ceiling: 1 };
  const log = Math.log10(n);
  const lower = Math.pow(10, Math.floor(log));
  const upper = Math.pow(10, Math.floor(log) + 1);
  return { floor: lower, ceiling: upper };
}

/**
 * Pure approval-rate bracket — buckets a 0-1 rate into 10 percentage
 * bands: [0, 0.1), [0.1, 0.2), ..., [0.9, 1.0].
 */
export function rateDecileBracket(rate: number): { low: number; high: number } {
  if (rate < 0) return { low: 0, high: 0 };
  if (rate >= 1) return { low: 0.9, high: 1.0 };
  const decile = Math.floor(rate * 10);
  return { low: decile / 10, high: (decile + 1) / 10 };
}

/**
 * Compute the count commitment hash. The nonce binds the actual
 * count to the published bracket — verifier checks that
 * sha256(actualCount || nonce || bracket) == published.
 */
export function commitCount(
  actualCount: number,
  nonce: string,
  bracket: { floor: number; ceiling: number },
): string {
  return sha256(
    `${HASH_VERSION}:count:${actualCount}:${nonce}:${bracket.floor}:${bracket.ceiling}`,
  );
}

export function commitApprovalRate(
  actualRate: number,
  nonce: string,
  bracket: { low: number; high: number },
): string {
  return sha256(
    `${HASH_VERSION}:approval:${actualRate}:${nonce}:${bracket.low}:${bracket.high}`,
  );
}

/**
 * Build a full cohort publication — commitment + the secret an
 * operator must preserve to prove the commitment at audit time.
 */
export function buildCohortProof(args: {
  windowStart: string;
  windowEnd: string;
  receiptIds: string[];
  approvedCount: number;
}): CohortPublication {
  if (!args.windowStart || !args.windowEnd) {
    throw new Error("windowStart + windowEnd required");
  }
  if (args.approvedCount < 0 || args.approvedCount > args.receiptIds.length) {
    throw new Error("approvedCount must be in [0, receiptIds.length]");
  }

  const actualCount = args.receiptIds.length;
  const actualApprovalRate =
    actualCount === 0 ? 0 : args.approvedCount / actualCount;

  const receiptSetHash = hashReceiptSet(args.receiptIds);
  const countBracket = powerOfTenBracket(actualCount);
  const approvalBracket = rateDecileBracket(actualApprovalRate);

  const countNonce = randomBytes(16).toString("hex");
  const approvalNonce = randomBytes(16).toString("hex");

  return {
    commitment: {
      version: HASH_VERSION,
      windowStart: args.windowStart,
      windowEnd: args.windowEnd,
      receiptSetHash,
      countCommitment: commitCount(actualCount, countNonce, countBracket),
      approvalCommitment: commitApprovalRate(
        actualApprovalRate,
        approvalNonce,
        approvalBracket,
      ),
      countBracket,
      approvalBracket,
      generatedAt: new Date().toISOString(),
    },
    secret: {
      countNonce,
      approvalNonce,
      actualCount,
      actualApprovalRate,
    },
  };
}

/**
 * Pure verifier — given a public commitment + the operator's revealed
 * secret (at audit time), confirms the commitment binds the secret.
 *
 * Returns:
 *   - valid: true iff every hash matches
 *   - reasons: array of mismatches when invalid (for debugging)
 */
export function verifyCohortProof(
  commitment: CohortCommitment,
  secret: CommitmentSecret,
  revealedReceiptIds: string[],
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (commitment.version !== HASH_VERSION) {
    reasons.push(`version mismatch: ${commitment.version} vs ${HASH_VERSION}`);
  }

  const recomputedSetHash = hashReceiptSet(revealedReceiptIds);
  if (recomputedSetHash !== commitment.receiptSetHash) {
    reasons.push(
      "receiptSetHash mismatch — revealed IDs differ from commitment",
    );
  }

  if (secret.actualCount !== revealedReceiptIds.length) {
    reasons.push(
      `actualCount=${secret.actualCount} != revealedReceiptIds.length=${revealedReceiptIds.length}`,
    );
  }

  const expectedBracket = powerOfTenBracket(secret.actualCount);
  if (
    expectedBracket.floor !== commitment.countBracket.floor ||
    expectedBracket.ceiling !== commitment.countBracket.ceiling
  ) {
    reasons.push("countBracket does not match actualCount");
  }

  const recomputedCountCommit = commitCount(
    secret.actualCount,
    secret.countNonce,
    commitment.countBracket,
  );
  if (recomputedCountCommit !== commitment.countCommitment) {
    reasons.push("countCommitment hash mismatch");
  }

  const recomputedApprovalCommit = commitApprovalRate(
    secret.actualApprovalRate,
    secret.approvalNonce,
    commitment.approvalBracket,
  );
  if (recomputedApprovalCommit !== commitment.approvalCommitment) {
    reasons.push("approvalCommitment hash mismatch");
  }

  return { valid: reasons.length === 0, reasons };
}

/**
 * Convenience — render a public-facing claim string operators can
 * post on Twitter / a press release / a /trust page.
 */
export function renderClaim(commitment: CohortCommitment): string {
  const { countBracket, approvalBracket, windowStart, windowEnd } = commitment;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    `Sovereign Matrix ran between ${countBracket.floor.toLocaleString()} and ` +
    `${countBracket.ceiling.toLocaleString()} signed agent runs ` +
    `between ${windowStart} and ${windowEnd}, with ` +
    `${pct(approvalBracket.low)}–${pct(approvalBracket.high)} ` +
    `auto-approval rate. Commitment hash: ${commitment.receiptSetHash.slice(0, 16)}…`
  );
}
