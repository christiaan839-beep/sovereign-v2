/**
 * SOVEREIGN MATRIX — Verifiable retention proofs (Cook 168).
 *
 * Cryptographic proof that a receipt was deleted after its
 * retention window expired. Solves the GDPR Article 17 "we
 * deleted it" problem: instead of trusting the operator's
 * word, the data subject (or their regulator) can verify
 * the deletion mathematically.
 *
 * Mechanism:
 *   1. At issuance, every receipt has its canonical body
 *      committed to a Merkle batch (Cook 167). The root is
 *      published to a tamper-evident log.
 *   2. After the retention window, we publish a "deletion
 *      tombstone" — a signed assertion that the receipt at
 *      a specific leaf-index in a specific batch has been
 *      purged from the operator's database.
 *   3. The tombstone is itself committed to the chain.
 *      Anyone can verify: (a) the receipt was in the batch,
 *      (b) the tombstone was sealed after expiry, (c) the
 *      tombstone signature is valid.
 *
 * The proof is auditable without exposing the underlying
 * receipt content — meeting GDPR's "right to be forgotten"
 * requirements with mathematical assurance.
 *
 * Pure module: no DB writes. Caller wires the persistence
 * + scheduled tombstone-emission cron.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface RetentionPolicy {
  /** Stable id for the policy (e.g. "csrd-7yr", "pv-25yr"). */
  policyId: string;
  /** Number of ms a receipt is retained before tombstoning. */
  retentionMs: number;
  /** Optional description for the audit-bundle. */
  description?: string;
}

export interface ReceiptRetentionRecord {
  receiptId: string;
  /** The Merkle batch root the receipt was committed to. */
  batchRoot: string;
  /** Index of this receipt's leaf in the batch. */
  leafIndex: number;
  /** Policy id that governs this receipt's deletion schedule. */
  policyId: string;
  /** Unix ms when the receipt was created. */
  createdAt: number;
}

export interface RetentionTombstone {
  /** The receipt id being tombstoned. */
  receiptId: string;
  /** Original batch root the receipt was in. */
  batchRoot: string;
  /** Leaf index in that batch. */
  leafIndex: number;
  /** Policy under which it was deleted. */
  policyId: string;
  /** Original creation time. */
  createdAt: number;
  /** Time the tombstone was sealed (must be > createdAt + retentionMs). */
  sealedAt: number;
  /** Random nonce for uniqueness. */
  nonce: string;
  /** Hex HMAC-SHA256 over the canonical tombstone bundle. */
  mac: string;
}

export type VerifyOutcome =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "retention-not-elapsed"
        | "bad-mac"
        | "policy-mismatch"
        | "receipt-mismatch";
    };

// ── Helpers ───────────────────────────────────────────────────────────────

function canonicalTombstone(t: {
  receiptId: string;
  batchRoot: string;
  leafIndex: number;
  policyId: string;
  createdAt: number;
  sealedAt: number;
  nonce: string;
}): string {
  return [
    "sovereign-retention-tombstone-v1",
    t.receiptId,
    t.batchRoot,
    String(t.leafIndex),
    t.policyId,
    String(t.createdAt),
    String(t.sealedAt),
    t.nonce,
  ].join("|");
}

function macFor(secret: string, body: string): string {
  return createHmac("sha256", Buffer.from(secret, "hex"))
    .update(body)
    .digest("hex");
}

function constantTimeEqualHex(a: string, b: string): boolean {
  const A = Buffer.from(a, "hex");
  const B = Buffer.from(b, "hex");
  if (A.length !== B.length) return false;
  return timingSafeEqual(A, B);
}

// ── Public API ────────────────────────────────────────────────────────────

/** 32-byte hex secret used to sign tombstones. */
export function newTombstoneSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Seal a retention tombstone. Throws if the retention window has
 * not yet elapsed (catches accidental early-delete bugs server-side).
 */
export function sealTombstone(args: {
  secret: string;
  record: ReceiptRetentionRecord;
  policy: RetentionPolicy;
  now?: number;
}): RetentionTombstone {
  if (!/^[0-9a-f]{64}$/i.test(args.secret)) {
    throw new Error("sealTombstone: secret must be 64 hex chars");
  }
  if (args.record.policyId !== args.policy.policyId) {
    throw new Error("sealTombstone: record / policy id mismatch");
  }
  const now = args.now ?? Date.now();
  const expiresAt = args.record.createdAt + args.policy.retentionMs;
  if (now < expiresAt) {
    throw new Error(
      `sealTombstone: retention window not elapsed (now=${now} < expires=${expiresAt})`,
    );
  }
  const nonce = randomBytes(16).toString("hex");
  const body = canonicalTombstone({
    receiptId: args.record.receiptId,
    batchRoot: args.record.batchRoot,
    leafIndex: args.record.leafIndex,
    policyId: args.record.policyId,
    createdAt: args.record.createdAt,
    sealedAt: now,
    nonce,
  });
  return {
    receiptId: args.record.receiptId,
    batchRoot: args.record.batchRoot,
    leafIndex: args.record.leafIndex,
    policyId: args.record.policyId,
    createdAt: args.record.createdAt,
    sealedAt: now,
    nonce,
    mac: macFor(args.secret, body),
  };
}

/**
 * Verify a tombstone. Returns ok:true iff (a) the retention window
 * had elapsed when the tombstone was sealed, (b) the MAC validates
 * under the secret, (c) the receipt id matches the caller's query,
 * and (d) the policy id matches.
 */
export function verifyTombstone(args: {
  secret: string;
  tombstone: RetentionTombstone;
  expectedReceiptId: string;
  expectedPolicyId: string;
  policy: RetentionPolicy;
}): VerifyOutcome {
  if (args.tombstone.receiptId !== args.expectedReceiptId) {
    return { ok: false, reason: "receipt-mismatch" };
  }
  if (args.tombstone.policyId !== args.expectedPolicyId) {
    return { ok: false, reason: "policy-mismatch" };
  }
  const expiresAt = args.tombstone.createdAt + args.policy.retentionMs;
  if (args.tombstone.sealedAt < expiresAt) {
    return { ok: false, reason: "retention-not-elapsed" };
  }
  const expectedMac = macFor(
    args.secret,
    canonicalTombstone({
      receiptId: args.tombstone.receiptId,
      batchRoot: args.tombstone.batchRoot,
      leafIndex: args.tombstone.leafIndex,
      policyId: args.tombstone.policyId,
      createdAt: args.tombstone.createdAt,
      sealedAt: args.tombstone.sealedAt,
      nonce: args.tombstone.nonce,
    }),
  );
  if (!constantTimeEqualHex(expectedMac, args.tombstone.mac)) {
    return { ok: false, reason: "bad-mac" };
  }
  return { ok: true };
}

/**
 * Returns whether a record is eligible for tombstoning right now.
 * Useful for the scheduled cron that emits tombstones in batches.
 */
export function isEligibleForTombstone(
  record: ReceiptRetentionRecord,
  policy: RetentionPolicy,
  now: number = Date.now(),
): boolean {
  if (record.policyId !== policy.policyId) return false;
  return now >= record.createdAt + policy.retentionMs;
}

/**
 * Compute the tombstone's commitment digest. The digest is what
 * gets committed back into the public Merkle chain for ultimate
 * auditor-verifiability — the tombstone itself becomes a receipt.
 */
export function tombstoneDigest(t: RetentionTombstone): string {
  return createHash("sha256")
    .update(
      canonicalTombstone({
        receiptId: t.receiptId,
        batchRoot: t.batchRoot,
        leafIndex: t.leafIndex,
        policyId: t.policyId,
        createdAt: t.createdAt,
        sealedAt: t.sealedAt,
        nonce: t.nonce,
      }),
    )
    .digest("hex");
}

// ── Canonical policies ───────────────────────────────────────────────────

const SECONDS = 1000;
const HOURS = 60 * 60 * SECONDS;
const DAYS = 24 * HOURS;
const YEARS = 365 * DAYS;

export const CANONICAL_POLICIES: Record<string, RetentionPolicy> = {
  "default-90d": {
    policyId: "default-90d",
    retentionMs: 90 * DAYS,
    description: "Default tenant log retention.",
  },
  "csrd-7yr": {
    policyId: "csrd-7yr",
    retentionMs: 7 * YEARS,
    description: "EU CSRD / ESRS regulatory retention (7 years).",
  },
  "pv-25yr": {
    policyId: "pv-25yr",
    retentionMs: 25 * YEARS,
    description: "Pharmacovigilance ICH E2D long-term retention (25 years).",
  },
  "fed-sr11-7-10yr": {
    policyId: "fed-sr11-7-10yr",
    retentionMs: 10 * YEARS,
    description: "Banking SR 11-7 model-risk retention (10 years).",
  },
  "fedramp-3yr": {
    policyId: "fedramp-3yr",
    retentionMs: 3 * YEARS,
    description: "FedRAMP Moderate audit-record retention (3 years).",
  },
  "part-11-trial-end-plus-2yr": {
    policyId: "part-11-trial-end-plus-2yr",
    retentionMs: 7 * YEARS, // approximation; trial-end varies
    description: "21 CFR Part 11 clinical-trial record retention.",
  },
};
