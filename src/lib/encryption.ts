import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("encryption");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

/**
 * Get the 32-byte encryption key from ENCRYPTION_KEY env var.
 * Returns null if not configured.
 */
function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) return null;

  // Accept hex-encoded (64 chars) or raw 32-byte string
  if (raw.length === 64 && /^[0-9a-fA-F]+$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  if (raw.length === 32) {
    return Buffer.from(raw, "utf-8");
  }

  log.warn("ENCRYPTION_KEY must be 32 bytes (or 64 hex chars). Encryption disabled.");
  return null;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * If ENCRYPTION_KEY is not set, returns the input unchanged (graceful degradation).
 * Output format: hex(iv) + ":" + hex(tag) + ":" + hex(ciphertext)
 */
export function safeEncrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext;

  try {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag();

    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
  } catch (err) {
    log.error("Encryption failed — returning plaintext", {
      error: (err as Error).message,
    });
    return plaintext;
  }
}

/**
 * Decrypt ciphertext produced by safeEncrypt.
 * If ENCRYPTION_KEY is not set or the input doesn't look encrypted, returns the input unchanged.
 */
export function safeDecrypt(ciphertext: string): string {
  const key = getKey();
  if (!key) return ciphertext;

  // Check if the input matches our format: iv:tag:data (hex encoded)
  const parts = ciphertext.split(":");
  if (parts.length !== 3) return ciphertext;

  const [ivHex, tagHex, encryptedHex] = parts;

  // Validate hex format
  if (
    ivHex.length !== IV_LENGTH * 2 ||
    tagHex.length !== TAG_LENGTH * 2 ||
    !/^[0-9a-fA-F]+$/.test(ivHex) ||
    !/^[0-9a-fA-F]+$/.test(tagHex) ||
    !/^[0-9a-fA-F]+$/.test(encryptedHex)
  ) {
    return ciphertext;
  }

  try {
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (err) {
    log.error("Decryption failed — returning ciphertext as-is", {
      error: (err as Error).message,
    });
    return ciphertext;
  }
}
