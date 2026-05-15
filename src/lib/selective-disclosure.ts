/**
 * SOVEREIGN MATRIX — Selective disclosure (Cook 51 / Tier 3 #12)
 *
 * Merkle-proof selective disclosure for receipts. A regulator wants
 * proof that one field (e.g. `safetyVerdict: "pass"`) was part of a
 * receipt, WITHOUT seeing every other field. Classic ZK-lite use
 * case — achievable with a Merkle tree of (key, value) hashes plus
 * an inclusion proof.
 *
 * Contract:
 *
 *   1. `commit(record)` returns a `Disclosure` with the Merkle root.
 *      The root is what the receipt holder publishes / embeds in
 *      the existing signed receipt envelope.
 *
 *   2. `discloseField(record, field)` returns a `FieldProof` —
 *      the leaf hash + the sibling path. The holder hands this to
 *      the regulator alongside the claimed value.
 *
 *   3. `verifyDisclosure(field, value, proof, root)` returns
 *      `true` iff the proof witnesses the (field, value) pair
 *      against the published root. No other fields are revealed.
 *
 * NO external crypto deps — uses Node's built-in `createHash`.
 * Pure module: caller persists the root; module only computes.
 */

import { createHash } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface DisclosureRecord {
  /** Stable field name → value. Values are serialized via JSON.stringify. */
  [field: string]: unknown;
}

export interface Disclosure {
  /** Hex Merkle root (32 bytes / 64 chars). */
  root: string;
  /** Sorted field names — caller publishes these as the "schema". */
  fields: string[];
  /** Total number of leaves (power-of-two padded). */
  leafCount: number;
}

export interface FieldProof {
  /** Field name being disclosed. */
  field: string;
  /** Index of the leaf in the sorted leaf list. */
  index: number;
  /** Sibling hashes from leaf up to (but not including) the root. */
  siblings: string[];
}

// ── Hashing helpers ───────────────────────────────────────────────────────

function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Hash a single (field, value) leaf. Prefixed with `0x00` to make
 * second-pre-image attacks against internal nodes impossible — every
 * leaf hash starts with a different domain separator than every
 * internal node hash.
 */
export function hashLeaf(field: string, value: unknown): string {
  const payload = `${field}|${JSON.stringify(value ?? null)}`;
  return sha256Hex(Buffer.concat([Buffer.from([0x00]), Buffer.from(payload)]));
}

/**
 * Hash an internal node. Prefixed with `0x01` for the same domain-
 * separation reason.
 */
function hashInternal(left: string, right: string): string {
  return sha256Hex(
    Buffer.concat([
      Buffer.from([0x01]),
      Buffer.from(left, "hex"),
      Buffer.from(right, "hex"),
    ]),
  );
}

// ── Tree construction ─────────────────────────────────────────────────────

/**
 * Sort the record's fields alphabetically (deterministic), hash each
 * leaf, then pad to the next power of two by repeating the last leaf
 * (standard Bitcoin-style padding). Returns the full tree as layered
 * hash arrays.
 */
function buildTree(record: DisclosureRecord): {
  fields: string[];
  layers: string[][];
} {
  const fields = Object.keys(record).sort();
  if (fields.length === 0) {
    throw new Error("buildTree: record must have at least one field");
  }
  const leaves = fields.map((f) => hashLeaf(f, record[f]));
  // Pad to next power of two.
  while ((leaves.length & (leaves.length - 1)) !== 0) {
    leaves.push(leaves[leaves.length - 1]);
  }
  const layers: string[][] = [leaves];
  while (layers[layers.length - 1].length > 1) {
    const prev = layers[layers.length - 1];
    const next: string[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push(hashInternal(prev[i], prev[i + 1]));
    }
    layers.push(next);
  }
  return { fields, layers };
}

// ── Public API ────────────────────────────────────────────────────────────

/** Commit a record. The root is the auditor-facing fingerprint. */
export function commit(record: DisclosureRecord): Disclosure {
  const { fields, layers } = buildTree(record);
  return {
    root: layers[layers.length - 1][0],
    fields,
    leafCount: layers[0].length,
  };
}

/**
 * Produce a proof for a single field. Throws if the field is not in
 * the record.
 */
export function discloseField(
  record: DisclosureRecord,
  field: string,
): FieldProof {
  const { fields, layers } = buildTree(record);
  const index = fields.indexOf(field);
  if (index < 0) {
    throw new Error(`discloseField: field '${field}' not in record`);
  }
  const siblings: string[] = [];
  let i = index;
  // Padded index — same as real leaf index because padding only adds at the end.
  for (let lvl = 0; lvl < layers.length - 1; lvl++) {
    const layer = layers[lvl];
    const siblingIdx = i ^ 1; // flip last bit: gives the pair partner.
    siblings.push(layer[siblingIdx]);
    i = Math.floor(i / 2);
  }
  return { field, index, siblings };
}

/**
 * Verify a (field, value) proof against a published root. Returns
 * `true` iff the proof reconstructs the root exactly.
 *
 * SECURITY: the index parity is what tells the verifier whether the
 * sibling hash sits on the left or right at each level. A tampered
 * index would change the parity → reconstruction fails.
 */
export function verifyDisclosure(
  field: string,
  value: unknown,
  proof: FieldProof,
  root: string,
): boolean {
  if (proof.field !== field) return false;
  let node = hashLeaf(field, value);
  let i = proof.index;
  for (const sibling of proof.siblings) {
    if ((i & 1) === 0) {
      node = hashInternal(node, sibling);
    } else {
      node = hashInternal(sibling, node);
    }
    i = Math.floor(i / 2);
  }
  return node === root;
}
