/**
 * SOVEREIGN MATRIX — Envelope encryption for sensitive fields (Cook 122).
 *
 * AES-256-GCM per-field encryption where each field gets its own
 * data encryption key (DEK), and the DEK is itself encrypted by a
 * key-encryption key (KEK) the caller fetches from a KMS / Vault.
 *
 * The threat model:
 *   - Database is breached → ciphertext leaks, but DEKs are wrapped
 *     by the KEK and useless without the KMS.
 *   - One DEK leaks → only the matching field's value is exposed,
 *     not the whole record.
 *   - Selective disclosure (Cook 51) discloses HASHES — this module
 *     discloses VALUES under explicit policy.
 *
 * Pure crypto module. NO I/O — caller wires KMS as a "wrap" /
 * "unwrap" function.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface EncryptedField {
  /** Base64 ciphertext. */
  ciphertext: string;
  /** Base64 GCM auth tag (16 bytes). */
  tag: string;
  /** Base64 IV (12 bytes recommended for GCM). */
  iv: string;
  /** Base64 wrapped DEK. */
  wrappedDek: string;
  /** Stable algorithm tag for forward-compatibility. */
  algorithm: "AES-256-GCM";
}

export type KekWrap = (dek: Buffer) => Promise<Buffer>;
export type KekUnwrap = (wrapped: Buffer) => Promise<Buffer>;

// ── Constants ─────────────────────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm" as const;
const IV_BYTES = 12;
const DEK_BYTES = 32; // 256-bit

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext field with a freshly-generated DEK, then wrap
 * the DEK with the supplied KEK function. Returns an envelope that
 * can be safely persisted in the DB.
 */
export async function encryptField(
  plaintext: string,
  wrap: KekWrap,
): Promise<EncryptedField> {
  if (typeof plaintext !== "string") {
    throw new Error("encryptField: plaintext must be a string");
  }
  const dek = randomBytes(DEK_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, dek, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const wrappedDek = await wrap(dek);
  return {
    ciphertext: ct.toString("base64"),
    tag: tag.toString("base64"),
    iv: iv.toString("base64"),
    wrappedDek: wrappedDek.toString("base64"),
    algorithm: "AES-256-GCM",
  };
}

/**
 * Decrypt an envelope using the caller-supplied KEK unwrap fn.
 * Returns the plaintext on success; throws on tag mismatch (auth
 * failure = ciphertext tampered or wrong KEK).
 */
export async function decryptField(
  envelope: EncryptedField,
  unwrap: KekUnwrap,
): Promise<string> {
  if (envelope.algorithm !== "AES-256-GCM") {
    throw new Error(
      `decryptField: unsupported algorithm '${envelope.algorithm}'`,
    );
  }
  const dek = await unwrap(Buffer.from(envelope.wrappedDek, "base64"));
  if (dek.length !== DEK_BYTES) {
    throw new Error(
      `decryptField: unwrapped DEK has wrong length (${dek.length} != ${DEK_BYTES})`,
    );
  }
  const iv = Buffer.from(envelope.iv, "base64");
  const tag = Buffer.from(envelope.tag, "base64");
  const ct = Buffer.from(envelope.ciphertext, "base64");
  const decipher = createDecipheriv(ALGORITHM, dek, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/**
 * Rotate the KEK: unwrap the existing DEK with the old KEK, re-wrap
 * with the new one, return a new envelope. Ciphertext stays the
 * same — rotation is O(1) per field, not O(plaintext size).
 */
export async function rotateKek(
  envelope: EncryptedField,
  unwrap: KekUnwrap,
  wrap: KekWrap,
): Promise<EncryptedField> {
  const dek = await unwrap(Buffer.from(envelope.wrappedDek, "base64"));
  const wrappedDek = await wrap(dek);
  return { ...envelope, wrappedDek: wrappedDek.toString("base64") };
}

/**
 * Convenience: build an in-memory KEK pair for tests. NEVER use in
 * production — exposes the master key as a closure-captured constant.
 */
export function buildLocalKek(masterKeyHex: string): {
  wrap: KekWrap;
  unwrap: KekUnwrap;
} {
  if (!/^[a-f0-9]{64}$/i.test(masterKeyHex)) {
    throw new Error(
      "buildLocalKek: masterKeyHex must be 64 hex chars (32 bytes)",
    );
  }
  const master = Buffer.from(masterKeyHex, "hex");
  return {
    wrap: async (dek: Buffer) => {
      // Use AES-256-GCM for wrap too. Embed IV + tag inside the
      // wrapped blob so unwrap is self-describing.
      const wIv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, master, wIv);
      const ct = Buffer.concat([cipher.update(dek), cipher.final()]);
      const tag = cipher.getAuthTag();
      return Buffer.concat([wIv, tag, ct]);
    },
    unwrap: async (wrapped: Buffer) => {
      const wIv = wrapped.subarray(0, IV_BYTES);
      const tag = wrapped.subarray(IV_BYTES, IV_BYTES + 16);
      const ct = wrapped.subarray(IV_BYTES + 16);
      const decipher = createDecipheriv(ALGORITHM, master, wIv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ct), decipher.final()]);
    },
  };
}

export const ENVELOPE_CONSTANTS = {
  ALGORITHM,
  IV_BYTES,
  DEK_BYTES,
};
