/**
 * SOVEREIGN MATRIX — Merkle-batched receipts (Cook 167).
 *
 * Batches N receipts into a single Merkle root. Anyone can prove
 * a specific receipt is in the batch without seeing the others —
 * O(log n) inclusion proof, O(n) commit. Distinct from Cook 94
 * receipt-ratchet (single-thread tamper-evident chain) and from
 * Cook 105 receipt-chain (linear append-only). Merkle batching
 * is the primitive that scales to 1M receipts/day at the same
 * verification cost as 1K/day.
 *
 * Algorithm:
 *   - SHA-256 leaves (domain-separated as 'leaf|<canonical receipt>').
 *   - SHA-256 internal nodes (domain-separated as 'node|<left>|<right>').
 *   - Odd-leaf level duplicates the trailing leaf (standard Bitcoin-style).
 *   - Root is stable for a given ordered receipt list.
 *
 * Pure module: no DB writes. Caller wires the batch frequency
 * (e.g. every 1 minute) and persists root + leaf-index map for
 * later proof generation.
 */

import { createHash } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface ReceiptInput {
  /** Stable receipt id. */
  receiptId: string;
  /** Canonical projection that gets committed (typically the
   *  same canonical body the HMAC was computed over). */
  canonical: string;
}

export interface MerkleBatch {
  /** Hex root of the batch. */
  root: string;
  /** Number of leaves committed. */
  leafCount: number;
  /** Unix ms when the batch was sealed. */
  sealedAt: number;
  /** Algorithm + domain-separator version (for forward compat). */
  algorithm: "sha256-v1";
}

export interface InclusionProof {
  /** The receipt's leaf hash. */
  leaf: string;
  /** Sibling hashes from leaf up to root. Each entry encodes whether
   *  it's the LEFT or RIGHT sibling. */
  path: Array<{ hash: string; position: "left" | "right" }>;
  /** Expected root the path resolves to. */
  expectedRoot: string;
  /** Original receipt-id, captured here so the proof is self-contained. */
  receiptId: string;
}

export type VerifyOutcome =
  | { ok: true }
  | { ok: false; reason: "root-mismatch" | "leaf-mismatch" | "bad-path" };

// ── Domain-separated helpers ─────────────────────────────────────────────

function leafHash(canonical: string): string {
  return createHash("sha256").update(`leaf|${canonical}`).digest("hex");
}

function nodeHash(left: string, right: string): string {
  return createHash("sha256").update(`node|${left}|${right}`).digest("hex");
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Compute the Merkle root over an ordered list of receipts.
 * Throws on empty input. Order is significant — caller must
 * commit to the order they intend to verify against.
 */
export function commitBatch(
  receipts: ReceiptInput[],
  now: number = Date.now(),
): MerkleBatch {
  if (receipts.length === 0) {
    throw new Error("commitBatch: at least one receipt required");
  }
  let level = receipts.map((r) => leafHash(r.canonical));
  while (level.length > 1) {
    if (level.length % 2 === 1) level.push(level[level.length - 1]);
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(nodeHash(level[i], level[i + 1]));
    }
    level = next;
  }
  return {
    root: level[0],
    leafCount: receipts.length,
    sealedAt: now,
    algorithm: "sha256-v1",
  };
}

/**
 * Build an inclusion proof for receipt at index `leafIndex` in
 * the batch. The proof can be verified against the root WITHOUT
 * the other receipts being known.
 */
export function buildProof(
  receipts: ReceiptInput[],
  leafIndex: number,
): InclusionProof {
  if (leafIndex < 0 || leafIndex >= receipts.length) {
    throw new Error("buildProof: leafIndex out of bounds");
  }
  let level = receipts.map((r) => leafHash(r.canonical));
  let idx = leafIndex;
  const leaf = level[idx];
  const path: InclusionProof["path"] = [];

  while (level.length > 1) {
    if (level.length % 2 === 1) level.push(level[level.length - 1]);
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    path.push({
      hash: level[siblingIdx],
      position: idx % 2 === 0 ? "right" : "left",
    });
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(nodeHash(level[i], level[i + 1]));
    }
    level = next;
    idx = Math.floor(idx / 2);
  }

  return {
    leaf,
    path,
    expectedRoot: level[0],
    receiptId: receipts[leafIndex].receiptId,
  };
}

/**
 * Verify an inclusion proof against a known root. Returns ok:true
 * iff the leaf composes (via the path) into exactly the expected
 * root AND the expected root matches the caller-supplied one.
 */
export function verifyProof(
  proof: InclusionProof,
  rootToCheck: string,
): VerifyOutcome {
  if (proof.expectedRoot !== rootToCheck) {
    return { ok: false, reason: "root-mismatch" };
  }
  let current = proof.leaf;
  for (const step of proof.path) {
    if (step.position === "right") {
      current = nodeHash(current, step.hash);
    } else {
      current = nodeHash(step.hash, current);
    }
  }
  if (current !== rootToCheck) {
    return { ok: false, reason: "bad-path" };
  }
  return { ok: true };
}

/**
 * Convenience: verify that a given receipt's canonical body
 * matches the proof's leaf hash. Combined with verifyProof()
 * this gives the auditor an end-to-end check.
 */
export function verifyLeaf(
  receipt: ReceiptInput,
  proof: InclusionProof,
): VerifyOutcome {
  const expectedLeaf = leafHash(receipt.canonical);
  if (expectedLeaf !== proof.leaf) {
    return { ok: false, reason: "leaf-mismatch" };
  }
  return { ok: true };
}

/**
 * Returns the height of the tree (number of levels above the leaves).
 * Useful for capacity planning + UI rendering.
 */
export function batchHeight(leafCount: number): number {
  if (leafCount <= 1) return 0;
  return Math.ceil(Math.log2(leafCount));
}
