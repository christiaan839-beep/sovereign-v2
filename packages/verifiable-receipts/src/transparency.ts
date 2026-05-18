/**
 * AI Receipt Transparency Log — RFC 6962-style append-only Merkle tree.
 *
 * Solves the trust gap between regulators and AI vendors: today a
 * regulator must believe each vendor's audit logs are intact. With a
 * transparency log + independent witnesses, the vendor's claim "we
 * signed receipt X at time T" is checkable against a public,
 * append-only structure the vendor doesn't control. Forks and rewrites
 * are mathematically detectable.
 *
 * The log is a Merkle tree built by appending leaf hashes one at a
 * time. The root at size N is committed in a Signed Tree Head (STH)
 * — an Ed25519 signature over (size, rootHash, timestamp, logId).
 *
 * Two proof types:
 *   - Inclusion proof — "this leaf is in the tree at size N".
 *   - Consistency proof — "tree of size M is an append-only extension
 *     of tree of size N" (catches forks).
 *
 * Hash domains follow RFC 6962 §2.1:
 *   leaf  = SHA-256(0x00 || leaf_bytes)
 *   inner = SHA-256(0x01 || left || right)
 *
 * Pure module — only `crypto.createHash`. No I/O, no platform
 * coupling. Caller owns leaf storage and STH signing.
 *
 * @packageDocumentation
 */

import { createHash } from "node:crypto";

const LEAF_PREFIX = Buffer.from([0x00]);
const INNER_PREFIX = Buffer.from([0x01]);

// ── Primitive hashes ──────────────────────────────────────────────────

/**
 * Leaf hash per RFC 6962 §2.1. The 0x00 domain-separator prevents
 * second-preimage attacks where an inner-node value could be
 * masqueraded as a leaf.
 */
export function leafHash(data: Buffer | string): string {
  const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : data;
  return createHash("sha256").update(LEAF_PREFIX).update(bytes).digest("hex");
}

/**
 * Inner-node hash per RFC 6962 §2.1. The 0x01 domain-separator
 * prevents an inner hash being misread as a leaf.
 */
export function innerHash(leftHex: string, rightHex: string): string {
  return createHash("sha256")
    .update(INNER_PREFIX)
    .update(Buffer.from(leftHex, "hex"))
    .update(Buffer.from(rightHex, "hex"))
    .digest("hex");
}

// ── Tree-head root ────────────────────────────────────────────────────

/**
 * Largest power of two strictly less than n. Required by RFC 6962
 * subtree decomposition.
 */
function largestPowerOfTwoLessThan(n: number): number {
  if (n < 2) throw new Error("requires n >= 2");
  let k = 1;
  while (k * 2 < n) k *= 2;
  return k;
}

/**
 * RFC 6962 Merkle Tree Hash (MTH) over an ordered list of leaf hashes.
 * leafHashes MUST already be hashed via leafHash().
 *
 * Empty list → SHA-256 of empty input (the canonical empty-tree root).
 */
export function treeRoot(leafHashes: readonly string[]): string {
  if (leafHashes.length === 0) {
    // RFC 6962 §2.1: MTH({}) = SHA-256()
    return createHash("sha256").digest("hex");
  }
  if (leafHashes.length === 1) return leafHashes[0];
  const k = largestPowerOfTwoLessThan(leafHashes.length);
  const left = treeRoot(leafHashes.slice(0, k));
  const right = treeRoot(leafHashes.slice(k));
  return innerHash(left, right);
}

// ── Inclusion proof ───────────────────────────────────────────────────

/**
 * Audit path for leaf index `idx` against the tree of size `n`.
 * Returns the list of sibling hashes needed to recompute the root.
 * Algorithm: RFC 6962 §2.1.1.
 */
export function inclusionProof(
  idx: number,
  leafHashes: readonly string[],
): string[] {
  const n = leafHashes.length;
  if (n === 0) throw new Error("empty tree has no leaves");
  if (idx < 0 || idx >= n)
    throw new Error(`idx ${idx} out of range for tree size ${n}`);
  return path(idx, leafHashes);
}

function path(m: number, leaves: readonly string[]): string[] {
  const n = leaves.length;
  if (n === 1) return [];
  const k = largestPowerOfTwoLessThan(n);
  if (m < k) {
    // The leaf is in the left half. Sibling is the right subtree root.
    return [...path(m, leaves.slice(0, k)), treeRoot(leaves.slice(k))];
  }
  // The leaf is in the right half. Sibling is the left subtree root.
  return [...path(m - k, leaves.slice(k)), treeRoot(leaves.slice(0, k))];
}

/**
 * Number of bits required to represent `n` (with `bitsLen(0) === 0`).
 * Mirrors Go's `bits.Len64`, used by the standard RFC 6962 verifier
 * decomposition.
 */
function bitsLen(n: number): number {
  let len = 0;
  let x = n;
  while (x > 0) {
    x = Math.floor(x / 2);
    len++;
  }
  return len;
}

/** Number of set bits in `n`. Used to compute the "border" proof length. */
function onesCount(n: number): number {
  let x = n;
  let c = 0;
  while (x > 0) {
    c += x & 1;
    x = Math.floor(x / 2);
  }
  return c;
}

/**
 * Verify an inclusion proof. Returns true iff folding `leafHash` with
 * `proof` along the bit-pattern of `idx` reproduces `rootHash`.
 *
 * Algorithm: decomposed proof per the standard CT (RFC 6962) verifier
 * — an "inner" segment that walks the bits of `idx` and a "border"
 * segment of left-siblings up the right edge. Empirically the only
 * algorithm that gets every odd-tree-size right.
 */
export function verifyInclusionProof(
  leafHashHex: string,
  idx: number,
  treeSize: number,
  proof: readonly string[],
  rootHashHex: string,
): boolean {
  if (idx < 0 || idx >= treeSize) return false;
  if (treeSize === 1) {
    return proof.length === 0 && leafHashHex === rootHashHex;
  }
  const inner = bitsLen(idx ^ (treeSize - 1));
  const border = onesCount(Math.floor(idx / Math.pow(2, inner)));
  if (proof.length !== inner + border) return false;

  let hash = leafHashHex;
  // Inner segment: walk the bits of `idx`. Bit=0 → sibling on the right;
  // bit=1 → sibling on the left.
  for (let i = 0; i < inner; i++) {
    const sib = proof[i];
    if (Math.floor(idx / Math.pow(2, i)) % 2 === 0) {
      hash = innerHash(hash, sib);
    } else {
      hash = innerHash(sib, hash);
    }
  }
  // Border segment: every remaining sibling combines on the LEFT
  // (these are left-children we skipped while walking up the right edge).
  for (let i = 0; i < border; i++) {
    hash = innerHash(proof[inner + i], hash);
  }
  return hash === rootHashHex;
}

// ── Consistency proof ─────────────────────────────────────────────────

/**
 * Consistency proof from an old tree of size `oldSize` to the current
 * tree of size `newSize`. Catches log forks: the proof folds to two
 * roots, both of which MUST match the published STHs at the two sizes.
 *
 * Algorithm: RFC 6962 §2.1.2 "proof of consistency".
 */
export function consistencyProof(
  oldSize: number,
  leafHashes: readonly string[],
): string[] {
  const newSize = leafHashes.length;
  if (oldSize < 0 || oldSize > newSize)
    throw new Error(`oldSize ${oldSize} out of range for newSize ${newSize}`);
  if (oldSize === 0 || oldSize === newSize) return [];
  return subproof(oldSize, leafHashes, true);
}

function subproof(
  m: number,
  leaves: readonly string[],
  isOriginalSubtree: boolean,
): string[] {
  const n = leaves.length;
  if (m === n) {
    return isOriginalSubtree ? [] : [treeRoot(leaves)];
  }
  if (m < n) {
    const k = largestPowerOfTwoLessThan(n);
    if (m <= k) {
      return [
        ...subproof(m, leaves.slice(0, k), isOriginalSubtree),
        treeRoot(leaves.slice(k)),
      ];
    }
    return [
      ...subproof(m - k, leaves.slice(k), false),
      treeRoot(leaves.slice(0, k)),
    ];
  }
  throw new Error("subproof invariant: m > n");
}

/**
 * Verify a consistency proof. Returns true iff:
 *   - the proof folds to the old root at the old size
 *   - the same proof folds to the new root at the new size
 *
 * Algorithm: RFC 6962 §2.1.2. Implementation walks the bit-pattern
 * of (oldSize-1) and the leaf-count delta to derive both roots from
 * the proof without re-hashing the whole tree.
 */
/**
 * Recursive walker that mirrors the RFC 6962 §2.1.2 subproof builder
 * exactly. Returns the reconstructed (oldHash, newHash) at this level
 * of the tree along with the number of proof elements consumed.
 * `null` means a proof slot was missing or out of range.
 *
 * Invariant: `idx` points at the next unread proof element. The
 * caller checks the final `idx === proof.length` so that a too-long
 * proof is also rejected (defense against proof-padding attacks).
 */
function reconstructConsistency(
  m: number,
  n: number,
  oldRootAtTop: string,
  proof: readonly string[],
  idx: number,
  isOriginalSubtree: boolean,
): { oldHash: string; newHash: string; idx: number } | null {
  if (m === n) {
    if (isOriginalSubtree) {
      // The subtree of size m=n is exactly the original tree at this
      // depth. Both halves of the consistency proof commit to oldRoot.
      return { oldHash: oldRootAtTop, newHash: oldRootAtTop, idx };
    }
    // Non-original m===n subtree: the proof carries MTH(D[m]) directly.
    if (idx >= proof.length) return null;
    return { oldHash: proof[idx], newHash: proof[idx], idx: idx + 1 };
  }
  const k = largestPowerOfTwoLessThan(n);
  if (m <= k) {
    // Descended left; the new tree appended a right subtree the old
    // tree doesn't have.
    const left = reconstructConsistency(
      m,
      k,
      oldRootAtTop,
      proof,
      idx,
      isOriginalSubtree,
    );
    if (left === null) return null;
    if (left.idx >= proof.length) return null;
    const rightSib = proof[left.idx];
    return {
      oldHash: left.oldHash,
      newHash: innerHash(left.newHash, rightSib),
      idx: left.idx + 1,
    };
  }
  // m > k — old tree's coverage spans both the left subtree (in full)
  // and part of the right subtree. Descend right with isOriginal=false.
  const right = reconstructConsistency(
    m - k,
    n - k,
    oldRootAtTop,
    proof,
    idx,
    false,
  );
  if (right === null) return null;
  if (right.idx >= proof.length) return null;
  const leftSib = proof[right.idx];
  return {
    oldHash: innerHash(leftSib, right.oldHash),
    newHash: innerHash(leftSib, right.newHash),
    idx: right.idx + 1,
  };
}

export function verifyConsistencyProof(
  oldSize: number,
  newSize: number,
  oldRootHex: string,
  newRootHex: string,
  proof: readonly string[],
): boolean {
  if (oldSize > newSize) return false;
  if (oldSize === newSize) {
    return proof.length === 0 && oldRootHex === newRootHex;
  }
  if (oldSize === 0) {
    // Vacuously consistent — every tree extends the empty tree.
    return proof.length === 0;
  }
  const result = reconstructConsistency(
    oldSize,
    newSize,
    oldRootHex,
    proof,
    0,
    true,
  );
  if (result === null) return false;
  if (result.idx !== proof.length) return false;
  return result.oldHash === oldRootHex && result.newHash === newRootHex;
}

// ── Signed Tree Head ──────────────────────────────────────────────────

/**
 * Signed Tree Head — the issuer's commitment to the log state at a
 * point in time. An auditor checks that successive STHs from the
 * same logId are consistency-provable.
 */
export interface SignedTreeHead {
  v: 1;
  logId: string;
  treeSize: number;
  rootHash: string; // hex
  timestamp: string; // ISO 8601
  signature?: string; // v2= or v3= wire format, applied by caller
}

/**
 * Canonical byte projection of an STH, used as the signing input.
 * Stable across implementations — keys sorted, no whitespace, the
 * `signature` field omitted before signing.
 */
export function canonicalizeSth(
  sth: Omit<SignedTreeHead, "signature">,
): string {
  return JSON.stringify({
    logId: sth.logId,
    rootHash: sth.rootHash,
    timestamp: sth.timestamp,
    treeSize: sth.treeSize,
    v: sth.v,
  });
}

/**
 * Build an unsigned STH for the current leaf set. The caller signs
 * `canonicalizeSth(sth)` with their preferred primitive and attaches
 * the signature to the returned envelope.
 */
export function buildSth(
  logId: string,
  leafHashes: readonly string[],
  now: () => Date = () => new Date(),
): SignedTreeHead {
  return {
    v: 1,
    logId,
    treeSize: leafHashes.length,
    rootHash: treeRoot(leafHashes),
    timestamp: now().toISOString(),
  };
}
