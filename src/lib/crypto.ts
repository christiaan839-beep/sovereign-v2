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
 * Safely encrypt — returns plaintext if ENCRYPTION_KEY is not set.
 * This allows graceful degradation in development.
 */
export function safeEncrypt(plaintext: string): string {
  if (!process.env.ENCRYPTION_KEY) return plaintext;
  return encrypt(plaintext);
}

/**
 * Safely decrypt — returns ciphertext as-is if ENCRYPTION_KEY is not set
 * or if the value doesn't look encrypted.
 *
 * If the value LOOKS encrypted but decryption fails (bad key, corrupted
 * data, auth-tag mismatch), THROWS — never silently returns the raw
 * ciphertext as if it were the plaintext value. Returning ciphertext on
 * failure caused callers to ship scrambled bytes to Stripe/Twilio/Hunter
 * as "the API key", with no failure signal at the call site.
 */
export function safeDecrypt(ciphertext: string): string {
  if (!process.env.ENCRYPTION_KEY) return ciphertext;
  if (!isEncrypted(ciphertext)) return ciphertext;
  return decrypt(ciphertext);
}
