/**
 * Performance benchmark corpus for the verifiable-receipts package.
 *
 * Run with: `npx vitest bench packages/verifiable-receipts/bench`
 *
 * Why this exists: any cryptographic primitive that claims to be
 * production-grade needs a measurable performance floor. Sigstore,
 * Certificate Transparency, and C2PA all publish benchmark numbers.
 * We didn't. This corpus closes that elite-level gap.
 *
 * What's benchmarked:
 *   - leafHash      (single SHA-256 over 0x00 || data)
 *   - innerHash     (single SHA-256 over 0x01 || left || right)
 *   - treeRoot      (RFC 6962 MTH at n = 10 / 100 / 1000 / 10_000)
 *   - inclusionProof + verifyInclusionProof round-trip
 *   - VAPT mint + verify
 *   - TRS m-of-n verify (m=1/3/5 of n=5)
 *   - audit-DSL parseQuery + queryReceipts
 *   - anomaly detectAnomalies (n = 100 / 1000)
 *
 * Each benchmark reports hz (ops/sec) + mean time. Regression
 * detection is left to the operator — checked-in baseline at
 * `bench/BASELINE.md` (updated when intentional perf changes ship).
 */
import { bench, describe } from "vitest";
import {
  leafHash,
  innerHash,
  treeRoot,
  inclusionProof,
  verifyInclusionProof,
} from "../src/transparency.js";
import { mintVapt, verifyVapt } from "../src/vapt.js";
import {
  assembleThresholdAttestation,
  verifyThresholdAttestation,
  trsSigningBytes,
} from "../src/threshold.js";
import { parseQuery, queryReceipts } from "../src/audit-dsl.js";
import { detectAnomalies } from "../src/anomaly.js";
import type { ReceiptRecord } from "../src/audit-dsl.js";
import {
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
} from "node:crypto";

// ── Hash primitives ──────────────────────────────────────────────────

describe("hash primitives", () => {
  const data = "x".repeat(256);
  const leafA = leafHash("a");
  const leafB = leafHash("b");

  bench("leafHash(256-byte chunk)", () => {
    leafHash(data);
  });

  bench("innerHash(left + right)", () => {
    innerHash(leafA, leafB);
  });
});

// ── Merkle tree construction (RFC 6962 MTH) ──────────────────────────

describe("treeRoot — RFC 6962 MTH", () => {
  const leaves10 = Array.from({ length: 10 }, (_, i) => leafHash(`leaf-${i}`));
  const leaves100 = Array.from({ length: 100 }, (_, i) =>
    leafHash(`leaf-${i}`),
  );
  const leaves1k = Array.from({ length: 1_000 }, (_, i) =>
    leafHash(`leaf-${i}`),
  );
  const leaves10k = Array.from({ length: 10_000 }, (_, i) =>
    leafHash(`leaf-${i}`),
  );

  bench("treeRoot(n=10)", () => {
    treeRoot(leaves10);
  });
  bench("treeRoot(n=100)", () => {
    treeRoot(leaves100);
  });
  bench("treeRoot(n=1000)", () => {
    treeRoot(leaves1k);
  });
  bench(
    "treeRoot(n=10000)",
    () => {
      treeRoot(leaves10k);
    },
    { iterations: 30 },
  );
});

// ── Inclusion proof round-trip ───────────────────────────────────────

describe("inclusion proof round-trip", () => {
  const leaves100 = Array.from({ length: 100 }, (_, i) =>
    leafHash(`leaf-${i}`),
  );
  const root100 = treeRoot(leaves100);
  const proof = inclusionProof(42, leaves100);

  bench("inclusionProof(idx=42, n=100)", () => {
    inclusionProof(42, leaves100);
  });
  bench("verifyInclusionProof(idx=42, n=100)", () => {
    verifyInclusionProof(leaves100[42], 42, 100, proof, root100);
  });
});

// ── VAPT mint + verify ───────────────────────────────────────────────

describe("VAPT mint + verify", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const sign = (canonical: string) =>
    new Uint8Array(nodeSign(null, Buffer.from(canonical, "utf8"), privateKey));
  const verify = (
    canonical: string,
    signature: Uint8Array,
    pub: unknown,
  ): boolean =>
    nodeVerify(
      null,
      Buffer.from(canonical, "utf8"),
      pub as Parameters<typeof nodeVerify>[2],
      Buffer.from(signature),
    );

  const now = new Date();
  const payload = {
    tokenId: "bench_001",
    userId: "user_bench",
    agentId: "agent_bench",
    maxAmount: 5000,
    currency: "USD" as const,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
    singleUse: true,
  };
  const token = mintVapt(payload, sign);

  bench("mintVapt(USD 5000, 30min lifetime)", () => {
    mintVapt(payload, sign);
  });
  bench("verifyVapt(valid token)", () => {
    verifyVapt(token, {
      proposedAmount: 1000,
      proposedCurrency: "USD",
      proposedMerchantId: "merchant_a",
      verifySignature: verify,
      publicKeyMaterial: publicKey,
    });
  });
});

// ── TRS m-of-n verifier ──────────────────────────────────────────────

describe("TRS m-of-n verifier", () => {
  function makeIssuers(n: number) {
    return Array.from({ length: n }, (_, i) => {
      const { privateKey, publicKey } = generateKeyPairSync("ed25519");
      return { id: `issuer-${i}`, privateKey, publicKey };
    });
  }
  const issuers5 = makeIssuers(5);
  const CANONICAL = '{"verdictId":"bench_trs"}';
  const authorized = issuers5.map((i) => i.id);

  function buildEnvelope(m: number, cosignerCount: number) {
    const threshold = { m, n: 5 };
    const boundBytes = trsSigningBytes(CANONICAL, threshold, authorized);
    const cosigners = issuers5.slice(0, cosignerCount).map((i) => ({
      issuerId: i.id,
      signature:
        "v2=" +
        nodeSign(null, Buffer.from(boundBytes, "utf8"), i.privateKey).toString(
          "base64",
        ),
    }));
    return assembleThresholdAttestation({
      canonical: CANONICAL,
      threshold,
      authorizedIssuers: authorized,
      cosigners,
    });
  }

  const env_1of5 = buildEnvelope(1, 1);
  const env_3of5 = buildEnvelope(3, 3);
  const env_5of5 = buildEnvelope(5, 5);

  const opts = {
    verifyIssuerSignature: (
      canonical: string,
      signature: string,
      issuerId: string,
    ) => {
      const issuer = issuers5.find((i) => i.id === issuerId);
      if (!issuer) return false;
      if (!signature.startsWith("v2=")) return false;
      try {
        return nodeVerify(
          null,
          Buffer.from(canonical, "utf8"),
          issuer.publicKey,
          Buffer.from(signature.slice(3), "base64"),
        );
      } catch {
        return false;
      }
    },
  };

  bench("verifyThresholdAttestation(1-of-5)", async () => {
    await verifyThresholdAttestation(env_1of5, opts);
  });
  bench("verifyThresholdAttestation(3-of-5)", async () => {
    await verifyThresholdAttestation(env_3of5, opts);
  });
  bench("verifyThresholdAttestation(5-of-5)", async () => {
    await verifyThresholdAttestation(env_5of5, opts);
  });
});

// ── Audit-DSL parser + executor ──────────────────────────────────────

describe("audit-DSL parser + executor", () => {
  const fixtures: ReceiptRecord[] = Array.from({ length: 1000 }, (_, i) => ({
    verdictId: `v_${i}`,
    overall:
      i % 10 === 0
        ? ("block" as const)
        : i % 3 === 0
          ? ("warn" as const)
          : ("pass" as const),
    issuedAt: new Date(Date.now() - i * 60_000).toISOString(),
    agentSlug: `agent-${i % 5}`,
    pack: `pack-${i % 3}`,
    ruleCount: (i % 5) + 1,
  }));

  bench("parseQuery(SELECT * WHERE ... AND ... ORDER BY ... LIMIT 50)", () => {
    parseQuery(
      "SELECT verdictId, overall, agentSlug FROM receipts WHERE overall = 'block' AND ruleCount > 2 ORDER BY issuedAt DESC LIMIT 50",
    );
  });

  bench("queryReceipts(1000 rows, projected, ordered, limited)", () => {
    queryReceipts(
      fixtures,
      "SELECT verdictId, overall, agentSlug FROM receipts WHERE overall = 'block' AND ruleCount > 2 ORDER BY issuedAt DESC LIMIT 50",
    );
  });
});

// ── Anomaly detector ─────────────────────────────────────────────────

describe("anomaly detectAnomalies", () => {
  function buildCorpus(n: number): ReceiptRecord[] {
    return Array.from({ length: n }, (_, i) => ({
      verdictId: `v_${i}`,
      overall:
        i % 50 === 0
          ? ("block" as const)
          : i % 7 === 0
            ? ("warn" as const)
            : ("pass" as const),
      issuedAt: new Date(Date.now() - (n - i) * 60_000).toISOString(),
      agentSlug: `agent-${i % 3}`,
      pack: `pack-${i % 4}`,
    }));
  }
  const corpus100 = buildCorpus(100);
  const corpus1k = buildCorpus(1_000);

  bench("detectAnomalies(n=100)", () => {
    detectAnomalies(corpus100);
  });
  bench("detectAnomalies(n=1000)", () => {
    detectAnomalies(corpus1k);
  });
});
