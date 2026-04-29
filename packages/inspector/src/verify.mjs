/**
 * @sovereign/inspector — pure verification primitives.
 *
 * Zero-dependency port of src/lib/agent-delegation.ts to standalone
 * Node ESM. Distributed as an npm package so any third party can
 * verify Sovereign trust artifacts WITHOUT running the platform.
 *
 * The whole package is intentionally minimalist: node:crypto + a few
 * sha256 hashes + Ed25519 sign/verify. No DB, no HTTP, no auth.
 *
 * THE GUARANTEE: if these functions return `valid: true`, the
 * cryptographic claim is mathematically sound. The verifier doesn't
 * have to trust Sovereign Matrix or anyone else — only the math.
 *
 * USAGE:
 *   import { verifyDelegation, verifyAgentAction, verifyAuditChain } from "@sovereign/inspector/verify";
 *   const r = verifyDelegation({ delegation, userPublicKey });
 *   if (r.valid) console.log("authorized");
 */

import {
  sign,
  verify,
  createHash,
  createPublicKey,
  createPrivateKey,
} from "node:crypto";

// ── Encoding ────────────────────────────────────────────────────────

export function toBase64Url(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return buf.toString("base64url");
}

export function fromBase64Url(s) {
  if (typeof s !== "string" || s.length === 0) {
    throw new Error("Invalid base64url input");
  }
  return Buffer.from(s, "base64url");
}

// ── Key construction ────────────────────────────────────────────────

function buildPublicKeyObject(rawPubBase64Url) {
  const raw = fromBase64Url(rawPubBase64Url);
  if (raw.length !== 32) throw new Error("Invalid Ed25519 public key length");
  const prefix = Buffer.from("302a300506032b6570032100", "hex");
  const der = Buffer.concat([prefix, raw]);
  return createPublicKey({ key: der, format: "der", type: "spki" });
}

function buildPrivateKeyObject(rawPrivBase64Url) {
  const raw = fromBase64Url(rawPrivBase64Url);
  if (raw.length !== 32) throw new Error("Invalid Ed25519 private key length");
  const prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const der = Buffer.concat([prefix, raw]);
  return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

// ── Sign / verify ───────────────────────────────────────────────────

export function signMessage(privateKeyBase64Url, message) {
  const keyObj = buildPrivateKeyObject(privateKeyBase64Url);
  const sig = sign(null, Buffer.from(message, "utf8"), keyObj);
  return toBase64Url(sig);
}

export function verifySignature(publicKeyBase64Url, message, signatureBase64Url) {
  try {
    const keyObj = buildPublicKeyObject(publicKeyBase64Url);
    const sigBytes = fromBase64Url(signatureBase64Url);
    return verify(null, Buffer.from(message, "utf8"), keyObj, sigBytes);
  } catch {
    return false;
  }
}

// ── Canonical JSON ──────────────────────────────────────────────────

export function canonicalJsonStringify(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  if (typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return `[${v.map(canonicalJsonStringify).join(",")}]`;
  }
  if (typeof v === "object") {
    const keys = Object.keys(v).sort();
    const parts = keys.map(
      (k) => `${JSON.stringify(k)}:${canonicalJsonStringify(v[k])}`,
    );
    return `{${parts.join(",")}}`;
  }
  return "null";
}

// ── Message construction (must match server-side exactly) ──────────

export function buildDelegationMessage(c) {
  const scopeHash = createHash("sha256")
    .update(canonicalJsonStringify(c.scope))
    .digest("hex");
  return [
    "v1",
    `user:${c.userId}`,
    `agent:${c.agentName}`,
    `pubkey:${c.agentPublicKey}`,
    `scope:${scopeHash}`,
    `issued:${c.issuedAt}`,
    `expires:${c.expiresAt}`,
  ].join("\n");
}

export function buildRevocationMessage(input) {
  return [
    "v1",
    "revoke",
    `delegation:${input.delegationId}`,
    `reason:${input.reason}`,
    `issued:${input.issuedAt}`,
  ].join("\n");
}

export function buildActionDigest(input) {
  const payloadHash = createHash("sha256")
    .update(canonicalJsonStringify(input.payload))
    .digest("hex");
  const canonical = canonicalJsonStringify({
    action: input.action,
    agentName: input.agentName,
    timestampIso: input.timestampIso,
    payloadHash,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function computeChainHash(input) {
  const parts = [
    input.prevChainHash ?? "GENESIS",
    input.actionDigest,
    input.agentSignature,
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

// ── Verification (the public API) ───────────────────────────────────

export function verifyDelegation({ delegation, userPublicKey, now = new Date() }) {
  const expectedMessage = buildDelegationMessage({
    userId: delegation.userId,
    agentName: delegation.agentName,
    agentPublicKey: delegation.agentPublicKey,
    scope: delegation.scope,
    issuedAt: delegation.issuedAt,
    expiresAt: delegation.expiresAt,
  });
  if (delegation.delegationMessage !== expectedMessage) {
    return { valid: false, reason: "delegation_message_mismatch" };
  }
  if (
    !verifySignature(
      userPublicKey,
      delegation.delegationMessage,
      delegation.userSignature,
    )
  ) {
    return { valid: false, reason: "user_signature_invalid" };
  }
  if (now >= new Date(delegation.expiresAt)) {
    return { valid: false, reason: "delegation_expired" };
  }
  if (delegation.revokedAt) {
    if (!delegation.revocationMessage || !delegation.revocationSignature) {
      return { valid: false, reason: "revocation_signature_missing" };
    }
    if (
      !verifySignature(
        userPublicKey,
        delegation.revocationMessage,
        delegation.revocationSignature,
      )
    ) {
      return { valid: false, reason: "revocation_signature_invalid" };
    }
    return { valid: true, revoked: true };
  }
  return { valid: true, revoked: false };
}

export function verifyAgentAction(input) {
  const actionDigest = buildActionDigest({
    action: input.action,
    agentName: input.agentName,
    timestampIso: input.timestampIso,
    payload: input.payload,
  });
  if (!verifySignature(input.agentPublicKey, actionDigest, input.agentSignature)) {
    return { valid: false, reason: "agent_signature_invalid" };
  }
  const recomputedChain = computeChainHash({
    prevChainHash: input.prevChainHash,
    actionDigest,
    agentSignature: input.agentSignature,
  });
  if (recomputedChain !== input.expectedChainHash) {
    return { valid: false, reason: "chain_hash_mismatch" };
  }
  return { valid: true, recomputedDigest: actionDigest };
}

/**
 * Verify a SHA-256 audit chain (R26 audit_logs pattern).
 *
 * Each row: row_hash = sha256(prev_hash || userId || action || resource || details_canonical || createdAt_iso)
 * Genesis prev = "GENESIS" literal.
 *
 * Walks forward; on first mismatch, returns {brokenAt, expected, found}.
 */
export function verifyAuditChain(rows) {
  let prevHash = null;
  for (const row of rows) {
    const detailsCanonical = canonicalJsonStringify(row.details ?? {});
    const expected = createHash("sha256")
      .update(
        [
          prevHash ?? "GENESIS",
          row.userId,
          row.action,
          row.resource ?? "",
          detailsCanonical,
          row.createdAt,
        ].join("|"),
      )
      .digest("hex");
    if (expected !== row.rowHash) {
      return {
        valid: false,
        brokenAt: row.id,
        expected,
        found: row.rowHash,
      };
    }
    prevHash = row.rowHash;
  }
  return { valid: true, rowCount: rows.length };
}
