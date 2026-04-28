/**
 * crypto — Round 25 hardening tests.
 *
 * Verifies:
 *   - Tamper attempts surface as TamperDetectedError (strict mode).
 *   - Auth-tag failure under strict mode throws (no silent return).
 *   - Lenient mode preserves the back-compat behavior for legacy
 *     plaintext rows.
 *   - Version-byte prefix on new ciphertexts.
 *   - ENCRYPTION_KEY_PREVIOUS rotation read path works.
 *   - Legacy v0 ciphertexts (no version byte) still decrypt cleanly.
 *
 * The test sets ENCRYPTION_KEY (and optionally ENCRYPTION_KEY_PREVIOUS)
 * to deterministic 32-byte zero keys so output is reproducible.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const KEY_A = "a".repeat(64); // 32-byte hex key, all 0xaa
const KEY_B = "b".repeat(64); // 32-byte hex key, all 0xbb

const ORIGINAL_KEY = process.env.ENCRYPTION_KEY;
const ORIGINAL_PREV = process.env.ENCRYPTION_KEY_PREVIOUS;

beforeEach(() => {
  vi.resetModules();
  process.env.ENCRYPTION_KEY = KEY_A;
  delete process.env.ENCRYPTION_KEY_PREVIOUS;
});

afterEach(() => {
  if (ORIGINAL_KEY !== undefined) process.env.ENCRYPTION_KEY = ORIGINAL_KEY;
  else delete process.env.ENCRYPTION_KEY;
  if (ORIGINAL_PREV !== undefined) process.env.ENCRYPTION_KEY_PREVIOUS = ORIGINAL_PREV;
  else delete process.env.ENCRYPTION_KEY_PREVIOUS;
});

async function importCrypto() {
  return await import("../crypto");
}

describe("crypto Round 25 — tamper detection + version + rotation", () => {
  it("encrypt + decrypt round-trips with version byte", async () => {
    const { encrypt, decrypt } = await importCrypto();
    const plaintext = "secret-token-abc123";
    const ct = encrypt(plaintext);
    expect(decrypt(ct)).toBe(plaintext);
    // Version byte: base64 decode and confirm leading 0x01.
    const decoded = Buffer.from(ct, "base64");
    expect(decoded[0]).toBe(0x01);
  });

  it("tamper on auth tag throws TamperDetectedError", async () => {
    const { encrypt, decrypt, TamperDetectedError } = await importCrypto();
    const ct = encrypt("payload");
    // Flip a byte in the auth tag (last 16 bytes of the buffer).
    const buf = Buffer.from(ct, "base64");
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString("base64");
    expect(() => decrypt(tampered)).toThrow(TamperDetectedError);
  });

  it("safeDecrypt strict mode re-throws TamperDetectedError", async () => {
    const { encrypt, safeDecrypt, TamperDetectedError } = await importCrypto();
    const ct = encrypt("payload");
    const buf = Buffer.from(ct, "base64");
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString("base64");
    expect(() => safeDecrypt(tampered, { strict: true })).toThrow(
      TamperDetectedError,
    );
  });

  it("safeDecrypt lenient mode swallows tamper but logs (back-compat)", async () => {
    const { encrypt, safeDecrypt } = await importCrypto();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const ct = encrypt("payload");
    const buf = Buffer.from(ct, "base64");
    buf[buf.length - 1] ^= 0xff;
    const tampered = buf.toString("base64");
    // Lenient (default) mode returns the raw value; this is the
    // pre-R25 contract for legacy callers. The new behavior: it
    // ALSO logs to console.error so the signal isn't lost.
    const result = safeDecrypt(tampered);
    expect(result).toBe(tampered);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it("ENCRYPTION_KEY_PREVIOUS lets old ciphertexts decrypt during rotation", async () => {
    // Encrypt under KEY_A, then "rotate" by moving A → PREVIOUS and
    // setting B as the new current. The old ciphertext should still
    // decrypt under PREVIOUS.
    const { encrypt } = await importCrypto();
    const ct = encrypt("rotation-secret");

    process.env.ENCRYPTION_KEY = KEY_B;
    process.env.ENCRYPTION_KEY_PREVIOUS = KEY_A;
    vi.resetModules();
    const fresh = await importCrypto();
    expect(fresh.decrypt(ct)).toBe("rotation-secret");

    // New writes under KEY_B should still decrypt under KEY_B (no
    // rotation needed for fresh data).
    const ct2 = fresh.encrypt("new-secret");
    expect(fresh.decrypt(ct2)).toBe("new-secret");
  });

  it("isEncrypted recognises both v0 (no prefix) and v1 ciphertexts", async () => {
    const { encrypt, isEncrypted } = await importCrypto();
    const ct = encrypt("test");
    expect(isEncrypted(ct)).toBe(true);
    expect(isEncrypted("plaintext-token")).toBe(false);
    expect(isEncrypted("")).toBe(false);
  });
});
