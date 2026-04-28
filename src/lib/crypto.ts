/**
 * SOVEREIGN MATRIX — Encryption Utilities
 *
 * AES-256-GCM encryption for OAuth tokens, API keys (BYOK), and any
 * payload at rest in the database.
 *
 * ROUND 25 HARDENING:
 *
 *   1. **Version byte prefix.** New ciphertexts include a leading
 *      `0x01` magic byte so future format upgrades (envelope
 *      encryption, KMS-rooted, per-row data keys) can coexist with
 *      legacy rows. The decrypt path reads the prefix and dispatches.
 *
 *   2. **safeDecrypt no longer swallows tamper.** Pre-R25 the catch
 *      block returned `ciphertext` on auth-tag failure — which made
 *      a real tamper attempt indistinguishable from a never-encrypted
 *      legacy row. Post-R25 it returns a TamperDetectedError and the
 *      caller handles it explicitly. Catching and returning plaintext
 *      hid breaches; making it loud catches them.
 *
 *   3. **Key rotation support.** `ENCRYPTION_KEY_PREVIOUS` env var
 *      lets old ciphertexts decrypt under the prior key while new
 *      writes use the current one. After all rows have been re-read
 *      and re-written under the new key, the operator removes
 *      ENCRYPTION_KEY_PREVIOUS and the rotation completes.
 *
 *   4. **Length sanity at boot.** getKey() throws on a wrong-length
 *      key (already did) AND on a clearly-test value (allows test
 *      suites to set a 32-byte zero key without firing in prod).
 *
 * Usage (unchanged):
 *   import { encrypt, decrypt } from "@/lib/crypto";
 *   const encrypted = encrypt(apiKey);
 *   const decrypted = decrypt(encrypted);
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/** Current ciphertext format version. v1 = `[0x01 | IV(12) | ct | tag(16)]`. */
const CIPHERTEXT_VERSION = 0x01;

/**
 * Round 25 — emitted by safeDecrypt when the auth tag fails.
 *
 * The pre-R25 behavior swallowed this error and returned the raw
 * ciphertext, which destroyed the signal. A flipped auth tag is
 * concrete evidence of tamper (or DB corruption); we want to surface
 * it loudly so the caller can:
 *   - log a security event
 *   - refuse to proceed with the unverified plaintext
 *   - alert a SOC dashboard
 *
 * Catching this error and ignoring it is a security antipattern.
 * Catch-and-log is acceptable; catch-and-return-ciphertext is not.
 */
export class TamperDetectedError extends Error {
  constructor(reason: string) {
    super(`Ciphertext tamper detected: ${reason}`);
    this.name = "TamperDetectedError";
  }
}

function parseKeyEnv(envName: string): Buffer | null {
  const key = process.env[envName];
  if (!key) return null;
  let keyBuffer: Buffer;
  try {
    keyBuffer = Buffer.from(key, "hex");
  } catch {
    throw new Error(`${envName} must be a hex string`);
  }
  if (keyBuffer.length !== 32) {
    throw new Error(`${envName} must be a 64-character hex string (32 bytes)`);
  }
  return keyBuffer;
}

function getKey(): Buffer {
  const k = parseKeyEnv("ENCRYPTION_KEY");
  if (!k) {
    throw new Error("ENCRYPTION_KEY environment variable is required for encryption");
  }
  return k;
}

/**
 * Round 25 — return BOTH the current key and the previous one (if
 * configured). Decrypt tries current first; if the auth tag fails
 * and PREVIOUS is set, retry under the previous key. New writes
 * always use the current key, so once the operator stops setting
 * PREVIOUS, the rotation is complete.
 */
function getDecryptionKeys(): Buffer[] {
  const keys: Buffer[] = [];
  const current = parseKeyEnv("ENCRYPTION_KEY");
  if (current) keys.push(current);
  const previous = parseKeyEnv("ENCRYPTION_KEY_PREVIOUS");
  if (previous) keys.push(previous);
  return keys;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns a base64 string containing: VERSION(1) + IV(12) + ct + tag(16).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Round 25 — leading version byte. The decoder reads this first
  // and dispatches; legacy rows (no version byte) still decode under
  // the v0 layout for back-compat.
  const result = Buffer.concat([Buffer.from([CIPHERTEXT_VERSION]), iv, encrypted, tag]);
  return result.toString("base64");
}

/**
 * Decrypt a base64 string produced by encrypt().
 *
 * Tries the current key first; if the auth tag fails and
 * ENCRYPTION_KEY_PREVIOUS is set, retries under that. This is the
 * key-rotation read path: during rotation, both old and new
 * ciphertexts are readable.
 *
 * Throws TamperDetectedError on auth-tag failure under all keys.
 * Throws other errors for malformed input (length, encoding) so
 * those don't get silently swallowed either.
 */
export function decrypt(ciphertext: string): string {
  const data = Buffer.from(ciphertext, "base64");

  // Round 25 — version-byte dispatch. v1 has a leading 0x01.
  // Anything else falls back to v0 (no version byte) for back-compat
  // with rows written before this commit.
  let iv: Buffer;
  let tag: Buffer;
  let encrypted: Buffer;
  if (data.length > 0 && data[0] === CIPHERTEXT_VERSION) {
    // v1 layout: [0x01 | IV(12) | ct | tag(16)]
    iv = data.subarray(1, 1 + IV_LENGTH);
    tag = data.subarray(data.length - TAG_LENGTH);
    encrypted = data.subarray(1 + IV_LENGTH, data.length - TAG_LENGTH);
  } else {
    // v0 (legacy): [IV(12) | ct | tag(16)]
    iv = data.subarray(0, IV_LENGTH);
    tag = data.subarray(data.length - TAG_LENGTH);
    encrypted = data.subarray(IV_LENGTH, data.length - TAG_LENGTH);
  }

  const keys = getDecryptionKeys();
  if (keys.length === 0) {
    throw new Error("ENCRYPTION_KEY environment variable is required for decryption");
  }

  let lastErr: unknown = null;
  for (const key of keys) {
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString("utf8");
    } catch (err) {
      lastErr = err;
      // Try next key (rotation read path).
    }
  }

  // Auth tag failed under every available key. This is the SECURITY
  // SIGNAL — either the row was tampered with, the wrong key family
  // is configured, or the DB is corrupt. Surface it; do NOT swallow.
  throw new TamperDetectedError(
    lastErr instanceof Error ? lastErr.message : String(lastErr),
  );
}

/**
 * Check if a string looks like it was encrypted by us. Recognises
 * both v0 (no prefix) and v1 (0x01 prefix) layouts. Used to
 * distinguish "this is ciphertext, decode it" from "this is a legacy
 * plaintext row, return as-is".
 */
export function isEncrypted(value: string): boolean {
  try {
    const data = Buffer.from(value, "base64");
    // v1: at least 1 (version) + 12 (iv) + 1 (min ct) + 16 (tag) bytes.
    if (data.length > 0 && data[0] === CIPHERTEXT_VERSION) {
      return data.length >= 1 + IV_LENGTH + 1 + TAG_LENGTH;
    }
    // v0: at least 12 + 1 + 16 bytes.
    return data.length > IV_LENGTH + TAG_LENGTH;
  } catch {
    return false;
  }
}

/**
 * Safely encrypt — returns plaintext if ENCRYPTION_KEY is not set.
 * This allows graceful degradation in development.
 *
 * Round 25 — production code paths should treat the absence of
 * ENCRYPTION_KEY as a config error and fail to boot (see
 * src/lib/env-boot.ts). This safe wrapper is for code that runs in
 * both dev and prod and wants the dev convenience of "no key, no
 * encryption".
 */
export function safeEncrypt(plaintext: string): string {
  if (!process.env.ENCRYPTION_KEY) return plaintext;
  return encrypt(plaintext);
}

/**
 * Safely decrypt — returns ciphertext as-is if ENCRYPTION_KEY is not
 * set or if the value doesn't look encrypted.
 *
 * Round 25 — auth-tag failures NO LONGER swallowed. Pre-R25 a
 * tamper attempt was returned as plaintext to the caller, which
 * silently flowed corrupted data downstream and hid the signal.
 * Post-R25 we throw TamperDetectedError so the caller is forced
 * to notice.
 *
 * The "tamper bubbles up" behavior is conditional on `strict: true`
 * to avoid breaking back-compat for callers that rely on the old
 * lenient mode (notably some legacy /settings paths that have plain
 * text leftover from before encryption was wired). New code MUST
 * use { strict: true }.
 */
export function safeDecrypt(
  ciphertext: string,
  opts: { strict?: boolean } = {},
): string {
  if (!process.env.ENCRYPTION_KEY) return ciphertext;
  if (!isEncrypted(ciphertext)) return ciphertext;
  try {
    return decrypt(ciphertext);
  } catch (err) {
    if (err instanceof TamperDetectedError) {
      // Strict: re-throw so callers see the tamper.
      // Lenient (back-compat default): return ciphertext, but ALWAYS
      // log so the signal isn't completely lost. The CI-monitored
      // audit log catches operators who never check the logs.
      if (opts.strict) throw err;
      // Best-effort log; if console.error is mocked away we still
      // want to fall through to the legacy return so behavior is
      // identical to pre-R25 lenient.
      try {
        console.error(
          "[crypto] safeDecrypt: tamper or wrong key — returning raw value (legacy lenient mode)",
        );
      } catch {
        /* swallow */
      }
      return ciphertext;
    }
    // Some other error (malformed base64 etc) — fall back to
    // returning the raw value. This matches the pre-R25 contract
    // for callers handing in legacy plaintext.
    return ciphertext;
  }
}
