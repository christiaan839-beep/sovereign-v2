/**
 * keys/signer (R54) — tests.
 *
 * Production-grade key management abstraction. Tests verify the
 * Signer contract + selection logic + the structural KMS skeleton.
 *
 * Covers:
 *   - selectSignerType: pure logic across env permutations
 *   - LocalEnvSigner: roundtrip sign/verify with both env-var and
 *     ephemeral keys
 *   - LocalEnvSigner.describe(): correct durability + hardware
 *     flags
 *   - StubKmsSigner: getPublicKey works; sign() throws loudly
 *     (so misconfig fails closed)
 *   - getActiveSigner: memoization + reset for tests
 *   - registerActiveSigner: operator hook works
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  selectSignerType,
  LocalEnvSigner,
  StubKmsSigner,
  getActiveSigner,
  registerActiveSigner,
  _resetSignerForTesting,
  type Signer,
} from "../keys/signer";
import { verifySignature } from "../agent-delegation";

describe("selectSignerType (pure)", () => {
  it("explicit SOVEREIGN_SIGNER_TYPE=aws-kms wins", () => {
    const r = selectSignerType({ SOVEREIGN_SIGNER_TYPE: "aws-kms" });
    expect(r.type).toBe("aws-kms");
    expect(r.reason).toContain("explicit");
  });

  it("explicit SOVEREIGN_SIGNER_TYPE=gcp-kms wins", () => {
    const r = selectSignerType({ SOVEREIGN_SIGNER_TYPE: "gcp-kms" });
    expect(r.type).toBe("gcp-kms");
  });

  it("explicit SOVEREIGN_SIGNER_TYPE=azure-kv wins", () => {
    const r = selectSignerType({ SOVEREIGN_SIGNER_TYPE: "azure-kv" });
    expect(r.type).toBe("azure-kv");
  });

  it("default (no SOVEREIGN_SIGNER_TYPE) is local-env", () => {
    const r = selectSignerType({
      SOVEREIGN_PLATFORM_PRIVATE_KEY: "k",
      SOVEREIGN_PLATFORM_PUBLIC_KEY: "p",
    });
    expect(r.type).toBe("local-env");
    expect(r.reason).toContain("env-var keys configured");
  });

  it("no signer configured at all → local-env with 'ephemeral' reason", () => {
    const r = selectSignerType({});
    expect(r.type).toBe("local-env");
    expect(r.reason).toContain("ephemeral");
  });

  it("normalizes case + whitespace on SOVEREIGN_SIGNER_TYPE", () => {
    const r = selectSignerType({ SOVEREIGN_SIGNER_TYPE: "  AWS-KMS  " });
    expect(r.type).toBe("aws-kms");
  });
});

describe("LocalEnvSigner", () => {
  beforeEach(() => {
    delete process.env.SOVEREIGN_PLATFORM_PRIVATE_KEY;
    delete process.env.SOVEREIGN_PLATFORM_PUBLIC_KEY;
  });

  it("ephemeral mode: generates a keypair on construction", async () => {
    const s = new LocalEnvSigner();
    const pub = await s.getPublicKey();
    expect(pub.length).toBeGreaterThan(20);
  });

  it("ephemeral mode: round-trip sign/verify works", async () => {
    const s = new LocalEnvSigner();
    const pub = await s.getPublicKey();
    const message = "v1\nreliability-attestation\nuptime:99.99";
    const sig = await s.sign(message);
    expect(verifySignature(pub, message, sig)).toBe(true);
  });

  it("ephemeral mode: describe() flags durability=false (production warning)", () => {
    const s = new LocalEnvSigner();
    const d = s.describe();
    expect(d.type).toBe("local-env");
    expect(d.durable).toBe(false);
    expect(d.hardwareBound).toBe(false);
    expect(d.display.toLowerCase()).toContain("dev only");
  });

  it("env-var mode: uses the configured keypair", async () => {
    // Generate a real keypair, set env, instantiate.
    const tmp = new LocalEnvSigner();
    process.env.SOVEREIGN_PLATFORM_PRIVATE_KEY = (tmp as unknown as {
      privateKey: string;
    }).privateKey;
    process.env.SOVEREIGN_PLATFORM_PUBLIC_KEY = (tmp as unknown as {
      publicKey: string;
    }).publicKey;
    const configured = new LocalEnvSigner();
    expect(await configured.getPublicKey()).toBe(
      process.env.SOVEREIGN_PLATFORM_PUBLIC_KEY,
    );
    expect(configured.describe().durable).toBe(true);

    delete process.env.SOVEREIGN_PLATFORM_PRIVATE_KEY;
    delete process.env.SOVEREIGN_PLATFORM_PUBLIC_KEY;
  });
});

describe("StubKmsSigner", () => {
  it("returns the operator-supplied public key", async () => {
    const s = new StubKmsSigner({
      provider: "aws-kms",
      keyId: "arn:aws:kms:us-east-1:123:key/abc",
      publicKey: "fake-pubkey",
    });
    expect(await s.getPublicKey()).toBe("fake-pubkey");
  });

  it("describes itself with correct provider type", () => {
    const s = new StubKmsSigner({
      provider: "gcp-kms",
      keyId: "projects/p/locations/global/keyRings/r/cryptoKeys/k",
      publicKey: "x",
    });
    const d = s.describe();
    expect(d.type).toBe("gcp-kms");
    expect(d.durable).toBe(true);
    expect(d.display).toContain("gcp-kms");
  });

  it("hardwareBound=true when provider name contains 'hsm'", () => {
    const s = new StubKmsSigner({
      provider: "aws-cloudhsm",
      keyId: "k",
      publicKey: "p",
    });
    expect(s.describe().hardwareBound).toBe(true);
  });

  it("THROWS on sign() — fails closed if a misconfig leaks to prod", async () => {
    const s = new StubKmsSigner({
      provider: "aws-kms",
      keyId: "x",
      publicKey: "y",
    });
    await expect(s.sign("any-message")).rejects.toThrow(
      /structural placeholder/,
    );
  });
});

describe("getActiveSigner / registerActiveSigner / cache lifecycle", () => {
  beforeEach(() => {
    _resetSignerForTesting();
    delete process.env.SOVEREIGN_SIGNER_TYPE;
    delete process.env.SOVEREIGN_PLATFORM_PRIVATE_KEY;
    delete process.env.SOVEREIGN_PLATFORM_PUBLIC_KEY;
  });

  it("returns a LocalEnvSigner by default", () => {
    const s = getActiveSigner();
    expect(s).toBeInstanceOf(LocalEnvSigner);
  });

  it("memoizes — same instance across calls", () => {
    const a = getActiveSigner();
    const b = getActiveSigner();
    expect(a).toBe(b);
  });

  it("_resetSignerForTesting() clears the cache", () => {
    const a = getActiveSigner();
    _resetSignerForTesting();
    const b = getActiveSigner();
    expect(a).not.toBe(b);
  });

  it("operator can registerActiveSigner with a custom adapter", () => {
    const custom: Signer = {
      async getPublicKey() {
        return "custom-pub";
      },
      async sign(_m) {
        return "custom-sig";
      },
      describe() {
        return {
          type: "custom",
          display: "Custom adapter for testing",
          durable: true,
          hardwareBound: true,
        };
      },
    };
    registerActiveSigner(custom);
    const got = getActiveSigner();
    expect(got).toBe(custom);
    expect(got.describe().type).toBe("custom");
  });

  it("when SOVEREIGN_SIGNER_TYPE=aws-kms but no operator adapter: returns Stub (fails loudly on sign)", async () => {
    process.env.SOVEREIGN_SIGNER_TYPE = "aws-kms";
    process.env.SOVEREIGN_PLATFORM_PUBLIC_KEY = "operator-pub";
    process.env.SOVEREIGN_KMS_KEY_ID = "arn:aws:kms:us-east-1:123:key/x";
    const s = getActiveSigner();
    expect(s).toBeInstanceOf(StubKmsSigner);
    expect(await s.getPublicKey()).toBe("operator-pub");
    await expect(s.sign("test")).rejects.toThrow();
  });
});
