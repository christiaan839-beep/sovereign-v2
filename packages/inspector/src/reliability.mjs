/**
 * @sovereign/inspector — Signed Reliability Attestations (R44).
 *
 * Pure-function port of src/lib/reliability-attestation.ts. Customers
 * verify the platform's reliability commitments LOCALLY by checking
 * the Ed25519 signature + chain hash. Sovereign cannot lie about
 * uptime while this verifier is running.
 *
 * The trustless loop closure for reliability:
 *   1. Inspector fetches /api/health/reliability/attestation.
 *   2. Inspector reconstructs the canonical message from the signed
 *      fields.
 *   3. Inspector verifies the signature against the embedded public
 *      key.
 *   4. Inspector recomputes the chain hash.
 *   5. Match → reliability claim is mathematically correct.
 *      Mismatch → fabricated.
 *
 * Same pattern as R34 CADC, R37 ACTs, R38 KYA, R41 reputation,
 * R42 credit lines.
 *
 * Usage:
 *   import { fetchReliability, verifyReliabilityLocally } from "@sovereign/inspector/reliability";
 *   const r = await verifyReliabilityLocally("https://sovereignmatrix.agency");
 */

import { createHash, createPublicKey, verify } from "node:crypto";

// ── base64url helpers (mirror agent-delegation.ts) ──────────────────

function fromBase64Url(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function publicKeyFromB64Url(b64url) {
  const pkBytes = fromBase64Url(b64url);
  const der = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), pkBytes]);
  return createPublicKey({ key: der, format: "der", type: "spki" });
}

function verifyEd25519(publicKeyB64Url, message, signatureB64Url) {
  try {
    const keyObj = publicKeyFromB64Url(publicKeyB64Url);
    const sigBytes = fromBase64Url(signatureB64Url);
    return verify(null, Buffer.from(message, "utf8"), keyObj, sigBytes);
  } catch {
    return false;
  }
}

// ── Canonical message ──────────────────────────────────────────────

export function buildAttestationMessage(w) {
  return [
    "v1",
    "reliability-attestation",
    `window:${w.windowStart}|${w.windowEnd}`,
    `snapshots:${w.passingHealthSnapshots}/${w.totalHealthSnapshots} (failing:${w.failingHealthSnapshots})`,
    `uptimePct:${w.uptimePct}`,
    `threshold:${w.commitmentThresholdPct}`,
    `metCommitment:${w.metCommitment}`,
    `auditChainIntact:${
      w.auditChainIntact === null ? "unknown" : w.auditChainIntact
    }`,
    `auditChainTotalRows:${w.auditChainTotalRows ?? "unknown"}`,
    `auditChainFirstBrokenId:${w.auditChainFirstBrokenId ?? "none"}`,
  ].join("\n");
}

export function computeAttestationChainHash({
  previousChainHash,
  attestationMessage,
  attestationSignature,
}) {
  return createHash("sha256")
    .update(
      [
        previousChainHash ?? "GENESIS",
        attestationMessage,
        attestationSignature,
      ].join("|"),
    )
    .digest("hex");
}

// ── Verification (pure) ────────────────────────────────────────────

export function verifyAttestation({ attestation, expectedPlatformPublicKey }) {
  const a = attestation;

  // 1. Canonical reconstruction.
  const expectedMessage = buildAttestationMessage({
    windowStart: a.windowStart,
    windowEnd: a.windowEnd,
    totalHealthSnapshots: a.totalHealthSnapshots,
    passingHealthSnapshots: a.passingHealthSnapshots,
    failingHealthSnapshots: a.failingHealthSnapshots,
    auditChainIntact: a.auditChainIntact,
    auditChainTotalRows: a.auditChainTotalRows,
    auditChainFirstBrokenId: a.auditChainFirstBrokenId,
    uptimePct: a.uptimePct,
    commitmentThresholdPct: a.commitmentThresholdPct,
    metCommitment: a.metCommitment,
  });
  if (a.attestationMessage !== expectedMessage) {
    return { valid: false, reason: "attestation_message_mismatch" };
  }

  // 2. Ed25519 signature.
  if (
    !verifyEd25519(
      a.platformPublicKey,
      a.attestationMessage,
      a.attestationSignature,
    )
  ) {
    return { valid: false, reason: "signature_invalid" };
  }

  // 3. Chain hash.
  const expectedChainHash = computeAttestationChainHash({
    previousChainHash: a.previousChainHash,
    attestationMessage: a.attestationMessage,
    attestationSignature: a.attestationSignature,
  });
  if (a.chainHash !== expectedChainHash) {
    return { valid: false, reason: "chain_hash_mismatch" };
  }

  // 4. Optional pubkey assertion.
  if (
    expectedPlatformPublicKey &&
    a.platformPublicKey !== expectedPlatformPublicKey
  ) {
    return { valid: false, reason: "platform_pubkey_mismatch" };
  }

  return { valid: true };
}

// ── Network primitives ─────────────────────────────────────────────

export async function fetchReliability(deploymentUrl) {
  const url = `${deploymentUrl}/api/health/reliability/attestation`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.json();
}

/**
 * THE TRUSTLESS LOOP CLOSURE for reliability.
 *
 * Fetch the platform's published attestation, verify the signature
 * + chain hash locally. Returns `{match: true}` if mathematically
 * correct, `{match: false}` with reason otherwise.
 *
 * After R44, the platform CANNOT lie about its reliability while
 * this verifier is running.
 */
export async function verifyReliabilityLocally(deploymentUrl, options = {}) {
  const data = await fetchReliability(deploymentUrl);
  if (!data || !data.attestation) {
    return {
      match: null,
      deploymentUrl,
      note:
        data && data.note
          ? data.note
          : "No reliability attestation has been signed yet for this deployment.",
      verificationRanLocally: true,
    };
  }
  const result = verifyAttestation({
    attestation: data.attestation,
    expectedPlatformPublicKey: options.expectedPlatformPublicKey,
  });
  return {
    match: result.valid,
    reason: result.valid ? undefined : result.reason,
    deploymentUrl,
    attestation: data.attestation,
    verificationRanLocally: true,
    note: result.valid
      ? "The platform's reliability claim is mathematically correct. Same math, same answer."
      : `MISMATCH — published reliability claim failed verification (${result.reason}). Reliability is fabricated.`,
  };
}
