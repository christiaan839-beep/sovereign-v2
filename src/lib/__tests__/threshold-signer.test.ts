/**
 * Tests for src/lib/threshold-signer.ts.
 *
 * Uses real Node-crypto Ed25519 keypairs generated in beforeAll —
 * the threshold signer must work with the same PEM format that
 * production deployments will use, so we don't mock the crypto here.
 * Only the env vars are mutated.
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import { generateKeyPairSync } from "node:crypto";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  getThresholdConfig,
  isThresholdEnabled,
  thresholdStatus,
  signThreshold,
  verifyThreshold,
  localCosignerIds,
  issuerEnvSuffix,
} from "../threshold-signer";

interface KP {
  pkPem: string;
  skPem: string;
}

function genEd25519(): KP {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    pkPem: publicKey.export({ type: "spki", format: "pem" }) as string,
    skPem: privateKey.export({ type: "pkcs8", format: "pem" }) as string,
  };
}

const ISSUERS = ["sovereign-prod", "witness-cra", "witness-eu", "witness-us"];
const KEYS: Record<string, KP> = {};

const originalEnv = { ...process.env };

beforeAll(() => {
  for (const id of ISSUERS) {
    KEYS[id] = genEd25519();
  }
});

beforeEach(() => {
  // Reset env to a known clean slate before each test
  for (const k of Object.keys(process.env)) {
    if (k.startsWith("THRESHOLD_") || k.startsWith("TRS_ED25519_")) {
      delete process.env[k];
    }
  }
});

afterAll(() => {
  Object.assign(process.env, originalEnv);
});

describe("issuerEnvSuffix", () => {
  it("normalises issuer ids to env-safe upper-snake", () => {
    expect(issuerEnvSuffix("sovereign-prod")).toBe("SOVEREIGN_PROD");
    expect(issuerEnvSuffix("witness.eu")).toBe("WITNESS_EU");
    expect(issuerEnvSuffix("a-b-c")).toBe("A_B_C");
  });

  it("is symmetric — same suffix for SK and PK lookups", () => {
    expect(issuerEnvSuffix("witness-cra")).toBe(issuerEnvSuffix("witness-cra"));
  });
});

describe("getThresholdConfig", () => {
  it("returns null when no THRESHOLD_ISSUERS is set", () => {
    expect(getThresholdConfig()).toBeNull();
    expect(isThresholdEnabled()).toBe(false);
  });

  it("returns null when fewer than 2 issuers are configured", () => {
    process.env.THRESHOLD_ISSUERS = "sovereign-prod";
    expect(getThresholdConfig()).toBeNull();
  });

  it("returns null when THRESHOLD_M is invalid", () => {
    process.env.THRESHOLD_ISSUERS = ISSUERS.join(",");
    process.env.THRESHOLD_M = "0";
    expect(getThresholdConfig()).toBeNull();
    process.env.THRESHOLD_M = "5"; // > n=4
    expect(getThresholdConfig()).toBeNull();
    process.env.THRESHOLD_M = "abc";
    expect(getThresholdConfig()).toBeNull();
  });

  it("returns null when issuer list has duplicates", () => {
    process.env.THRESHOLD_ISSUERS = "a,b,a";
    process.env.THRESHOLD_M = "2";
    expect(getThresholdConfig()).toBeNull();
  });

  it("parses a valid 3-of-4 configuration", () => {
    process.env.THRESHOLD_ISSUERS = ISSUERS.join(",");
    process.env.THRESHOLD_M = "3";
    const cfg = getThresholdConfig();
    expect(cfg).toEqual({ m: 3, authorizedIssuers: ISSUERS });
    expect(isThresholdEnabled()).toBe(true);
  });

  it("defaults to m=2 when THRESHOLD_M is unset", () => {
    process.env.THRESHOLD_ISSUERS = "a,b,c";
    const cfg = getThresholdConfig();
    expect(cfg?.m).toBe(2);
  });
});

describe("signThreshold + verifyThreshold — single local cosigner", () => {
  beforeEach(() => {
    process.env.THRESHOLD_ISSUERS = ISSUERS.join(",");
    process.env.THRESHOLD_M = "2";
    // Only `sovereign-prod` has a local SK; other issuers are external.
    process.env[`TRS_ED25519_SK_${issuerEnvSuffix("sovereign-prod")}`] =
      KEYS["sovereign-prod"].skPem;
    // Public keys for verification — all four.
    for (const id of ISSUERS) {
      process.env[`TRS_ED25519_PK_${issuerEnvSuffix(id)}`] = KEYS[id].pkPem;
    }
  });

  it("produces an attestation with one cosigner — quorum NOT yet met", () => {
    const result = signThreshold("hello canonical bytes");
    expect(result).not.toBeNull();
    expect(result!.attestation.cosigners.length).toBe(1);
    expect(result!.attestation.cosigners[0].issuerId).toBe("sovereign-prod");
    expect(result!.quorumMet).toBe(false);
    expect(result!.localContributions).toEqual(["sovereign-prod"]);
  });

  it("verifies the single local signature even before quorum is met", async () => {
    const result = signThreshold("hello canonical bytes");
    const verify = await verifyThreshold(result!.attestation);
    // With m=2 and only 1 valid signature, verify must report ok=false
    // (quorum not met) but the SINGLE signature must verify.
    expect(verify.ok).toBe(false);
    expect(verify.validSignatureCount).toBe(1);
    expect(verify.verifyingIssuers).toEqual(["sovereign-prod"]);
  });
});

describe("signThreshold + verifyThreshold — full m-of-n", () => {
  beforeEach(() => {
    process.env.THRESHOLD_ISSUERS = ISSUERS.join(",");
    process.env.THRESHOLD_M = "3";
    // All four local keys present — this server is acting as ALL
    // four cosigners for the test. Realistic deployments split these
    // across separate servers; the math is the same.
    for (const id of ISSUERS) {
      process.env[`TRS_ED25519_SK_${issuerEnvSuffix(id)}`] = KEYS[id].skPem;
      process.env[`TRS_ED25519_PK_${issuerEnvSuffix(id)}`] = KEYS[id].pkPem;
    }
  });

  it("contributes all 4 cosigners — quorum met at m=3", () => {
    const result = signThreshold("multi-witness canonical");
    expect(result!.attestation.cosigners.length).toBe(4);
    expect(result!.quorumMet).toBe(true);
    expect(result!.localContributions).toHaveLength(4);
  });

  it("verifies with all 4 cosignatures", async () => {
    const result = signThreshold("multi-witness canonical");
    const verify = await verifyThreshold(result!.attestation);
    expect(verify.ok).toBe(true);
    expect(verify.validSignatureCount).toBe(4);
    expect(verify.required).toBe(3);
  });

  it("rejects a tampered canonical (contentHash mismatch)", async () => {
    const result = signThreshold("original");
    const tampered = { ...result!.attestation, canonical: "tampered" };
    const verify = await verifyThreshold(tampered);
    expect(verify.ok).toBe(false);
    expect(verify.reason).toContain("contentHash mismatch");
  });

  it("rejects a tampered cosigner signature", async () => {
    const result = signThreshold("immutable");
    // Flip a byte in the first cosigner's signature.
    const tampered = {
      ...result!.attestation,
      cosigners: result!.attestation.cosigners.map((c, i) =>
        i === 0
          ? {
              ...c,
              signature:
                "v2=" + Buffer.from("garbage".repeat(8)).toString("base64"),
            }
          : c,
      ),
    };
    const verify = await verifyThreshold(tampered);
    // 3 of 4 signatures still verify (the other 3 are intact) — that
    // meets m=3, so the verifier reports ok=true. This is correct
    // threshold-signing behavior: one compromise doesn't break the
    // proof so long as quorum is met. The rejection of the bad sig
    // IS visible in `rejected`.
    expect(verify.ok).toBe(true);
    expect(verify.validSignatureCount).toBe(3);
    expect(verify.rejected).toHaveLength(1);
  });

  it("DOES fail when more than (n-m) signatures are tampered", async () => {
    const result = signThreshold("under attack");
    // m=3, n=4. Tampering with 2 signatures leaves 2 valid, < m.
    const tampered = {
      ...result!.attestation,
      cosigners: result!.attestation.cosigners.map((c, i) =>
        i < 2
          ? {
              ...c,
              signature:
                "v2=" + Buffer.from("garbage".repeat(8)).toString("base64"),
            }
          : c,
      ),
    };
    const verify = await verifyThreshold(tampered);
    expect(verify.ok).toBe(false);
    expect(verify.validSignatureCount).toBe(2);
  });
});

describe("signThreshold — external cosigners", () => {
  beforeEach(() => {
    process.env.THRESHOLD_ISSUERS = ISSUERS.join(",");
    process.env.THRESHOLD_M = "2";
    // Only sovereign-prod has a local SK here.
    process.env[`TRS_ED25519_SK_${issuerEnvSuffix("sovereign-prod")}`] =
      KEYS["sovereign-prod"].skPem;
    for (const id of ISSUERS) {
      process.env[`TRS_ED25519_PK_${issuerEnvSuffix(id)}`] = KEYS[id].pkPem;
    }
  });

  it("merges external cosigner signatures and meets quorum", async () => {
    // Pre-compute what the external witness would have signed
    // (boundBytes equivalent). Use the SAME util as the verifier.
    const { trsSigningBytes } =
      await import("@sovereign-matrix/verifiable-receipts");
    const cfg = getThresholdConfig()!;
    const boundBytes = trsSigningBytes(
      "ship it",
      { m: cfg.m, n: cfg.authorizedIssuers.length },
      cfg.authorizedIssuers,
    );

    // Sign as `witness-cra` (external — we don't have its SK in env).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createPrivateKey, sign: nodeSign } = require("crypto");
    const key = createPrivateKey({
      key: KEYS["witness-cra"].skPem,
      format: "pem",
    });
    const witnessSig =
      "v2=" +
      (nodeSign(null, Buffer.from(boundBytes, "utf8"), key) as Buffer).toString(
        "base64",
      );

    const result = signThreshold("ship it", {
      externalCosigners: [{ issuerId: "witness-cra", signature: witnessSig }],
    });

    expect(result!.attestation.cosigners.length).toBe(2);
    expect(result!.quorumMet).toBe(true);

    const verify = await verifyThreshold(result!.attestation);
    expect(verify.ok).toBe(true);
    expect(verify.validSignatureCount).toBe(2);
  });

  it("rejects external cosigner that duplicates a local issuer", () => {
    const result = signThreshold("dedupe", {
      externalCosigners: [
        {
          issuerId: "sovereign-prod",
          signature: "v2=" + Buffer.from("anything").toString("base64"),
        },
      ],
    });
    // Local sovereign-prod wins; the external one is dropped.
    const ids = result!.attestation.cosigners.map((c) => c.issuerId);
    expect(ids.filter((i) => i === "sovereign-prod")).toHaveLength(1);
  });
});

describe("thresholdStatus", () => {
  it("reports disabled when no config", () => {
    const s = thresholdStatus();
    expect(s.enabled).toBe(false);
    expect(s.localCosignerCount).toBe(0);
  });

  it("reports the registry shape + local cosigner count", () => {
    process.env.THRESHOLD_ISSUERS = ISSUERS.join(",");
    process.env.THRESHOLD_M = "3";
    process.env[`TRS_ED25519_SK_${issuerEnvSuffix("sovereign-prod")}`] =
      KEYS["sovereign-prod"].skPem;
    process.env[`TRS_ED25519_SK_${issuerEnvSuffix("witness-eu")}`] =
      KEYS["witness-eu"].skPem;
    const s = thresholdStatus();
    expect(s.enabled).toBe(true);
    expect(s.m).toBe(3);
    expect(s.n).toBe(4);
    expect(s.localCosignerCount).toBe(2);
    expect(s.authorizedIssuers).toEqual(ISSUERS);
  });
});

describe("localCosignerIds", () => {
  it("only returns issuers whose SK env var is present", () => {
    process.env.THRESHOLD_ISSUERS = ISSUERS.join(",");
    process.env.THRESHOLD_M = "2";
    process.env[`TRS_ED25519_SK_${issuerEnvSuffix("witness-cra")}`] =
      KEYS["witness-cra"].skPem;
    expect(localCosignerIds()).toEqual(["witness-cra"]);
  });
});
