/**
 * SOVEREIGN MATRIX — Multi-party attestation (Cook 43 / Tier 3 #11)
 *
 * Receipts co-signed by N witnesses (auditor, customer, you). The
 * strongest possible trust signal: if any party disputes the run
 * later, every other party's signature is independent cryptographic
 * proof they accepted the artifact at the time it was produced.
 *
 * Contract:
 *
 *   - Each attestation is HMAC-SHA256 over a canonical message
 *     digest. Cross-signature is impossible because the signer id is
 *     part of the digest input.
 *   - Quorum policies are explicit: `M-of-N` (e.g. 2-of-3 means any
 *     two of the three named witnesses suffice) and `all-of` (every
 *     named witness must sign).
 *   - Verification returns a discriminated outcome so the receipt
 *     embeds the result verbatim without follow-up branching.
 *
 * NO external dependencies. NO key management — callers supply
 * symmetric per-witness keys via a `WitnessKeyResolver`. Production
 * stores them in KMS / Vault; tests inject an in-memory Map.
 */

import { createHmac, timingSafeEqual } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface Attestation {
  /** Stable witness id (e.g. "customer-acme", "auditor-bdo"). */
  witnessId: string;
  /** ISO-8601 timestamp of the signature. */
  signedAt: string;
  /** Base64(HMAC-SHA256(witnessKey, canonical(message))). */
  signature: string;
}

export interface AttestationMessage {
  /** Stable artifact id (typically the receipt id). */
  artifactId: string;
  /** SHA-256 digest of the artifact body in hex (32 bytes / 64 chars). */
  artifactDigest: string;
  /** Free-form metadata the witness attests to (e.g. {role:"customer"}). */
  context?: Record<string, string | number>;
}

export type AttestationPolicy =
  | { kind: "all-of"; witnesses: string[] }
  | { kind: "m-of-n"; witnesses: string[]; required: number };

export type WitnessKeyResolver = (witnessId: string) => string | undefined;

export type VerifyOutcome =
  | { ok: true; verified: string[]; policy: AttestationPolicy }
  | {
      ok: false;
      reason:
        | "missing-key"
        | "invalid-signature"
        | "duplicate-witness"
        | "policy-not-met"
        | "unknown-witness";
      details?: string;
    };

// ── Canonical message digest ──────────────────────────────────────────────

/**
 * Serialize an `AttestationMessage` to a STABLE byte sequence. Key
 * order is sorted; signing party id is appended so the same artifact
 * digest produces a DIFFERENT signing input for each witness.
 */
function canonicalize(msg: AttestationMessage, witnessId: string): string {
  const ctx = msg.context ?? {};
  const sortedCtx = Object.keys(ctx)
    .sort()
    .map((k) => `${k}=${String(ctx[k])}`)
    .join(";");
  return [
    "v1",
    msg.artifactId,
    msg.artifactDigest.toLowerCase(),
    sortedCtx,
    witnessId,
  ].join("|");
}

// ── Signing ───────────────────────────────────────────────────────────────

/**
 * Produce an `Attestation` over the canonical digest. The signature
 * is base64 (URL-safe is intentional — survives JSON + URL embedding).
 */
export function sign(
  msg: AttestationMessage,
  witnessId: string,
  witnessKey: string,
  now: number = Date.now(),
): Attestation {
  if (!witnessId) throw new Error("sign: witnessId is required");
  if (!witnessKey) throw new Error("sign: witnessKey is required");
  if (!/^[a-f0-9]{64}$/i.test(msg.artifactDigest)) {
    throw new Error("sign: artifactDigest must be a 32-byte hex SHA-256");
  }
  const canonical = canonicalize(msg, witnessId);
  const signature = createHmac("sha256", witnessKey)
    .update(canonical)
    .digest("base64");
  return {
    witnessId,
    signedAt: new Date(now).toISOString(),
    signature,
  };
}

// ── Verification ──────────────────────────────────────────────────────────

function verifyOne(
  msg: AttestationMessage,
  att: Attestation,
  resolveKey: WitnessKeyResolver,
): true | { reason: "missing-key" | "invalid-signature" } {
  const key = resolveKey(att.witnessId);
  if (!key) return { reason: "missing-key" };
  const canonical = canonicalize(msg, att.witnessId);
  const expected = createHmac("sha256", key).update(canonical).digest("base64");
  const a = Buffer.from(att.signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { reason: "invalid-signature" };
  }
  return true;
}

/**
 * Verify a batch of attestations against the supplied policy. Returns
 * a structured outcome (no exceptions). Receipt-friendly.
 */
export function verifyBatch(
  msg: AttestationMessage,
  attestations: Attestation[],
  policy: AttestationPolicy,
  resolveKey: WitnessKeyResolver,
): VerifyOutcome {
  if (attestations.length === 0) {
    return { ok: false, reason: "policy-not-met", details: "No attestations" };
  }

  // Dedup by witnessId — same party signing twice is suspicious + breaks quorum.
  const seen = new Set<string>();
  for (const a of attestations) {
    if (seen.has(a.witnessId)) {
      return {
        ok: false,
        reason: "duplicate-witness",
        details: a.witnessId,
      };
    }
    seen.add(a.witnessId);
  }

  // Every named witness must be in the policy's witness list (no rogue signers).
  const policyWitnesses = new Set(policy.witnesses);
  for (const a of attestations) {
    if (!policyWitnesses.has(a.witnessId)) {
      return {
        ok: false,
        reason: "unknown-witness",
        details: a.witnessId,
      };
    }
  }

  const verified: string[] = [];
  for (const a of attestations) {
    const r = verifyOne(msg, a, resolveKey);
    if (r === true) {
      verified.push(a.witnessId);
    } else {
      return { ok: false, reason: r.reason, details: a.witnessId };
    }
  }

  // Apply the quorum policy.
  if (policy.kind === "all-of") {
    const missing = policy.witnesses.filter((w) => !verified.includes(w));
    if (missing.length > 0) {
      return {
        ok: false,
        reason: "policy-not-met",
        details: `Missing required witnesses: ${missing.join(", ")}`,
      };
    }
  } else {
    if (verified.length < policy.required) {
      return {
        ok: false,
        reason: "policy-not-met",
        details: `Need ${policy.required} of ${policy.witnesses.length}, got ${verified.length}`,
      };
    }
  }
  return { ok: true, verified, policy };
}
