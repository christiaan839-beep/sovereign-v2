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
