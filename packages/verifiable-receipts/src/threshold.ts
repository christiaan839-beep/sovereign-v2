/**
 * Threshold Receipt Signatures (TRS) — m-of-n issuer co-signing.
 *
 * A receipt under TRS is canonical only when at least `m` of `n`
 * designated issuers have independently signed the same canonical
 * bytes. The trust model flips from "trust this one issuer" to
 * "trust the m-quorum of the n-issuer registry" — no single issuer
 * can fraud the receipt because at least `m-1` independent parties
 * would need to collude.
 *
 * This is the receipt-layer analogue of:
 *   - Bitcoin multisig (m-of-n on transaction outputs)
 *   - TLS notary federations (Convergence, Perspectives)
 *   - Certificate Transparency cross-witness (RFC 9162 §4)
 *
 * Why this matters: a single-issuer receipt is only as trustworthy as
 * the issuer's key custody. A quorum receipt survives the compromise of
 * any m-1 issuers, which is the property a regulator actually wants
 * when the issuer is also the party being audited.
 *
 * Wire format extension:
 *
 *   The threshold envelope is layered ON TOP of the existing canonical
 *   projection used by VAOS v2/v3 — it does NOT modify the bytes that
 *   each individual issuer signs. Each issuer signs the same canonical
 *   exactly as in VAOS 2.0; the envelope simply aggregates their
 *   signatures into a single document.
 *
 * @packageDocumentation
 */

import { createHash } from "node:crypto";

/**
 * The threshold-signed envelope. Wire format is the JSON serialization
 * of this interface; canonical bytes are the UTF-8 of the `canonical`
 * field, identical to VAOS 2.0.
 */
export interface ThresholdAttestation {
  /** Stable schema version. Verifiers MUST tolerate additive fields. */
  scheme: "trs1";
  /** Canonical projection — exactly the bytes each cosigner signs. */
  canonical: string;
  /** sha256(canonical) for cross-check. */
  contentHash: string;
  /** Threshold parameters. */
  threshold: {
    /** Minimum number of valid signatures required. */
    m: number;
    /** Total number of designated issuers. */
    n: number;
  };
  /**
   * The full set of authorized issuer ids. Verifiers MUST only count
   * signatures whose issuerId is in this list (defense against an
   * attacker padding the cosigners array with rogue keys).
   */
  authorizedIssuers: string[];
  /** Each issuer's contribution. Order does not matter. */
  cosigners: ThresholdCosigner[];
  /** ISO-8601 of when this envelope was assembled. */
  assembledAt: string;
}

export interface ThresholdCosigner {
  /** Stable issuer id (must appear in authorizedIssuers). */
  issuerId: string;
  /** Wire-format signature: v2= or v3= prefix, base64 body. */
  signature: string;
  /** Optional pubkey URL where verifiers can fetch the issuer's PEM. */
  publicKeyUrl?: string;
}

export interface ThresholdVerifyOptions {
  /**
   * Verifier callback: given (canonical, signature, issuerId), return
   * true if the signature verifies under that issuer's public key.
   * Caller supplies the cryptographic primitive (Node crypto, KMS, etc.)
   * and the issuer-id → pubkey resolution (typically by hitting the
   * issuer registry from /.well-known/sovereign-receipts/issuers.json).
   */
  verifyIssuerSignature: (
    canonical: string,
    signature: string,
    issuerId: string,
  ) => boolean | Promise<boolean>;
}

export interface ThresholdVerifyResult {
  ok: boolean;
  reason?: string;
  /** Number of issuers whose signature verified AND appears in authorizedIssuers. */
  validSignatureCount: number;
  /** Threshold requirement. */
  required: number;
  /** Verifying issuers, in canonical order (for audit). */
  verifyingIssuers: string[];
  /** Cosigners we rejected and why. */
  rejected: Array<{ issuerId: string; reason: string }>;
}

/**
 * Compute the bytes each cosigner MUST sign for a TRS envelope.
 *
 * Binds the canonical receipt bytes together with the threshold
 * parameters (m, n) and the sorted authorizedIssuers list. Without
 * this binding, an attacker who collects valid VAOS v2 signatures
 * for the same canonical from m authorized issuers could rewrap
 * them into a TRS envelope with arbitrary (m, n) and authorizedIssuers
 * values — none of which the cosigners explicitly agreed to.
 *
 * The wire-tag `trs1:` plus the sorted authorizedIssuers commit each
 * signature to a specific TRS configuration. Reusing a signature
 * collected for VAOS v2 (which signs raw canonical, no tag) is
 * impossible because the byte strings differ.
 *
 * @public
 */
export function trsSigningBytes(
  canonical: string,
  threshold: { m: number; n: number },
  authorizedIssuers: readonly string[],
): string {
  const sorted = [...authorizedIssuers].sort();
  return JSON.stringify({
    scheme: "trs1",
    canonical,
    m: threshold.m,
    n: threshold.n,
    authorizedIssuers: sorted,
  });
}

/**
 * Assemble a threshold envelope from a canonical projection + a set of
 * cosigner contributions. Does NOT verify signatures here — that's the
 * verifier's job. The assembler may be the issuer aggregator service,
 * or a regulator collecting cosignatures out-of-band.
 *
 * Throws on malformed inputs (negative m, m > n, duplicate issuerIds,
 * etc.) — these are programmer errors, not adversarial inputs.
 */
export function assembleThresholdAttestation(args: {
  canonical: string;
  threshold: { m: number; n: number };
  authorizedIssuers: string[];
  cosigners: ThresholdCosigner[];
  assembledAt?: string;
}): ThresholdAttestation {
  const { canonical, threshold, authorizedIssuers, cosigners } = args;

  if (!canonical || typeof canonical !== "string") {
    throw new Error("TRS: canonical must be a non-empty string");
  }
  if (
    !Number.isInteger(threshold.m) ||
    !Number.isInteger(threshold.n) ||
    threshold.m < 1 ||
    threshold.n < 1
  ) {
    throw new Error("TRS: threshold m and n must be positive integers");
  }
  if (threshold.m > threshold.n) {
    throw new Error("TRS: threshold m cannot exceed n");
  }
  if (authorizedIssuers.length !== threshold.n) {
    throw new Error(
      `TRS: authorizedIssuers length (${authorizedIssuers.length}) must equal threshold.n (${threshold.n})`,
    );
  }
  if (new Set(authorizedIssuers).size !== authorizedIssuers.length) {
    throw new Error("TRS: authorizedIssuers must be unique");
  }

  const seen = new Set<string>();
  for (const c of cosigners) {
    if (!c.issuerId) throw new Error("TRS: cosigner issuerId required");
    if (!c.signature) throw new Error("TRS: cosigner signature required");
    if (seen.has(c.issuerId)) {
      throw new Error(
        `TRS: duplicate cosigner issuerId "${c.issuerId}" — each issuer signs at most once`,
      );
    }
    seen.add(c.issuerId);
  }

  return {
    scheme: "trs1",
    canonical,
    contentHash: sha256Hex(canonical),
    threshold,
    authorizedIssuers,
    cosigners,
    assembledAt: args.assembledAt ?? new Date().toISOString(),
  };
}

/**
 * Verify a threshold attestation. Returns ok=true only when:
 *   - The envelope schema is intact (scheme === "trs1")
 *   - The quorum is satisfiable: m and n are integers, 1 <= m <= n, and
 *     authorizedIssuers has exactly n entries. These travel inside the
 *     envelope, so they are attacker-controlled and are checked first.
 *   - contentHash matches sha256(canonical)
 *   - Every cosigner in the cosigners list whose issuerId is in
 *     authorizedIssuers has a verifying signature
 *   - The count of valid, authorized, unique signatures ≥ threshold.m
 *
 * Cosigners with unknown issuerIds or invalid signatures are reported
 * in `rejected` but do NOT cause verification failure on their own —
 * verification fails only if the COUNT falls below m.
 *
 * Caller-supplied `verifyIssuerSignature` does the cryptographic work
 * + issuer-id → pubkey resolution. This module is verifier-side only.
 */
export async function verifyThresholdAttestation(
  attestation: ThresholdAttestation,
  opts: ThresholdVerifyOptions,
): Promise<ThresholdVerifyResult> {
  const rejected: ThresholdVerifyResult["rejected"] = [];

  if (attestation.scheme !== "trs1") {
    return {
      ok: false,
      reason: `unknown scheme "${attestation.scheme}"`,
      validSignatureCount: 0,
      required: 0,
      verifyingIssuers: [],
      rejected,
    };
  }

  // The quorum parameters are attacker-supplied: they travel inside the
  // envelope being checked. Without this gate an envelope declaring
  // `m: 0` verified with ZERO signatures — a threshold signature that
  // needs no signatures. Confirmed by execution before this was added:
  // m:0, m:"0", m:-5 and m:0/n:0 all returned ok:true on a payload
  // reading {"action":"transfer","amountCents":100000000}, and a missing
  // authorizedIssuers or cosigners array threw a TypeError out of a
  // function whose every other failure is a structured verdict.
  const { m, n } = attestation.threshold ?? ({} as { m: unknown; n: unknown });
  const badQuorum =
    !Number.isInteger(m) || (m as number) < 1
      ? `threshold.m must be an integer >= 1, got ${JSON.stringify(m)}`
      : !Number.isInteger(n) || (n as number) < 1
        ? `threshold.n must be an integer >= 1, got ${JSON.stringify(n)}`
        : (m as number) > (n as number)
          ? `threshold.m (${m}) exceeds threshold.n (${n}) — an unsatisfiable quorum`
          : !Array.isArray(attestation.authorizedIssuers)
            ? "authorizedIssuers must be an array"
            : attestation.authorizedIssuers.length !== (n as number)
              ? `authorizedIssuers has ${attestation.authorizedIssuers.length} entries but threshold.n is ${n}`
              : !Array.isArray(attestation.cosigners)
                ? "cosigners must be an array"
                : null;
  if (badQuorum !== null) {
    return {
      ok: false,
      reason: badQuorum,
      validSignatureCount: 0,
      required: Number.isInteger(m) ? (m as number) : 0,
      verifyingIssuers: [],
      rejected,
    };
  }

  const expectedHash = sha256Hex(attestation.canonical);
  if (expectedHash !== attestation.contentHash) {
    return {
      ok: false,
      reason: "contentHash mismatch with canonical bytes",
      validSignatureCount: 0,
      required: attestation.threshold.m,
      verifyingIssuers: [],
      rejected,
    };
  }

  const authorized = new Set(attestation.authorizedIssuers);
  const seen = new Set<string>();
  const verifying: string[] = [];

  // Bind the canonical bytes with the TRS configuration. Every
  // cosigner MUST have signed this same byte string — never the raw
  // canonical alone. This prevents reusing a VAOS v2 signature
  // (which signs raw canonical, no tag) as a TRS cosignature.
  const boundBytes = trsSigningBytes(
    attestation.canonical,
    attestation.threshold,
    attestation.authorizedIssuers,
  );

  for (const c of attestation.cosigners) {
    if (!authorized.has(c.issuerId)) {
      rejected.push({
        issuerId: c.issuerId,
        reason: "issuer not in authorizedIssuers",
      });
      continue;
    }
    if (seen.has(c.issuerId)) {
      rejected.push({
        issuerId: c.issuerId,
        reason: "duplicate cosigner (already counted)",
      });
      continue;
    }
    seen.add(c.issuerId);
    let ok = false;
    try {
      ok = await opts.verifyIssuerSignature(
        boundBytes,
        c.signature,
        c.issuerId,
      );
    } catch (err) {
      rejected.push({
        issuerId: c.issuerId,
        reason: `verifier threw: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }
    if (!ok) {
      rejected.push({
        issuerId: c.issuerId,
        reason: "signature did not verify",
      });
      continue;
    }
    verifying.push(c.issuerId);
  }

  // Canonical sort for stable audit ordering.
  verifying.sort();

  const ok = verifying.length >= attestation.threshold.m;
  return {
    ok,
    reason: ok
      ? undefined
      : `insufficient valid signatures (have ${verifying.length}, need ${attestation.threshold.m})`,
    validSignatureCount: verifying.length,
    required: attestation.threshold.m,
    verifyingIssuers: verifying,
    rejected,
  };
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
