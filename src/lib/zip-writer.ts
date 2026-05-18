/**
 * SOVEREIGN MATRIX — Pure-Node ZIP writer (Wave 23).
 *
 * Minimal ZIP (STORE method = no compression) implementation in pure
 * Node. We deliberately avoid `archiver` / `jszip` to keep the
 * dependency surface tight; the ZIP we produce is byte-deterministic
 * given the same inputs (no mtime drift, no extra fields), so a
 * downstream verifier can re-derive the manifest hash.
 *
 * Spec: ZIP File Format Specification (.ZIP File Format Specification)
 *       PKWARE Inc., Version 6.3.4 (2014). We implement only the
 *       subset needed for STORE-method file entries — no encryption,
 *       no zip64, no extra fields. Cap: 2GB / 65k files. Plenty for
 *       a tenant's receipt archive; large enough that the format's
 *       deficiencies don't bite.
 *
 * Pairs with /api/me/receipts/export.zip — the route streams the
 * tenant's receipt rows through buildZip() and returns the buffer.
 */

import { createHash } from "crypto";

export interface ZipEntry {
  /** Path inside the archive, forward-slash separated. */
  path: string;
  /** Content bytes. Strings are UTF-8 encoded. */
  data: Buffer | string;
}

/**
 * Build a STORE-method ZIP from a flat entry list. Returns the full
 * archive as a single Buffer.
 *
 * Deterministic: the output bytes depend only on entry order, paths,
 * and contents. The DOS-format mtime fields are zero-stamped so the
 * archive is byte-identical across runs (which is what makes the
 * MANIFEST.signed.json hash meaningful).
 */
export function buildZip(entries: ZipEntry[]): Buffer {
  if (entries.length > 65_535) {
    throw new Error("zip-writer: max 65535 entries (ZIP format limit)");
  }

  // Local file headers + file data, then a central directory at the
  // end. We pre-compute each entry's offset so the central-directory
  // header can point at it.
  const fileChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let runningOffset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.path, "utf8");
    const data =
      typeof entry.data === "string"
        ? Buffer.from(entry.data, "utf8")
        : entry.data;
    if (data.length > 0xffff_ffff) {
      throw new Error(`zip-writer: file too large: ${entry.path}`);
    }
    const crc = crc32(data);
    const size = data.length;

    // Local file header (signature 0x04034b50).
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // version needed = 2.0
    localHeader.writeUInt16LE(0, 6); // general purpose bit flag
    localHeader.writeUInt16LE(0, 8); // compression method = STORE
    localHeader.writeUInt16LE(0, 10); // last mod time (zero — deterministic)
    localHeader.writeUInt16LE(0, 12); // last mod date (zero — deterministic)
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18); // compressed size = uncompressed (STORE)
    localHeader.writeUInt32LE(size, 22); // uncompressed size
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    fileChunks.push(localHeader, nameBytes, data);

    // Central directory header (signature 0x02014b50).
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // general purpose
    centralHeader.writeUInt16LE(0, 10); // compression method = STORE
    centralHeader.writeUInt16LE(0, 12); // last mod time
    centralHeader.writeUInt16LE(0, 14); // last mod date
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20); // compressed size
    centralHeader.writeUInt32LE(size, 24); // uncompressed size
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra field length
    centralHeader.writeUInt16LE(0, 32); // file comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal file attributes
    centralHeader.writeUInt32LE(0, 38); // external file attributes
    centralHeader.writeUInt32LE(runningOffset, 42); // local header offset

    centralChunks.push(centralHeader, nameBytes);

    runningOffset += localHeader.length + nameBytes.length + data.length;
  }

  const centralDir = Buffer.concat(centralChunks);
  const centralOffset = runningOffset;

  // End of central directory record (signature 0x06054b50).
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4); // disk number
  endRecord.writeUInt16LE(0, 6); // disk where central dir starts
  endRecord.writeUInt16LE(entries.length, 8); // entries on this disk
  endRecord.writeUInt16LE(entries.length, 10); // total entries
  endRecord.writeUInt32LE(centralDir.length, 12); // size of central dir
  endRecord.writeUInt32LE(centralOffset, 16); // offset of central dir
  endRecord.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...fileChunks, centralDir, endRecord]);
}

/**
 * SHA-256 hex over a list of entries — concatenates path + bytes
 * deterministically. Used by the MANIFEST.signed.json bundle digest
 * so the verifier can detect any mutation without unzipping.
 */
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

// ── CRC-32 (IEEE 802.3) ───────────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  }
  return (c ^ 0xffffffff) >>> 0;
}
