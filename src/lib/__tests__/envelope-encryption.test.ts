/**
 * Tests for src/lib/envelope-encryption.ts — Cook 122.
 */

import { describe, it, expect } from "vitest";
import {
  buildLocalKek,
  decryptField,
  encryptField,
  ENVELOPE_CONSTANTS,
  rotateKek,
} from "../envelope-encryption";

const MASTER_A = "a".repeat(64);
const MASTER_B = "b".repeat(64);

describe("buildLocalKek", () => {
  it("rejects malformed master keys", () => {
    expect(() => buildLocalKek("short")).toThrow();
    expect(() => buildLocalKek("zz" + "a".repeat(62))).toThrow();
  });
});

describe("encryptField + decryptField", () => {
  it("round-trips plaintext", async () => {
    const kek = buildLocalKek(MASTER_A);
    const env = await encryptField("secret patient note", kek.wrap);
    expect(env.algorithm).toBe("AES-256-GCM");
    const out = await decryptField(env, kek.unwrap);
    expect(out).toBe("secret patient note");
  });

  it("produces different ciphertexts for the same plaintext", async () => {
    const kek = buildLocalKek(MASTER_A);
    const a = await encryptField("same", kek.wrap);
    const b = await encryptField("same", kek.wrap);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
    // Independent DEKs → different wrapped DEKs too.
    expect(a.wrappedDek).not.toBe(b.wrappedDek);
  });

  it("rejects non-string plaintext", async () => {
    const kek = buildLocalKek(MASTER_A);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(encryptField(42 as any, kek.wrap)).rejects.toThrow();
  });

  it("decryptField throws on auth-tag tampering", async () => {
    const kek = buildLocalKek(MASTER_A);
    const env = await encryptField("data", kek.wrap);
    const bad = { ...env, tag: Buffer.alloc(16).toString("base64") };
    await expect(decryptField(bad, kek.unwrap)).rejects.toThrow();
  });

  it("decryptField throws on ciphertext tampering", async () => {
    const kek = buildLocalKek(MASTER_A);
    const env = await encryptField("data", kek.wrap);
    const bytes = Buffer.from(env.ciphertext, "base64");
    bytes[0] = bytes[0] ^ 0xff;
    const bad = { ...env, ciphertext: bytes.toString("base64") };
    await expect(decryptField(bad, kek.unwrap)).rejects.toThrow();
  });

  it("decryptField rejects unsupported algorithm", async () => {
    const kek = buildLocalKek(MASTER_A);
    const env = await encryptField("data", kek.wrap);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bad = { ...env, algorithm: "DES-FOO" as any };
    await expect(decryptField(bad, kek.unwrap)).rejects.toThrow(/unsupported/);
  });

  it("cross-KEK decrypt fails", async () => {
    const kek1 = buildLocalKek(MASTER_A);
    const kek2 = buildLocalKek(MASTER_B);
    const env = await encryptField("data", kek1.wrap);
    await expect(decryptField(env, kek2.unwrap)).rejects.toThrow();
  });
});

describe("rotateKek", () => {
  it("rewraps DEK under new KEK; ciphertext unchanged", async () => {
    const kek1 = buildLocalKek(MASTER_A);
    const kek2 = buildLocalKek(MASTER_B);
    const env = await encryptField("data", kek1.wrap);
    const rotated = await rotateKek(env, kek1.unwrap, kek2.wrap);
    expect(rotated.ciphertext).toBe(env.ciphertext);
    expect(rotated.wrappedDek).not.toBe(env.wrappedDek);
    // Old KEK can no longer decrypt the new envelope.
    await expect(decryptField(rotated, kek1.unwrap)).rejects.toThrow();
    // New KEK decrypts successfully.
    const out = await decryptField(rotated, kek2.unwrap);
    expect(out).toBe("data");
  });
});

describe("constants", () => {
  it("uses AES-256-GCM with standard parameters", () => {
    expect(ENVELOPE_CONSTANTS.ALGORITHM).toBe("aes-256-gcm");
    expect(ENVELOPE_CONSTANTS.IV_BYTES).toBe(12);
    expect(ENVELOPE_CONSTANTS.DEK_BYTES).toBe(32);
  });
});
