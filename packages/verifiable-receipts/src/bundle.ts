/**
 * Pure-Node ZIP writer + signed receipt bundle.
 *
 * STORE-method ZIP (no compression) in <200 LoC, zero dependencies.
 * Deterministic output bytes given the same inputs (zero-stamped
 * mtime, no extra fields). Caller supplies a sign() callback — the
 * bundle is then a self-contained tamper-evident archive.
 *
 * Use case: "I want every receipt my company ever generated as one
 * ZIP I can hand my auditor." The auditor's verifier re-computes the
 * MANIFEST hash + signature without unzipping.
 */

import { createHash } from "node:crypto";

export interface ZipEntry {
  /** Path inside the archive (forward-slash separated). */
  path: string;
  /** Content bytes. Strings are UTF-8 encoded. */
  data: Buffer | string;
}

/** Build a STORE-method ZIP from a flat entry list. Returns a Buffer. */
export function buildZip(entries: ZipEntry[]): Buffer {
  if (entries.length > 65_535) {
    throw new Error("buildZip: max 65535 entries (ZIP format limit)");
  }
  const fileChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let runningOffset = 0;

  for (const e of entries) {
    const nameBytes = Buffer.from(e.path, "utf8");
    const data =
      typeof e.data === "string" ? Buffer.from(e.data, "utf8") : e.data;
    if (data.length > 0xffff_ffff) {
      throw new Error(`buildZip: file too large: ${e.path}`);
    }
    const crc = crc32(data);
    const size = data.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);
    fileChunks.push(localHeader, nameBytes, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(runningOffset, 42);
    centralChunks.push(centralHeader, nameBytes);

    runningOffset += localHeader.length + nameBytes.length + data.length;
  }

  const centralDir = Buffer.concat(centralChunks);
  const centralOffset = runningOffset;
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralDir.length, 12);
  endRecord.writeUInt32LE(centralOffset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...fileChunks, centralDir, endRecord]);
}

/** SHA-256 over a deterministic concatenation of (path, bytes) pairs. */
export function bundleDigest(entries: ZipEntry[]): string {
  const h = createHash("sha256");
  for (const e of entries) {
    h.update(e.path, "utf8");
    h.update("\0");
    h.update(typeof e.data === "string" ? Buffer.from(e.data, "utf8") : e.data);
    h.update("\0");
  }
  return h.digest("hex");
}

// ── Signed receipt bundle ─────────────────────────────────────────────

export interface BundleReceiptRow {
  id: string;
  agentName: string;
  modelUsed: string;
  durationMs: number;
  createdAt: Date | string;
  signature: string;
  canonical: string;
}

export interface BundleManifest {
  v: 1;
  type: "verifiable-receipt-bundle";
  generatedAt: string;
  receiptCount: number;
  bundleDigest: string;
  manifestHash: string;
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
 * Build a signed bundle. Caller supplies a sign(canonical) → signature
 * function so the bundle stays pure (no Node:crypto signing coupling).
 */
export function buildSignedBundle(
  rows: BundleReceiptRow[],
  sign: (manifestHash: string) => string,
): { zip: Buffer; manifest: BundleManifest } {
  const generatedAt = new Date().toISOString();
  const entries: ZipEntry[] = [];
  for (const r of rows) {
    const id = sanitizePath(r.id);
    const issuedAt =
      r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt;
    entries.push({ path: `receipts/${id}.canonical.txt`, data: r.canonical });
    entries.push({ path: `receipts/${id}.signature.txt`, data: r.signature });
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
  const digest = bundleDigest(entries);
  const body = {
    v: 1 as const,
    type: "verifiable-receipt-bundle" as const,
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
  const manifestHash = sha256OfStable(body);
  const signature = sign(manifestHash);
  const manifest: BundleManifest = { ...body, manifestHash, signature };
  entries.push({
    path: "MANIFEST.signed.json",
    data: JSON.stringify(manifest, null, 2),
  });
  return { zip: buildZip(entries), manifest };
}

/**
 * Verify a manifest. Pure — no unzip needed. Returns one of 4
 * failure modes when invalid.
 */
export function verifyManifest(
  manifest: BundleManifest,
  verify: (canonical: string, signature: string) => boolean,
):
  | { ok: true }
  | {
      ok: false;
      reason:
        | "hash-mismatch"
        | "signature-mismatch"
        | "wrong-type"
        | "wrong-version";
    } {
  if (manifest.type !== "verifiable-receipt-bundle") {
    return { ok: false, reason: "wrong-type" };
  }
  if (manifest.v !== 1) return { ok: false, reason: "wrong-version" };
  const body = {
    v: manifest.v,
    type: manifest.type,
    generatedAt: manifest.generatedAt,
    receiptCount: manifest.receiptCount,
    bundleDigest: manifest.bundleDigest,
    receipts: manifest.receipts,
  };
  if (sha256OfStable(body) !== manifest.manifestHash) {
    return { ok: false, reason: "hash-mismatch" };
  }
  if (!verify(manifest.manifestHash, manifest.signature)) {
    return { ok: false, reason: "signature-mismatch" };
  }
  return { ok: true };
}

// ── Internals ─────────────────────────────────────────────────────────

function sha256OfStable(v: unknown): string {
  return createHash("sha256").update(stableStringify(v), "utf8").digest("hex");
}

function stableStringify(v: unknown): string {
  return JSON.stringify(sortKeysDeep(v));
}

function sortKeysDeep(v: unknown): unknown {
  if (v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(sortKeysDeep);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v as Record<string, unknown>).sort()) {
    out[k] = sortKeysDeep((v as Record<string, unknown>)[k]);
  }
  return out;
}

function sanitizePath(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 128);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  }
  return (c ^ 0xffffffff) >>> 0;
}
