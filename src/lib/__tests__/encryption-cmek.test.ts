/**
 * encryption/cmek (R55) — tests.
 *
 * Customer-Managed Encryption Keys via envelope encryption.
 *
 * Covers:
 *   - encryptEnvelope / decryptEnvelope roundtrip
 *   - Authenticated decryption catches tampered ciphertext
 *   - DEK length validation (must be 32 bytes)
 *   - IV length validation (must be 12 bytes)
 *   - generateDek / generateIv use the injected RNG (testability)
 *   - encryptWithCmek + decryptWithCmek roundtrip via LocalDevCmekProvider
 *   - StubCmekProvider fails closed (loud errors, not silent)
 *   - selectCmekProviderType: env-routing for aws-kms / gcp-kms / azure-kv
 *   - Provider describe() correctly flags productionGrade
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  encryptEnvelope,
  decryptEnvelope,
  generateDek,
  generateIv,
  encryptWithCmek,
  decryptWithCmek,
  LocalDevCmekProvider,
  StubCmekProvider,
  selectCmekProviderType,
} from "../encryption/cmek";

const FIXED_DEK = Buffer.alloc(32, 1);
const FIXED_IV = Buffer.alloc(12, 2);

describe("encryptEnvelope / decryptEnvelope (pure AEAD)", () => {
  it("roundtrips: same DEK + IV → encrypt → decrypt = original plaintext", () => {
    const plaintext = Buffer.from("hello PHI world");
    const { ciphertext, authTag } = encryptEnvelope({
      plaintext,
      dek: FIXED_DEK,
      iv: FIXED_IV,
    });
    const decrypted = decryptEnvelope({
      ciphertext,
      authTag,
      dek: FIXED_DEK,
      iv: FIXED_IV,
    });
    expect(decrypted.equals(plaintext)).toBe(true);
  });

  it("decryption with wrong DEK throws (auth tag fails)", () => {
    const plaintext = Buffer.from("secret");
    const { ciphertext, authTag } = encryptEnvelope({
      plaintext,
      dek: FIXED_DEK,
      iv: FIXED_IV,
    });
    const wrongDek = Buffer.alloc(32, 99);
    expect(() =>
      decryptEnvelope({
        ciphertext,
        authTag,
        dek: wrongDek,
        iv: FIXED_IV,
      }),
    ).toThrow();
  });

  it("decryption with tampered ciphertext throws", () => {
    const plaintext = Buffer.from("secret");
    const { ciphertext, authTag } = encryptEnvelope({
      plaintext,
      dek: FIXED_DEK,
      iv: FIXED_IV,
    });
    // Flip a byte.
    const tampered = Buffer.from(ciphertext);
    tampered[0] = tampered[0] ^ 0xff;
    expect(() =>
      decryptEnvelope({
        ciphertext: tampered,
        authTag,
        dek: FIXED_DEK,
        iv: FIXED_IV,
      }),
    ).toThrow();
  });

  it("rejects DEK of wrong length", () => {
    expect(() =>
      encryptEnvelope({
        plaintext: Buffer.from("x"),
        dek: Buffer.alloc(16),
        iv: FIXED_IV,
      }),
    ).toThrow(/DEK must be 32 bytes/);
  });

  it("rejects IV of wrong length", () => {
    expect(() =>
      encryptEnvelope({
        plaintext: Buffer.from("x"),
        dek: FIXED_DEK,
        iv: Buffer.alloc(8),
      }),
    ).toThrow(/IV must be 12 bytes/);
  });
});

describe("generateDek / generateIv", () => {
  it("uses injected RNG (deterministic for tests)", () => {
    const dek = generateDek(() => Buffer.alloc(32, 7));
    expect(dek.length).toBe(32);
    expect(dek[0]).toBe(7);
  });

  it("RNG must return 32 bytes for DEK", () => {
    expect(() => generateDek(() => Buffer.alloc(16))).toThrow();
  });

  it("RNG must return 12 bytes for IV", () => {
    expect(() => generateIv(() => Buffer.alloc(8))).toThrow();
  });

  it("default DEK is 32 bytes from system RNG", () => {
    const dek = generateDek();
    expect(dek.length).toBe(32);
  });
});

describe("encryptWithCmek + decryptWithCmek roundtrip", () => {
  let provider: LocalDevCmekProvider;
  beforeEach(() => {
    provider = new LocalDevCmekProvider(Buffer.alloc(32, 0xaa));
  });

  it("encrypts and decrypts back to the same plaintext", async () => {
    const plaintext = Buffer.from("This is sensitive PHI: SSN 123-45-6789");
    const envelope = await encryptWithCmek({
      plaintext,
      cmkKeyId: "test-cmk",
      provider,
    });
    expect(envelope.algorithm).toBe("aes-256-gcm");
    expect(envelope.cmkKeyId).toBe("test-cmk");
    expect(envelope.wrappedDek.length).toBeGreaterThan(0);
    const decrypted = await decryptWithCmek({ envelope, provider });
    expect(decrypted.equals(plaintext)).toBe(true);
  });

  it("each encryption produces a unique IV (no nonce reuse)", async () => {
    const plaintext = Buffer.from("same plaintext");
    const a = await encryptWithCmek({
      plaintext,
      cmkKeyId: "cmk",
      provider,
    });
    const b = await encryptWithCmek({
      plaintext,
      cmkKeyId: "cmk",
      provider,
    });
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it("decryption with a different LocalDev provider (different master key) fails", async () => {
    const plaintext = Buffer.from("secret");
    const envelope = await encryptWithCmek({
      plaintext,
      cmkKeyId: "cmk",
      provider,
    });
    const otherProvider = new LocalDevCmekProvider(Buffer.alloc(32, 0xbb));
    await expect(
      decryptWithCmek({ envelope, provider: otherProvider }),
    ).rejects.toThrow();
  });

  it("decryption with unsupported algorithm throws", async () => {
    const plaintext = Buffer.from("x");
    const envelope = await encryptWithCmek({
      plaintext,
      cmkKeyId: "cmk",
      provider,
    });
    const tampered = { ...envelope, algorithm: "rot13" as never };
    await expect(
      decryptWithCmek({ envelope: tampered, provider }),
    ).rejects.toThrow(/unsupported algorithm/);
  });
});

describe("LocalDevCmekProvider", () => {
  it("describe() flags productionGrade=false", () => {
    const provider = new LocalDevCmekProvider(Buffer.alloc(32, 0));
    const d = provider.describe();
    expect(d.type).toBe("local-dev");
    expect(d.productionGrade).toBe(false);
    expect(d.display.toLowerCase()).toContain("not for production");
  });

  it("rejects non-32-byte master keys", () => {
    expect(() => new LocalDevCmekProvider(Buffer.alloc(16))).toThrow();
  });
});

describe("StubCmekProvider — fails closed", () => {
  it("describe() reflects operator's chosen provider type", () => {
    const stub = new StubCmekProvider("aws-kms");
    const d = stub.describe();
    expect(d.type).toBe("aws-kms");
    expect(d.productionGrade).toBe(true);
    expect(d.display).toContain("operator must implement");
  });

  it("wrapDek throws (so misconfig fails loudly)", async () => {
    const stub = new StubCmekProvider("aws-kms");
    await expect(
      stub.wrapDek(Buffer.alloc(32), "key-id"),
    ).rejects.toThrow(/operators must implement wrapDek/);
  });

  it("unwrapDek throws (so misconfig fails loudly)", async () => {
    const stub = new StubCmekProvider("aws-kms");
    await expect(
      stub.unwrapDek("wrapped", "key-id"),
    ).rejects.toThrow(/operators must implement unwrapDek/);
  });
});

describe("selectCmekProviderType (pure)", () => {
  it("explicit aws-kms wins", () => {
    const r = selectCmekProviderType({
      SOVEREIGN_CMEK_PROVIDER: "aws-kms",
    });
    expect(r.type).toBe("aws-kms");
  });

  it("explicit gcp-kms wins", () => {
    const r = selectCmekProviderType({
      SOVEREIGN_CMEK_PROVIDER: "gcp-kms",
    });
    expect(r.type).toBe("gcp-kms");
  });

  it("explicit azure-kv wins", () => {
    const r = selectCmekProviderType({
      SOVEREIGN_CMEK_PROVIDER: "azure-kv",
    });
    expect(r.type).toBe("azure-kv");
  });

  it("default with ENCRYPTION_KEY set → local-dev (with informative reason)", () => {
    const r = selectCmekProviderType({ ENCRYPTION_KEY: "x".repeat(64) });
    expect(r.type).toBe("local-dev");
    expect(r.reason).toContain("ENCRYPTION_KEY set");
  });

  it("nothing configured → local-dev with NOT FOR PRODUCTION reason", () => {
    const r = selectCmekProviderType({});
    expect(r.type).toBe("local-dev");
    expect(r.reason).toContain("NOT FOR PRODUCTION");
  });

  it("normalizes case + whitespace", () => {
    const r = selectCmekProviderType({
      SOVEREIGN_CMEK_PROVIDER: "  AWS-KMS  ",
    });
    expect(r.type).toBe("aws-kms");
  });
});
