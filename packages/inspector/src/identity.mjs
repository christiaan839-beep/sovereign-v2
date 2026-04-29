/**
 * @sovereign/inspector — Agent Identity Manifest verification.
 *
 * Pure-function port of src/lib/agent-identity.ts to standalone
 * Node ESM. Customers fetch manifests from any Sovereign deployment
 * and verify them LOCALLY on their machine — Sovereign is not a
 * required trust anchor.
 */

import { createHash } from "node:crypto";
import {
  verifySignature,
  canonicalJsonStringify,
} from "./verify.mjs";

export function buildManifestMessage(m) {
  const purposeHash = createHash("sha256").update(m.purpose ?? "").digest("hex");
  const capabilitiesHash = createHash("sha256")
    .update(canonicalJsonStringify(m.capabilities))
    .digest("hex");
  const modelProvenanceHash = createHash("sha256")
    .update(canonicalJsonStringify(m.modelProvenance))
    .digest("hex");
  const codeProvenanceHash = m.codeProvenance
    ? createHash("sha256")
        .update(canonicalJsonStringify(m.codeProvenance))
        .digest("hex")
    : "none";
  const trainingDataHash = m.trainingDataDeclaration
    ? createHash("sha256").update(m.trainingDataDeclaration).digest("hex")
    : "none";
  return [
    "v1",
    `id:${m.id}`,
    `name:${m.name}`,
    `version:${m.version}`,
    `owner:${m.owner}`,
    `ownerPublicKey:${m.ownerPublicKey}`,
    `purposeHash:${purposeHash}`,
    `capabilitiesHash:${capabilitiesHash}`,
    `modelProvenanceHash:${modelProvenanceHash}`,
    `codeProvenanceHash:${codeProvenanceHash}`,
    `trainingDataHash:${trainingDataHash}`,
    `previous:${m.previousManifestHash ?? "GENESIS"}`,
    `issued:${m.issuedAt}`,
    `expires:${m.expiresAt}`,
  ].join("\n");
}

export function computeManifestChainHash({
  previousManifestHash,
  manifestMessage,
  manifestSignature,
}) {
  return createHash("sha256")
    .update(
      [
        previousManifestHash ?? "GENESIS",
        manifestMessage,
        manifestSignature,
      ].join("|"),
    )
    .digest("hex");
}

export function verifyManifest({
  manifest,
  expectedOwnerPublicKey,
  now = new Date(),
  skipExpiryCheck = false,
}) {
  const m = manifest;
  if (m.ownerPublicKey !== expectedOwnerPublicKey) {
    return { valid: false, reason: "owner_pubkey_mismatch" };
  }
  const expectedMessage = buildManifestMessage({
    $schema: m.$schema,
    id: m.id,
    name: m.name,
    version: m.version,
    owner: m.owner,
    ownerPublicKey: m.ownerPublicKey,
    purpose: m.purpose,
    capabilities: m.capabilities,
    modelProvenance: m.modelProvenance,
    codeProvenance: m.codeProvenance,
    trainingDataDeclaration: m.trainingDataDeclaration,
    previousManifestHash: m.previousManifestHash,
    issuedAt: m.issuedAt,
    expiresAt: m.expiresAt,
  });
  if (m.manifestMessage !== expectedMessage) {
    return { valid: false, reason: "manifest_message_mismatch" };
  }
  if (
    !verifySignature(
      m.ownerPublicKey,
      m.manifestMessage,
      m.manifestSignature,
    )
  ) {
    return { valid: false, reason: "signature_invalid" };
  }
  const expectedChainHash = computeManifestChainHash({
    previousManifestHash: m.previousManifestHash,
    manifestMessage: m.manifestMessage,
    manifestSignature: m.manifestSignature,
  });
  if (m.chainHash !== expectedChainHash) {
    return { valid: false, reason: "chain_hash_mismatch" };
  }
  if (!skipExpiryCheck && now >= new Date(m.expiresAt)) {
    return { valid: false, reason: "manifest_expired" };
  }
  if (m.revokedAt) {
    if (!m.revocationMessage || !m.revocationSignature) {
      return { valid: false, reason: "revocation_signature_missing" };
    }
    if (
      !verifySignature(
        m.ownerPublicKey,
        m.revocationMessage,
        m.revocationSignature,
      )
    ) {
      return { valid: false, reason: "revocation_signature_invalid" };
    }
    return { valid: true, revoked: true };
  }
  return { valid: true, revoked: false };
}

export async function fetchAgentManifest(deploymentUrl, agentId) {
  const url = `${deploymentUrl}/api/identity/manifests/${encodeURIComponent(agentId)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.json();
}

export async function fetchRegistry(deploymentUrl, opts = {}) {
  const limit = opts.limit ?? 20;
  const cursor = opts.cursor ? `&cursor=${encodeURIComponent(opts.cursor)}` : "";
  const url = `${deploymentUrl}/api/identity/registry?limit=${limit}${cursor}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.json();
}
