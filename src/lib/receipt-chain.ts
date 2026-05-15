/**
 * RECEIPT-CHAIN — tamper-evident Merkle root over a tenant's receipts.
 *
 * Every individual receipt is HMAC-signed (see src/lib/agent-runs.ts).
 * That gives per-receipt tamper-evidence: change one byte, signature
 * breaks. But it doesn't prevent an adversary with DB write access
 * from DELETING or REORDERING receipts — past Sovereign-signed
 * receipts could be silently dropped from a tenant's history.
 *
 * This module closes that gap. We compute a Merkle tree over the set
 * of a tenant's receipt signatures (sorted by createdAt for determinism),
 * sign the resulting root, and expose it at:
 *
 *   GET  /api/me/audit-root             — current root for the caller
 *   GET  /api/me/audit-bundle           — full signed evidence pack
 *
 * A consumer who has snapshotted last month's root can detect ANY
 * change to the tenant's historical receipts — additions, deletions,
 * mutations. The root is a single SHA-256 hash; the audit guarantee
 * scales to millions of receipts at constant verification cost.
 *
 * Why SHA-256 here vs HMAC for individual receipts: the root is
 * derivable from public data (the receipt signatures themselves are
 * already public when the receipt is public), so HMAC adds no
 * security — anyone could recompute. We additionally HMAC-sign the
 * root + count + timestamp envelope so a third party can prove
 * Sovereign attested to a specific root at a specific time.
 *
 * Algorithm (deterministic, byte-stable):
 *   1. Collect (receiptId, signature, createdAtIso) for the tenant
 *   2. Sort by (createdAtIso ascending, receiptId ascending — tiebreak)
 *   3. Build a binary Merkle tree:
 *      - leaf hash    = sha256("LEAF\0" || id || "\0" || signature)
 *      - branch hash  = sha256("NODE\0" || left || right)
 *      - if odd at any level, duplicate the last node (Bitcoin convention)
 *   4. Root = top-level hash, lowercase hex
 *   5. Envelope = canonicalize({v:1, root, count, computedAt}) + HMAC-SHA256
 *
 * The envelope (not the bare root) is what /api/me/audit-root returns
 * + what /api/me/audit-bundle embeds. A third-party verifier can:
 *   1. Pull all the tenant's receipts at time T
 *   2. Recompute the Merkle root
 *   3. POST {canonical: envelope, signature} to /api/verify
 * — proving Sovereign attested to the historical receipt set, with
 * no possibility of silent backdating or tampering.
 */

import { createHash } from "crypto";
import { signRun } from "@/lib/agent-runs";

export interface ReceiptForChain {
  id: string;
  signature: string;
  createdAt: Date | string;
}

export interface ChainRootEnvelope {
  v: 1;
  root: string; // 64-char lowercase hex
  count: number;
  computedAt: string; // ISO 8601
}

export interface SignedChainRoot {
  envelope: ChainRootEnvelope;
  /** canonical = JSON.stringify(envelope) — signed verbatim. */
  canonical: string;
  /** "v1=<hex>" or "unsigned" if AGENT_RUN_SIGNING_SECRET not set. */
  signature: string;
}

const EMPTY_ROOT =
  "0000000000000000000000000000000000000000000000000000000000000000";

function sha256Hex(input: string | Buffer): string {
  return createHash("sha256")
    .update(typeof input === "string" ? Buffer.from(input, "utf8") : input)
    .digest("hex");
}

function leafHash(id: string, signature: string): string {
  // Domain-separated leaf hash. The "LEAF\0" prefix prevents a leaf
  // hash from being mistaken for a branch hash (or vice versa) by a
  // pre-image attack.
  return sha256Hex(`LEAF\0${id}\0${signature}`);
}

function nodeHash(left: string, right: string): string {
  return sha256Hex(`NODE\0${left}${right}`);
}

/**
 * Compute the Merkle root over a tenant's receipts. Pure function:
 * deterministic for the same input set, regardless of input order.
 *
 * Returns EMPTY_ROOT (64 zeros) for an empty tenant — distinguishable
 * from any real root and stable across runs.
 */
export function computeMerkleRoot(receipts: ReceiptForChain[]): string {
  if (receipts.length === 0) return EMPTY_ROOT;

  // Stable sort: createdAt ascending, then id ascending to break ties.
  const sorted = [...receipts].sort((a, b) => {
    const ta = (
      a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt
    ) as string;
    const tb = (
      b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt
    ) as string;
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  let level = sorted.map((r) => leafHash(r.id, r.signature));

  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      // Bitcoin convention: duplicate last node when odd-count level.
      const right = level[i + 1] ?? left;
      next.push(nodeHash(left, right));
    }
    level = next;
  }

  return level[0]!;
}

/**
 * Wrap a Merkle root in a versioned envelope, canonicalize, and sign.
 * The signed envelope is what gets returned by /api/me/audit-root and
 * embedded in audit-bundle exports.
 */
export function buildSignedChainRoot(
  receipts: ReceiptForChain[],
  computedAt: Date = new Date(),
): SignedChainRoot {
  const root = computeMerkleRoot(receipts);
  const envelope: ChainRootEnvelope = {
    v: 1,
    root,
    count: receipts.length,
    computedAt: computedAt.toISOString(),
  };
  // The canonical projection here is just JSON.stringify of the envelope
  // in declared field order. No nested objects to sortKeysDeep — the
  // envelope shape is fixed at v1.
  const canonical = JSON.stringify(envelope);
  const signature = signRun(canonical);
  return { envelope, canonical, signature };
}

/**
 * Re-derive the canonical projection from an envelope (deterministic).
 * Used by third-party verifiers and our own /api/verify endpoint —
 * they can pass {canonical, signature} to /api/verify without needing
 * to know our exact field-order convention. This function IS that
 * convention.
 */
export function canonicalizeChainRoot(envelope: ChainRootEnvelope): string {
  return JSON.stringify({
    v: envelope.v,
    root: envelope.root,
    count: envelope.count,
    computedAt: envelope.computedAt,
  });
}

// ─── Merkle inclusion proofs ────────────────────────────────────────────
//
// The compounding property of receipt chains: per-receipt HMAC catches
// individual tampering. The Merkle root catches set-level tampering
// (deletions / reorderings / silent drops). Inclusion proofs are the
// third leg — they let a holder of ONE receipt prove that THAT receipt
// is part of the issuer's signed audit chain, without downloading the
// whole tenant's history.
//
// A consumer of a receipt + inclusion proof + signed chain root can:
//   1. Recompute the leaf hash from the receipt (id + signature).
//   2. Walk the proof's sibling hashes up the tree to compute a root.
//   3. Compare the computed root to the signed root in the chain
//      envelope.
//   4. POST the chain envelope's canonical+signature to /api/verify
//      to confirm the issuer attested to that root.
//
// If all three checks pass, the consumer has proven:
//   • the receipt is real (HMAC over its canonical projection)
//   • the receipt is in the issuer's official set at attestation time
//   • the issuer signed off on that set
// — without trusting the issuer between any two of these steps.
//
// Proof size is O(log N) — for 1M receipts, the proof is ~20 hashes.

export interface InclusionProof {
  /** The leaf hash (sha256 over LEAF\0 || id || \0 || signature). */
  leaf: string;
  /** Index of the leaf in the sorted leaf list. */
  index: number;
  /** Total leaf count at proof time. */
  leafCount: number;
  /**
   * Sibling hashes from leaf level up to root, paired with their position
   * (left/right) so the verifier knows the concat order.
   */
  siblings: Array<{ hash: string; position: "left" | "right" }>;
  /** Convenience: the root the verifier should arrive at. */
  expectedRoot: string;
}

/**
 * Build a Merkle inclusion proof for a single receipt within a tenant's
 * receipt set. Returns null if `targetId` isn't in the set.
 *
 * The proof + the matching receipt + the signed chain root envelope is
 * enough for a third party to verify INCLUSION + AUTHENTICITY in O(log N)
 * hashes without downloading the whole tenant history.
 */
export function buildInclusionProof(
  receipts: ReceiptForChain[],
  targetId: string,
): InclusionProof | null {
  if (receipts.length === 0) return null;

  // Same deterministic sort as computeMerkleRoot — must match exactly.
  const sorted = [...receipts].sort((a, b) => {
    const ta = (
      a.createdAt instanceof Date ? a.createdAt.toISOString() : a.createdAt
    ) as string;
    const tb = (
      b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt
    ) as string;
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const idx = sorted.findIndex((r) => r.id === targetId);
  if (idx < 0) return null;

  const leaves = sorted.map((r) => leafHash(r.id, r.signature));
  const leaf = leaves[idx]!;

  // Build the proof by walking up the tree, recording the sibling hash
  // at each level. Position records whether the sibling sits to the LEFT
  // or RIGHT of the current node — required for the verifier to recompute
  // the parent in the correct order (sha256(LEFT || RIGHT)).
  const siblings: InclusionProof["siblings"] = [];
  let level = leaves;
  let currentIdx = idx;

  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1] ?? left; // duplicate-last-on-odd
      next.push(nodeHash(left, right));
    }

    // Record sibling for currentIdx in this level.
    const isLeftChild = currentIdx % 2 === 0;
    const siblingIdx = isLeftChild ? currentIdx + 1 : currentIdx - 1;
    const siblingHash = level[siblingIdx] ?? level[currentIdx]!;
    siblings.push({
      hash: siblingHash,
      position: isLeftChild ? "right" : "left",
    });

    currentIdx = Math.floor(currentIdx / 2);
    level = next;
  }

  return {
    leaf,
    index: idx,
    leafCount: leaves.length,
    siblings,
    expectedRoot: level[0]!,
  };
}

/**
 * Verify a Merkle inclusion proof. Pure function: reconstruct the root
 * by walking the sibling hashes from the leaf up, and compare to
 * `expectedRoot`.
 *
 * Returns true iff the proof recomputes to the expected root. The
 * `expectedRoot` value should be cross-checked against the signed
 * chain envelope's `envelope.root` separately — this function only
 * proves the leaf belongs to a tree with the given root, not that
 * the root itself was signed.
 */
export function verifyInclusionProof(proof: InclusionProof): boolean {
  if (!/^[0-9a-f]{64}$/i.test(proof.leaf)) return false;
  if (!/^[0-9a-f]{64}$/i.test(proof.expectedRoot)) return false;

  let acc = proof.leaf;
  for (const sib of proof.siblings) {
    if (!/^[0-9a-f]{64}$/i.test(sib.hash)) return false;
    acc =
      sib.position === "right"
        ? nodeHash(acc, sib.hash)
        : nodeHash(sib.hash, acc);
  }
  return acc === proof.expectedRoot;
}

/**
 * Compute the leaf hash for a (id, signature) pair using the same
 * domain-separated SHA-256 as the chain. Exposed so external verifiers
 * (other languages, audit tools) can independently derive the leaf
 * from a receipt without depending on this lib.
 */
export function computeLeafHash(id: string, signature: string): string {
  return leafHash(id, signature);
}
