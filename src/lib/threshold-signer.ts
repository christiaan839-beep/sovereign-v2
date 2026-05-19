/**
 * SOVEREIGN MATRIX — Threshold-signed receipts (TRS) wired into the platform.
 *
 * The `@sovereign-matrix/verifiable-receipts/threshold` primitive is
 * cryptographically complete; this module is the operational wiring:
 *   - reads the cosigner registry from env
 *   - signs the bound TRS bytes with whichever local issuer keys
 *     this server holds (typically one — `sovereign-prod`)
 *   - accepts external cosigner signatures (passed in by /api/transparency
 *     witness handshakes) and assembles the final m-of-n envelope
 *   - exposes a verifier that resolves issuer-id → public key from env
 *
 * Trust model:
 *   Before this module: a single AGENT_RUN_ED25519_PRIVATE_KEY signs
 *   every receipt. Compromising that key forges receipts.
 *
 *   After this module: every threshold-signed receipt requires m valid
 *   signatures from the registered issuer set. Compromising our server
 *   produces an invalid threshold envelope; verifiers reject it
 *   regardless of how convincing the single signature looks.
 *
 * Env contract:
 *   THRESHOLD_ISSUERS    = "sovereign-prod,witness-cra,witness-eu,witness-us"
 *   THRESHOLD_M          = "3"
 *   TRS_ED25519_SK_SOVEREIGN_PROD = <PEM>   (local signing key for that issuer)
 *   TRS_ED25519_PK_WITNESS_CRA    = <PEM>   (public key for verifying witness-cra)
 *   ...etc
 *
 * Issuer-id normalisation: `sovereign-prod` → `SOVEREIGN_PROD` in env var
 * name (uppercase, non-alphanum → underscore). The mapping is symmetric
 * between SK and PK lookups so an operator only memorises the rule once.
 */

import {
  assembleThresholdAttestation,
  verifyThresholdAttestation,
  trsSigningBytes,
  type ThresholdAttestation,
  type ThresholdCosigner,
  type ThresholdVerifyResult,
} from "@sovereign-matrix/verifiable-receipts";
import { createLogger } from "@/lib/logger";

const log = createLogger("threshold-signer");

export interface ThresholdConfig {
  m: number;
  authorizedIssuers: string[];
}

/**
 * Normalise an issuer id to its env-var suffix. `sovereign-prod` →
 * `SOVEREIGN_PROD`. Symmetric so SK + PK lookups agree.
 */
export function issuerEnvSuffix(issuerId: string): string {
  return issuerId.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

/**
 * Resolve the active threshold config from env. Returns null when
 * threshold signing isn't configured (no THRESHOLD_ISSUERS, fewer
 * than 2 issuers, or invalid THRESHOLD_M). Callers fall back to
 * single-signer mode in that case.
 */
/**
 * Hard cap on the threshold-issuer set. Bounds the size of every
 * persisted TRS attestation (each cosigner contributes ~120B to the
 * audit-log row). 32 is far above any plausible federation membership
 * — Ethereum-style threshold consensus uses 4-16 in practice — while
 * keeping a single attestation row well under the Postgres TOAST
 * threshold even with verbose issuer ids.
 */
export const MAX_THRESHOLD_ISSUERS = 32;

export function getThresholdConfig(): ThresholdConfig | null {
  const raw = process.env.THRESHOLD_ISSUERS;
  if (!raw) return null;
  const issuers = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (issuers.length < 2) return null;
  if (issuers.length > MAX_THRESHOLD_ISSUERS) {
    log.warn(
      "THRESHOLD_ISSUERS exceeds MAX_THRESHOLD_ISSUERS — threshold disabled",
      { n: issuers.length, max: MAX_THRESHOLD_ISSUERS },
    );
    return null;
  }
  if (new Set(issuers).size !== issuers.length) {
    log.warn("THRESHOLD_ISSUERS contains duplicates — threshold disabled");
    return null;
  }
  const mRaw = process.env.THRESHOLD_M ?? "2";
  const m = Number(mRaw);
  if (!Number.isInteger(m) || m < 1 || m > issuers.length) {
    log.warn("THRESHOLD_M invalid for issuer set — threshold disabled", {
      m: mRaw,
      n: issuers.length,
    });
    return null;
  }
  return { m, authorizedIssuers: issuers };
}

export function isThresholdEnabled(): boolean {
  return getThresholdConfig() !== null;
}

/**
 * Discover which authorized issuers this server holds a signing key for.
 * In a federated deployment most servers hold exactly one (their own);
 * the rest of the quorum is collected from external witnesses.
 */
export function localCosignerIds(): string[] {
  const cfg = getThresholdConfig();
  if (!cfg) return [];
  return cfg.authorizedIssuers.filter(
    (id) => !!process.env[`TRS_ED25519_SK_${issuerEnvSuffix(id)}`],
  );
}

function signEd25519WithPem(pem: string, bytes: string): string {
  // Match the pattern used by src/lib/agent-tokens.ts:signEd25519 —
  // Node's single-shot crypto.sign(null, ...) is the supported call for
  // Ed25519 PEM keys. Lazy-require so the typing surface stays narrow.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createPrivateKey, sign: nodeSign } = require("crypto");
  const key = createPrivateKey({ key: pem, format: "pem" });
  const sig = nodeSign(null, Buffer.from(bytes, "utf8"), key);
  return `v2=${(sig as Buffer).toString("base64")}`;
}

function verifyEd25519WithPem(
  pem: string,
  bytes: string,
  signature: string,
): boolean {
  if (!signature.startsWith("v2=")) return false;
  let rawSig: Buffer;
  try {
    rawSig = Buffer.from(signature.slice(3), "base64");
  } catch {
    return false;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createPublicKey, verify: nodeVerify } = require("crypto");
    const key = createPublicKey({ key: pem, format: "pem" });
    return nodeVerify(null, Buffer.from(bytes, "utf8"), key, rawSig) === true;
  } catch (err) {
    log.warn("verifyEd25519WithPem threw", { error: String(err) });
    return false;
  }
}

export interface ThresholdSignOptions {
  /** Cosigner signatures provided by external witnesses (out-of-band collected). */
  externalCosigners?: ThresholdCosigner[];
}

export interface ThresholdSignResult {
  attestation: ThresholdAttestation;
  /** True iff the quorum threshold m was met by the cosigners present. */
  quorumMet: boolean;
  /** Local issuers we contributed signatures for. */
  localContributions: string[];
}

/**
 * Sign `canonical` under the active threshold config. Returns null when
 * threshold signing isn't enabled — callers fall back to single-signer.
 *
 * The attestation is returned even when the m-quorum isn't met (e.g. the
 * server only has 1 local key and no external cosigners were supplied) so
 * the caller can persist it and collect remaining cosignatures later via
 * a witness handshake. `quorumMet` reports whether it's currently valid.
 */
export function signThreshold(
  canonical: string,
  opts: ThresholdSignOptions = {},
): ThresholdSignResult | null {
  const cfg = getThresholdConfig();
  if (!cfg) return null;

  const threshold = { m: cfg.m, n: cfg.authorizedIssuers.length };
  const boundBytes = trsSigningBytes(
    canonical,
    threshold,
    cfg.authorizedIssuers,
  );

  const localContributions: string[] = [];
  const localCosigners: ThresholdCosigner[] = [];
  for (const issuerId of cfg.authorizedIssuers) {
    const pem = process.env[`TRS_ED25519_SK_${issuerEnvSuffix(issuerId)}`];
    if (!pem) continue;
    try {
      const signature = signEd25519WithPem(pem, boundBytes);
      localCosigners.push({ issuerId, signature });
      localContributions.push(issuerId);
    } catch (err) {
      log.error("threshold signing failed for issuer", {
        issuerId,
        error: String(err),
      });
    }
  }

  // De-duplicate by issuerId — external cosigners must not collide with
  // local ones. assembleThresholdAttestation enforces this too, but
  // catching it here gives a clearer error and avoids constructing
  // an envelope the assembler will reject.
  const seen = new Set(localCosigners.map((c) => c.issuerId));
  const externals = (opts.externalCosigners ?? []).filter((c) => {
    if (seen.has(c.issuerId)) {
      log.warn("external cosigner duplicates local issuer — skipping", {
        issuerId: c.issuerId,
      });
      return false;
    }
    seen.add(c.issuerId);
    return true;
  });

  const attestation = assembleThresholdAttestation({
    canonical,
    threshold,
    authorizedIssuers: cfg.authorizedIssuers,
    cosigners: [...localCosigners, ...externals],
  });

  const quorumMet = attestation.cosigners.length >= cfg.m;
  return { attestation, quorumMet, localContributions };
}

/**
 * Verify a threshold attestation. Resolves issuer public keys from
 * `TRS_ED25519_PK_<ISSUER>` env vars. Returns the structured result
 * including which issuers verified.
 */
export async function verifyThreshold(
  attestation: ThresholdAttestation,
): Promise<ThresholdVerifyResult> {
  return verifyThresholdAttestation(attestation, {
    verifyIssuerSignature: (boundBytes, signature, issuerId) => {
      const pem = process.env[`TRS_ED25519_PK_${issuerEnvSuffix(issuerId)}`];
      if (!pem) return false;
      return verifyEd25519WithPem(pem, boundBytes, signature);
    },
  });
}

/**
 * Operational snapshot for the `/api/transparency/threshold-status`
 * endpoint and the public `/security` page. Reveals only the registry
 * shape + the local-cosigner count — never which specific witnesses
 * a server holds keys for, since that'd help an attacker target the
 * minimum set of compromises.
 */
export function thresholdStatus(): {
  enabled: boolean;
  m: number;
  n: number;
  localCosignerCount: number;
  authorizedIssuers: string[];
} {
  const cfg = getThresholdConfig();
  if (!cfg) {
    return {
      enabled: false,
      m: 0,
      n: 0,
      localCosignerCount: 0,
      authorizedIssuers: [],
    };
  }
  return {
    enabled: true,
    m: cfg.m,
    n: cfg.authorizedIssuers.length,
    localCosignerCount: localCosignerIds().length,
    authorizedIssuers: cfg.authorizedIssuers,
  };
}
