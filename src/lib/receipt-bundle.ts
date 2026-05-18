/**
 * SOVEREIGN MATRIX — Signed receipt bundle (Wave 23).
 *
 * Composes the Wave-7 receipt-replay primitives with the Wave-23 ZIP
 * writer to produce "I want every receipt my company has ever
 * generated as a single ZIP" — the procurement-team request that
 * every other AI vendor has to say "no" to.
 *
 * Output layout (in the ZIP):
 *   receipts/<receipt-id>.canonical.txt   — re-derived canonical bytes
 *   receipts/<receipt-id>.signature.txt   — stored wire signature
 *   receipts/<receipt-id>.meta.json       — id, agent, model, ts, duration
 *   MANIFEST.signed.json                   — index + bundle digest + signature
 *
 * The MANIFEST is signed with the platform's signRun primitive, so a
 * verifier can re-derive the bundle digest and re-check the signature
 * with the public Ed25519 key — no platform call required at verify time.
 */

import { createHash } from "crypto";
import { signRun, verifySignature } from "@/lib/agent-runs";
import { buildZip, bundleDigest, type ZipEntry } from "@/lib/zip-writer";

export interface BundleReceiptRow {
  id: string;
  agentName: string;
  modelUsed: string;
  durationMs: number;
  createdAt: Date | string;
  signature: string;
  /** Caller-supplied re-derived canonical projection. */
  canonical: string;
}

export interface BundleManifest {
  v: 1;
  type: "sovereign-receipt-bundle";
  generatedAt: string;
  receiptCount: number;
  bundleDigest: string;
  /** SHA-256 hex of the manifest body itself (excluding `signature`). */
  manifestHash: string;
  /** v1=hmac / v2=ed25519 / v3=dual signature over manifestHash. */
  signature: string;
  receipts: Array<{
    id: string;
    agentName: string;
    modelUsed: string;
    issuedAt: string;
    signature: string;
  }>;
}

/**
 * Build a signed ZIP bundle from a list of receipt rows. Returns
 * `{ zip, manifest }` — the route streams the buffer as the response
 * and includes the manifest separately so logs / audit trails can
 * cite the bundleDigest.
 */
export function buildSignedReceiptBundle(rows: BundleReceiptRow[]): {
  zip: Buffer;
  manifest: BundleManifest;
} {
  const generatedAt = new Date().toISOString();

  // Project each row into 3 entries: canonical, signature, meta.
  const entries: ZipEntry[] = [];
  for (const r of rows) {
    const id = sanitizePath(r.id);
    const issuedAt =
      r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt;
    entries.push({
      path: `receipts/${id}.canonical.txt`,
      data: r.canonical,
    });
    entries.push({
      path: `receipts/${id}.signature.txt`,
      data: r.signature,
    });
    entries.push({
      path: `receipts/${id}.meta.json`,
      data: JSON.stringify(
        {
          id: r.id,
          agentName: r.agentName,
          modelUsed: r.modelUsed,
          durationMs: r.durationMs,
          issuedAt,
        },
        null,
        2,
      ),
    });
  }

  // Compute the bundle digest BEFORE injecting the manifest. Manifest
  // is itself an entry but its contents depend on the digest, so we
  // hash the receipt-only entry set and bind the result into the
  // manifest payload.
  const digest = bundleDigest(entries);

  // Build the manifest body (excluding the signature field), hash it,
  // sign the hash. This split lets the verifier re-derive the hash
  // from the body and check the signature independently.
  const manifestBodyForHashing = {
    v: 1 as const,
    type: "sovereign-receipt-bundle" as const,
    generatedAt,
    receiptCount: rows.length,
    bundleDigest: digest,
    receipts: rows.map((r) => ({
      id: r.id,
      agentName: r.agentName,
      modelUsed: r.modelUsed,
      issuedAt:
        r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      signature: r.signature,
    })),
  };
  const manifestHash = sha256OfStableJson(manifestBodyForHashing);
  const signature = signRun(manifestHash);

  const manifest: BundleManifest = {
    ...manifestBodyForHashing,
    manifestHash,
    signature,
  };

  // Inject the signed manifest as the final entry. ZIP entry order
  // is preserved so the bundleDigest (which uses receipt entries
  // only) stays meaningful — the manifest is appended at the end.
  entries.push({
    path: "MANIFEST.signed.json",
    data: JSON.stringify(manifest, null, 2),
  });

  return { zip: buildZip(entries), manifest };
}

/**
 * Verify a manifest object. Pure — does NOT require unzipping; the
 * caller hands the parsed manifest, we re-derive the hash and check
 * the stored signature against it.
 *
 * Returns 4 failure modes:
 *   - hash-mismatch: manifest body doesn't reproduce manifestHash
 *   - signature-mismatch: stored signature fails over recomputed hash
 *   - wrong-type / wrong-version: protocol marker drift
 */
export function verifyManifest(manifest: BundleManifest):
  | { ok: true }
  | {
      ok: false;
      reason:
        | "hash-mismatch"
        | "signature-mismatch"
        | "wrong-type"
        | "wrong-version";
    } {
  if (manifest.type !== "sovereign-receipt-bundle") {
    return { ok: false, reason: "wrong-type" };
  }
  if (manifest.v !== 1) {
    return { ok: false, reason: "wrong-version" };
  }
  const body = {
    v: manifest.v,
    type: manifest.type,
    generatedAt: manifest.generatedAt,
    receiptCount: manifest.receiptCount,
    bundleDigest: manifest.bundleDigest,
    receipts: manifest.receipts,
  };
  const recomputed = sha256OfStableJson(body);
  if (recomputed !== manifest.manifestHash) {
    return { ok: false, reason: "hash-mismatch" };
  }
  // Validate the signature with the receipt-runs verifier — same
  // primitive every signed surface uses.
  if (!verifySignature(recomputed, manifest.signature)) {
    return { ok: false, reason: "signature-mismatch" };
  }
  return { ok: true };
}

// ── Internals ─────────────────────────────────────────────────────────

function sha256OfStableJson(value: unknown): string {
  return createHash("sha256")
    .update(stableStringify(value), "utf8")
    .digest("hex");
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>).sort()) {
    out[k] = sortKeysDeep((value as Record<string, unknown>)[k]);
  }
  return out;
}

/** Strip path-traversal characters from a receipt id before use as a
 *  ZIP path. Receipt ids are UUIDs or kebab slugs anyway; this is
 *  defense-in-depth. */
function sanitizePath(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
}
