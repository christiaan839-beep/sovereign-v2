/**
 * SOVEREIGN MATRIX — Encryption Utilities
 *
 * AES-256-GCM encryption for API keys stored in the database.
 * Requires ENCRYPTION_KEY env var (32-byte hex string).
 *
 * Usage:
 *   import { encrypt, decrypt } from "@/lib/crypto";
 *   const encrypted = encrypt(apiKey);
 *   const decrypted = decrypt(encrypted);
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      "ENCRYPTION_KEY environment variable is required for API key encryption",
    );
  }
  const keyBuffer = Buffer.from(key, "hex");
  if (keyBuffer.length !== 32) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes)",
    );
  }
  return keyBuffer;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns a base64 string containing: IV + ciphertext + auth tag.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Pack: IV (12) + encrypted data + auth tag (16)
  const result = Buffer.concat([iv, encrypted, tag]);
  return result.toString("base64");
}

/**
 * Decrypt a base64 string produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const data = Buffer.from(ciphertext, "base64");

  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(data.length - TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH, data.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Check if a string looks like it was encrypted by us (base64 with correct min length).
 */
export function isEncrypted(value: string): boolean {
  try {
    const data = Buffer.from(value, "base64");
    return data.length > IV_LENGTH + TAG_LENGTH;
  } catch {
    return false;
  }
}

/**
 * Safely encrypt.
 *
 * Production: ENCRYPTION_KEY is mandatory. Missing key → hard throw
 * (we never want to silently store API keys / PII in plaintext on a
 * regulated tenant's database row — that's a SOC 2 / HIPAA blocker).
 *
 * Development: graceful pass-through, with a one-time warning so the
 * developer notices.
 */
let _devWarned = false;
export function safeEncrypt(plaintext: string): string {
  if (!process.env.ENCRYPTION_KEY) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ENCRYPTION_KEY is required in production — refusing to store data in plaintext",
      );
    }
    if (!_devWarned) {
       
      console.warn(
        "[crypto] ENCRYPTION_KEY unset in development — values are stored in plaintext. NEVER ship without setting it.",
      );
      _devWarned = true;
    }
    return plaintext;
  }
  return encrypt(plaintext);
}

/**
 * Safely decrypt.
 *
 * Production: ENCRYPTION_KEY mandatory. A failed GCM auth-tag check
 * means the ciphertext has been tampered with — we MUST throw, never
 * return the bytes (returning corrupted ciphertext as plaintext was the
 * audit-blocking bug in the original implementation).
 *
 * Development: when ENCRYPTION_KEY is unset, pass through unchanged so
 * test fixtures with plaintext values continue to work.
 */
export function safeDecrypt(ciphertext: string): string {
  if (!process.env.ENCRYPTION_KEY) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "ENCRYPTION_KEY is required in production — cannot decrypt stored secrets",
      );
    }
    return ciphertext;
  }
  // Heuristic skip — value never looked like ciphertext (legacy plaintext
  // rows pre-encryption). Pass through unchanged.
  if (!isEncrypted(ciphertext)) return ciphertext;
  // decrypt() throws on auth-tag failure. We surface the error rather than
  // hide tampering behind silent plaintext fall-through.
  return decrypt(ciphertext);
}
