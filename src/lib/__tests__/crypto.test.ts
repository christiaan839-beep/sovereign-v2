/**
 * Tests for src/lib/crypto.ts — AES-256-GCM encryption
 *
 * Covers roundtrip correctness, IV uniqueness, auth tag integrity,
 * and the safe* helpers that gracefully degrade without an ENCRYPTION_KEY.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { randomBytes } from "crypto";

// Generate a fresh 32-byte key for each test run to avoid leaking
// across the project's real ENCRYPTION_KEY if it happens to be set.
const TEST_KEY_HEX = randomBytes(32).toString("hex");

describe("crypto", () => {
  const originalKey = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY_HEX;
  });

  afterEach(() => {
    if (originalKey !== undefined) process.env.ENCRYPTION_KEY = originalKey;
    else delete process.env.ENCRYPTION_KEY;
  });

  describe("encrypt/decrypt roundtrip", () => {
    it("decrypts what it encrypted", async () => {
      const { encrypt, decrypt } = await import("@/lib/crypto");
      const plaintext = "sk_live_51Hc9oeHjKlmNoPqRsTuVwXyZ";
      const ciphertext = encrypt(plaintext);
      expect(decrypt(ciphertext)).toBe(plaintext);
    });

    it("handles empty strings", async () => {
      const { encrypt, decrypt } = await import("@/lib/crypto");
      const ciphertext = encrypt("");
      expect(decrypt(ciphertext)).toBe("");
    });

    it("handles unicode and emoji", async () => {
      const { encrypt, decrypt } = await import("@/lib/crypto");
      const plaintext = "Sovereign Matrix ⚡ 主權矩陣 🔐 sécurisé";
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });

    it("handles long payloads (JSON blob of keys)", async () => {
      const { encrypt, decrypt } = await import("@/lib/crypto");
      const plaintext = JSON.stringify({
        gemini: "AIza" + "x".repeat(35),
        anthropic: "sk-ant-" + "y".repeat(95),
        groq: "gsk_" + "z".repeat(52),
        nvidia: "nvapi-" + "a".repeat(64),
      });
      expect(decrypt(encrypt(plaintext))).toBe(plaintext);
    });
  });

  describe("IV uniqueness (GCM anti-replay)", () => {
    it("produces different ciphertext each time for the same plaintext", async () => {
      const { encrypt } = await import("@/lib/crypto");
      const plaintext = "sk_deterministic_would_be_catastrophic";
      const c1 = encrypt(plaintext);
      const c2 = encrypt(plaintext);
      const c3 = encrypt(plaintext);
      // If these collide, the IV is not random — which breaks GCM security
      expect(c1).not.toBe(c2);
      expect(c2).not.toBe(c3);
      expect(c1).not.toBe(c3);
    });
  });

  describe("auth tag integrity", () => {
    it("throws when ciphertext has been tampered with", async () => {
      const { encrypt, decrypt } = await import("@/lib/crypto");
      const ciphertext = encrypt("secret-api-key");
      // Flip one byte in the middle of the encrypted payload
      const buf = Buffer.from(ciphertext, "base64");
      buf[buf.length - 20] ^= 0xff; // corrupt a ciphertext byte
      const tampered = buf.toString("base64");
      expect(() => decrypt(tampered)).toThrow();
    });

    it("throws when auth tag has been tampered with", async () => {
      const { encrypt, decrypt } = await import("@/lib/crypto");
      const ciphertext = encrypt("secret-api-key");
      const buf = Buffer.from(ciphertext, "base64");
      // Auth tag lives in the last 16 bytes
      buf[buf.length - 1] ^= 0xff;
      const tampered = buf.toString("base64");
      expect(() => decrypt(tampered)).toThrow();
    });

    it("throws when IV has been tampered with", async () => {
      const { encrypt, decrypt } = await import("@/lib/crypto");
      const ciphertext = encrypt("secret-api-key");
      const buf = Buffer.from(ciphertext, "base64");
      // IV lives in the first 12 bytes
      buf[0] ^= 0xff;
      const tampered = buf.toString("base64");
      expect(() => decrypt(tampered)).toThrow();
    });
  });

  describe("cross-key isolation", () => {
    it("cannot decrypt data encrypted with a different key", async () => {
      // Reset module cache to get fresh getKey() calls
      const cryptoModule = await import("@/lib/crypto");
      const ciphertext = cryptoModule.encrypt("secret");

      // Swap the key to a different one
      process.env.ENCRYPTION_KEY = randomBytes(32).toString("hex");
      // vi needs module re-import to pick up env var changes, but since getKey()
      // reads env at call-time (not import-time), this works directly:
      expect(() => cryptoModule.decrypt(ciphertext)).toThrow();
    });
  });

  describe("getKey validation", () => {
    it("throws a clear error when ENCRYPTION_KEY is missing", async () => {
      delete process.env.ENCRYPTION_KEY;
      const { encrypt } = await import("@/lib/crypto");
      expect(() => encrypt("anything")).toThrow(/ENCRYPTION_KEY/);
    });

    it("throws when ENCRYPTION_KEY is too short", async () => {
      process.env.ENCRYPTION_KEY = "abcdef"; // only 3 bytes
      const { encrypt } = await import("@/lib/crypto");
      expect(() => encrypt("anything")).toThrow(/64-character hex|32 bytes/);
    });

    it("throws when ENCRYPTION_KEY is too long", async () => {
      process.env.ENCRYPTION_KEY = "a".repeat(130); // 65 bytes
      const { encrypt } = await import("@/lib/crypto");
      expect(() => encrypt("anything")).toThrow(/64-character hex|32 bytes/);
    });
  });

  describe("isEncrypted", () => {
    it("identifies our ciphertext as encrypted", async () => {
      const { encrypt, isEncrypted } = await import("@/lib/crypto");
      const ciphertext = encrypt("anything");
      expect(isEncrypted(ciphertext)).toBe(true);
    });

    it("rejects plain strings", async () => {
      const { isEncrypted } = await import("@/lib/crypto");
      expect(isEncrypted("sk_live_plainAPIkey")).toBe(false);
      expect(isEncrypted("short")).toBe(false);
    });

    it("rejects LONG plaintext secrets that decode to >28 bytes (BACKLOG isencrypted)", async () => {
      const { isEncrypted } = await import("@/lib/crypto");
      // 48-char realistic API key — long enough that the old length-only
      // check misclassified it as ciphertext. `_` isn't standard base64.
      expect(isEncrypted("sk_live_" + "a".repeat(40))).toBe(false);
      // A legacy JSON key blob (contains { " : } — non-base64).
      expect(isEncrypted('{"key":"' + "x".repeat(40) + '"}')).toBe(false);
    });

    it("rejects near-base64 plaintext that isn't 4-char aligned or doesn't round-trip", async () => {
      const { isEncrypted } = await import("@/lib/crypto");
      // Valid charset but wrong length alignment (not % 4).
      expect(isEncrypted("abcdeExtraNotAligned123")).toBe(false);
      // Contains a space — outside the base64 charset.
      expect(isEncrypted("aaaa bbbb cccc dddd eeee ffff gggg")).toBe(false);
    });

    it("rejects empty strings", async () => {
      const { isEncrypted } = await import("@/lib/crypto");
      expect(isEncrypted("")).toBe(false);
    });
  });

  describe("safeEncrypt", () => {
    it("encrypts when ENCRYPTION_KEY is set", async () => {
      const { safeEncrypt, decrypt } = await import("@/lib/crypto");
      const result = safeEncrypt("hello");
      expect(result).not.toBe("hello");
      expect(decrypt(result)).toBe("hello");
    });

    it("passes through plaintext when ENCRYPTION_KEY is missing (dev graceful degradation)", async () => {
      delete process.env.ENCRYPTION_KEY;
      const { safeEncrypt } = await import("@/lib/crypto");
      expect(safeEncrypt("hello")).toBe("hello");
    });
  });

  describe("safeDecrypt", () => {
    it("decrypts when ENCRYPTION_KEY is set", async () => {
      const { encrypt, safeDecrypt } = await import("@/lib/crypto");
      const ciphertext = encrypt("hello");
      expect(safeDecrypt(ciphertext)).toBe("hello");
    });

    it("passes through ciphertext when ENCRYPTION_KEY is missing", async () => {
      const { encrypt } = await import("@/lib/crypto");
      const ciphertext = encrypt("hello");
      delete process.env.ENCRYPTION_KEY;
      const { safeDecrypt } = await import("@/lib/crypto");
      expect(safeDecrypt(ciphertext)).toBe(ciphertext);
    });

    it("passes through plain strings that look unencrypted", async () => {
      const { safeDecrypt } = await import("@/lib/crypto");
      expect(safeDecrypt("sk_live_plainAPIkey")).toBe("sk_live_plainAPIkey");
    });

    it("throws on tampered ciphertext (audit-grade tamper detection)", async () => {
      // Audit-2026-05 hardening: silently returning bogus ciphertext as
      // plaintext was the SOC 2 / HIPAA blocker. safeDecrypt now propagates
      // the GCM auth-tag failure so callers can surface tampering rather
      // than serve corrupted bytes.
      const { safeDecrypt } = await import("@/lib/crypto");
      const bogus = Buffer.concat([
        Buffer.alloc(12), // fake IV
        Buffer.alloc(40), // fake data
        Buffer.alloc(16), // fake tag
      ]).toString("base64");
      expect(() => safeDecrypt(bogus)).toThrow();
    });
  });

  describe("production hard-fail (audit-2026-05)", () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      if (originalNodeEnv !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (process.env as any).NODE_ENV = originalNodeEnv;
      } else {
        delete (process.env as Record<string, string | undefined>).NODE_ENV;
      }
    });

    it("throws from safeEncrypt in production when ENCRYPTION_KEY is unset", async () => {
      delete process.env.ENCRYPTION_KEY;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = "production";
      const { safeEncrypt } = await import("@/lib/crypto");
      expect(() => safeEncrypt("data")).toThrow(/ENCRYPTION_KEY/);
    });

    it("throws from safeDecrypt in production when ENCRYPTION_KEY is unset", async () => {
      delete process.env.ENCRYPTION_KEY;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (process.env as any).NODE_ENV = "production";
      const { safeDecrypt } = await import("@/lib/crypto");
      expect(() => safeDecrypt("anything")).toThrow(/ENCRYPTION_KEY/);
    });
  });
});
