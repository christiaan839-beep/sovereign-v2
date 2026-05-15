/**
 * SOVEREIGN MATRIX — Receipt-envelope selective disclosure (Cook 112).
 *
 * Extends Cook 51 from "selectively disclose a field of a record"
 * to "selectively disclose a field of THE RECEIPT ENVELOPE itself".
 *
 * The envelope contains metadata an auditor sometimes needs (e.g.
 * `tenantId`, `agentSlug`, `committedAt`) without seeing the input
 * or output. Today the entire receipt is signed as one blob, so the
 * holder either reveals everything or nothing.
 *
 * This module:
 *
 *   1. Serializes the envelope as a flat (key, value) map.
 *   2. Builds a Merkle tree over the keys, same domain-separated
 *      hashing as Cook 51 / Cook 106.
 *   3. The receipt-level signature is now over the Merkle ROOT, not
 *      the raw JSON. That way the holder can publish the root +
 *      reveal any subset of (key, value) + sibling proofs.
 *
 * Pure crypto module — no I/O.
 */

import { createHash } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface EnvelopeRecord {
  [key: string]: string | number | boolean | null;
}

export interface EnvelopeCommit {
  root: string;
  fields: string[];
  leafCount: number;
}

export interface FieldDisclosure {
  field: string;
  value: string | number | boolean | null;
  index: number;
  siblings: string[];
}

// ── Hashing (same separators as Cook 51) ──────────────────────────────────

function hashLeaf(field: string, value: unknown): string {
  return createHash("sha256")
    .update(
      Buffer.concat([
        Buffer.from([0x00]),
        Buffer.from(`${field}|${JSON.stringify(value ?? null)}`),
      ]),
    )
    .digest("hex");
}

function hashInternal(left: string, right: string): string {
  return createHash("sha256")
    .update(
      Buffer.concat([
        Buffer.from([0x01]),
        Buffer.from(left, "hex"),
        Buffer.from(right, "hex"),
      ]),
    )
    .digest("hex");
}

function buildLayers(record: EnvelopeRecord): {
  fields: string[];
  layers: string[][];
} {
  const fields = Object.keys(record).sort();
  if (fields.length === 0) {
    throw new Error("commitEnvelope: at least one field required");
  }
  const leaves = fields.map((f) => hashLeaf(f, record[f]));
  // Pad to power of two.
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

/** Commit an envelope to a Merkle root. The signer signs THIS root. */
export function commitEnvelope(record: EnvelopeRecord): EnvelopeCommit {
  const { fields, layers } = buildLayers(record);
  return {
    root: layers[layers.length - 1][0],
    fields,
    leafCount: layers[0].length,
  };
}

/** Build an inclusion proof for one envelope field. */
export function discloseEnvelopeField(
  record: EnvelopeRecord,
  field: string,
): FieldDisclosure {
  const { fields, layers } = buildLayers(record);
  const index = fields.indexOf(field);
  if (index < 0) {
    throw new Error(`discloseEnvelopeField: '${field}' not in record`);
  }
  const siblings: string[] = [];
  let i = index;
  for (let lvl = 0; lvl < layers.length - 1; lvl++) {
    siblings.push(layers[lvl][i ^ 1]);
    i = Math.floor(i / 2);
  }
  return {
    field,
    value: record[field],
    index,
    siblings,
  };
}

/** Verify a disclosure reconstructs the published envelope root. */
export function verifyEnvelopeDisclosure(
  disclosure: FieldDisclosure,
  root: string,
): boolean {
  let node = hashLeaf(disclosure.field, disclosure.value);
  let i = disclosure.index;
  for (const sibling of disclosure.siblings) {
    if ((i & 1) === 0) {
      node = hashInternal(node, sibling);
    } else {
      node = hashInternal(sibling, node);
    }
    i = Math.floor(i / 2);
  }
  return node === root;
}
