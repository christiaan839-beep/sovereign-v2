/**
 * CRYPTOGRAPHIC AGENT DELEGATION CHAIN (CADC).
 *
 * Round 34 — the trust primitive nobody has shipped.
 *
 * Every agent action is cryptographically signed. A third party can
 * verify ANY action without trusting the platform — they fetch the
 * public key, the signature, and the chained audit hash, and verify
 * locally. SOVEREIGN servers cannot lie about what was authorized.
 *
 * THE TRUST CHAIN:
 *
 *   user_signing_keys.public_key
 *     ↓ user signs delegation_message
 *   agent_delegations.user_signature
 *     ↓ embeds agent_public_key
 *   agent's private key signs each action_digest
 *   agent_action_signatures.agent_signature
 *     ↓ chained via sha256
 *   agent_action_signatures.chain_hash
 *
 * VERIFICATION (any third party can do this):
 *   1. Fetch user public key (public)
 *   2. Recompute delegation_message from {userId, agentName, agentPubKey, scope, expiry}
 *   3. ed25519_verify(user_signature, delegation_message, user_pubkey) → true
 *   4. Fetch the action's expected digest
 *   5. ed25519_verify(agent_signature, action_digest, agent_pubkey) → true
 *   6. Recompute chain_hash from prev_hash + action_digest + agent_signature
 *   7. Confirm matches stored chain_hash
 *   8. Confirm delegation.revoked_at is null OR revocation_signature is also valid
 *
 * If ALL checks pass, you have cryptographic proof:
 *   - The user authorized this agent to act
 *   - The agent (using its delegated key) actually performed this action
 *   - The action wasn't tampered with afterward
 *
 * No trust in Sovereign required. The cryptography is the truth.
 *
 * IMPLEMENTATION NOTES:
 *   - Ed25519: 32-byte private key, 32-byte public key, 64-byte signatures
 *   - Encoding: base64url (URL-safe, no padding) throughout
 *   - All node:crypto, no external deps
 *   - Pure functions where possible (sign/verify are pure given keys)
 */

import {
  generateKeyPairSync,
  sign,
  verify,
  createHash,
  createPublicKey,
  createPrivateKey,
} from "node:crypto";
import type { KeyObject } from "node:crypto";

// ── Types ──────────────────────────────────────────────────────────

export interface KeyPair {
  /** Base64URL-encoded raw 32-byte Ed25519 public key. */
  publicKey: string;
  /** Base64URL-encoded raw 32-byte Ed25519 private key. */
  privateKey: string;
}

export interface DelegationContents {
  userId: string;
  agentName: string;
  /** Base64URL-encoded public key the user delegates TO. */
  agentPublicKey: string;
  /** Free-form JSON scope. Object → SHA-256 digest in the message. */
  scope: Record<string, unknown>;
  /** ISO 8601 timestamp. */
  issuedAt: string;
  /** ISO 8601 timestamp. */
  expiresAt: string;
}

export interface DelegationRecord extends DelegationContents {
  /** Base64URL Ed25519 signature over the delegation message. */
  userSignature: string;
  /** The exact message string the signature applies to. */
  delegationMessage: string;
  /** Optional revocation (kill-switch). When present, both must verify. */
  revocationMessage?: string;
  revocationSignature?: string;
  revokedAt?: string;
}

// ── Encoding helpers ───────────────────────────────────────────────

/**
 * Encode bytes to base64url (RFC 4648). URL-safe, no padding.
 * Pure function. `Buffer.from(...).toString("base64url")` does the work.
 */
export function toBase64Url(bytes: Uint8Array | Buffer): string {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return buf.toString("base64url");
}

/**
 * Decode base64url to bytes. Throws on invalid input — caller should
 * wrap in try/catch when validating untrusted user-supplied strings.
 */
export function fromBase64Url(s: string): Buffer {
  if (typeof s !== "string" || s.length === 0) {
    throw new Error("Invalid base64url input");
  }
  // base64url is base64 with `-`/`_` instead of `+`/`/`, no padding.
  // Buffer's "base64url" parser handles this.
  return Buffer.from(s, "base64url");
}

// ── Key generation ─────────────────────────────────────────────────

/**
 * Generate a fresh Ed25519 keypair. Returns base64url-encoded raw keys.
 *
 * SECURITY: the private key is sensitive. Caller is responsible for
 * storing it securely (HSM, hardware key, encrypted-at-rest). The
 * platform NEVER stores user private keys.
 */
export function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  // Export as raw 32-byte values via DER-stripping.
  const pub = publicKey.export({ format: "der", type: "spki" });
  const priv = privateKey.export({ format: "der", type: "pkcs8" });
  // The last 32 bytes of the SPKI/PKCS8 DER for Ed25519 are the raw key.
  // Standard offset trick — verified against RFC 8410.
  const rawPub = pub.subarray(pub.length - 32);
  const rawPriv = priv.subarray(priv.length - 32);
  return {
    publicKey: toBase64Url(rawPub),
    privateKey: toBase64Url(rawPriv),
  };
}

// ── Sign / verify primitives ───────────────────────────────────────

/**
 * Build a KeyObject from a raw 32-byte Ed25519 public key.
 *
 * node:crypto requires DER-wrapped keys. We prepend the standard
 * SPKI envelope for Ed25519 (RFC 8410) to the raw bytes.
 */
function buildPublicKeyObject(rawPubBase64Url: string): KeyObject {
  const raw = fromBase64Url(rawPubBase64Url);
  if (raw.length !== 32) throw new Error("Invalid Ed25519 public key length");
  // Ed25519 SPKI prefix: 0x302a300506032b6570032100 (12 bytes), then 32 raw.
  const prefix = Buffer.from("302a300506032b6570032100", "hex");
  const der = Buffer.concat([prefix, raw]);
  return createPublicKey({ key: der, format: "der", type: "spki" });
}

/**
 * Build a KeyObject from a raw 32-byte Ed25519 private key.
 */
function buildPrivateKeyObject(rawPrivBase64Url: string): KeyObject {
  const raw = fromBase64Url(rawPrivBase64Url);
  if (raw.length !== 32) throw new Error("Invalid Ed25519 private key length");
  // Ed25519 PKCS8 prefix: 0x302e020100300506032b657004220420 (16 bytes), then 32 raw.
  const prefix = Buffer.from("302e020100300506032b657004220420", "hex");
  const der = Buffer.concat([prefix, raw]);
  return createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

/**
 * Sign a message with the user's private key. Returns base64url
 * signature.
 *
 * Pure given the key + message. NEVER throws on valid inputs.
 */
export function signMessage(
  privateKeyBase64Url: string,
  message: string,
): string {
  const keyObj = buildPrivateKeyObject(privateKeyBase64Url);
  // Ed25519 sign: pass null algorithm (the key encodes the algorithm).
  const sig = sign(null, Buffer.from(message, "utf8"), keyObj);
  return toBase64Url(sig);
}

/**
 * Verify a signature against a message + public key.
 *
 * Pure function. Returns true iff the signature is cryptographically
 * valid. NEVER throws — invalid inputs return false (defensive).
 */
export function verifySignature(
  publicKeyBase64Url: string,
  message: string,
  signatureBase64Url: string,
): boolean {
  try {
    const keyObj = buildPublicKeyObject(publicKeyBase64Url);
    const sigBytes = fromBase64Url(signatureBase64Url);
    return verify(null, Buffer.from(message, "utf8"), keyObj, sigBytes);
  } catch {
    return false;
  }
}

// ── Delegation message construction ────────────────────────────────

/**
 * Produce the canonical delegation message string. Verifiers
 * reconstruct this from the same inputs to compare against the
 * stored delegationMessage.
 *
 * Format (line-separated, deterministic):
 *   v1
 *   user:{userId}
 *   agent:{agentName}
 *   pubkey:{agentPublicKey}
 *   scope:{sha256-hex of canonical-JSON-stringified scope}
 *   issued:{issuedAt}
 *   expires:{expiresAt}
 *
 * Pure function. The scope is digested (not embedded) so the message
 * stays a fixed shape regardless of scope size.
 */
export function buildDelegationMessage(c: DelegationContents): string {
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

/**
 * Canonical JSON stringification for stable hashing. Object keys
 * sorted; null/undefined normalized; arrays preserved in order.
 *
 * Pure. Required because JSON.stringify({a:1,b:2}) and
 * JSON.stringify({b:2,a:1}) produce different strings → different
 * hashes → broken signatures.
 */
export function canonicalJsonStringify(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  if (typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    return `[${v.map(canonicalJsonStringify).join(",")}]`;
  }
  if (typeof v === "object") {
    const keys = Object.keys(v as Record<string, unknown>).sort();
    const parts = keys.map(
      (k) =>
        `${JSON.stringify(k)}:${canonicalJsonStringify(
          (v as Record<string, unknown>)[k],
        )}`,
    );
    return `{${parts.join(",")}}`;
  }
  return "null";
}

// ── Revocation message ─────────────────────────────────────────────

/**
 * Build a revocation message. This is what the user signs with the
 * SAME signing key that issued the delegation, to prove they're the
 * authorized killer.
 *
 *   v1
 *   revoke
 *   delegation:{delegationId}
 *   reason:{free-form, may be empty}
 *   issued:{iso8601}
 */
export function buildRevocationMessage(input: {
  delegationId: string;
  reason: string;
  issuedAt: string;
}): string {
  return [
    "v1",
    "revoke",
    `delegation:${input.delegationId}`,
    `reason:${input.reason}`,
    `issued:${input.issuedAt}`,
  ].join("\n");
}

// ── Action digest + chain hash ─────────────────────────────────────

/**
 * Compute the digest of an agent action. The digest is what the
 * agent's private key signs. Verifiers reconstruct from the same
 * inputs.
 *
 * Format (canonical JSON of input, hashed):
 *   {action, agentName, timestampIso, payloadHash}
 */
export function buildActionDigest(input: {
  action: string;
  agentName: string;
  timestampIso: string;
  /** Free-form JSON payload (e.g. tool call args). */
  payload: unknown;
}): string {
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

/**
 * Compute the chain hash for an action signature row.
 * chain_hash = sha256(prev_chain_hash || action_digest || agent_signature)
 *
 * Genesis (first row) uses literal "GENESIS" as prev. Tampering with
 * any past row breaks every subsequent chain_hash.
 */
export function computeChainHash(input: {
  prevChainHash: string | null;
  actionDigest: string;
  agentSignature: string;
}): string {
  const parts = [
    input.prevChainHash ?? "GENESIS",
    input.actionDigest,
    input.agentSignature,
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

// ── Top-level verification ─────────────────────────────────────────

/**
 * Verify a complete delegation record. Returns granular reasons for
 * any failure so the caller can surface specific problems.
 *
 * Pure function — only depends on the record + the user's public key
 * (which is also stored on-chain and verifiable independently).
 */
export function verifyDelegation(input: {
  delegation: DelegationRecord;
  userPublicKey: string;
  /** Optional: clock for time-based checks. Pure-function testability. */
  now?: Date;
}):
  | { valid: true; revoked: boolean }
  | { valid: false; reason: string } {
  const { delegation, userPublicKey } = input;
  const now = input.now ?? new Date();

  // 1. Verify the delegation message matches the stored canonical form.
  const expectedMessage = buildDelegationMessage({
    userId: delegation.userId,
    agentName: delegation.agentName,
    agentPublicKey: delegation.agentPublicKey,
    scope: delegation.scope,
    issuedAt: delegation.issuedAt,
    expiresAt: delegation.expiresAt,
  });
  if (delegation.delegationMessage !== expectedMessage) {
    return {
      valid: false,
      reason: "delegation_message_mismatch",
    };
  }

  // 2. Verify the user's signature on the delegation message.
  if (
    !verifySignature(
      userPublicKey,
      delegation.delegationMessage,
      delegation.userSignature,
    )
  ) {
    return { valid: false, reason: "user_signature_invalid" };
  }

  // 3. Check expiry.
  if (now >= new Date(delegation.expiresAt)) {
    return { valid: false, reason: "delegation_expired" };
  }

  // 4. If revoked, verify the revocation signature.
  if (delegation.revokedAt) {
    if (!delegation.revocationMessage || !delegation.revocationSignature) {
      return {
        valid: false,
        reason: "revocation_signature_missing",
      };
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

/**
 * Verify a single agent action signature.
 *
 * The verifier has:
 *   - The action's reconstructable inputs (action, agentName, timestamp, payload)
 *   - The agent_signature
 *   - The agent's public key (from the delegation)
 *   - The expected chain_hash
 *   - The previous row's chain_hash (or null for genesis)
 *
 * Returns granular failure reasons.
 */
export function verifyAgentAction(input: {
  action: string;
  agentName: string;
  timestampIso: string;
  payload: unknown;
  agentSignature: string;
  agentPublicKey: string;
  expectedChainHash: string;
  prevChainHash: string | null;
}):
  | { valid: true; recomputedDigest: string }
  | { valid: false; reason: string } {
  // 1. Recompute the action digest.
  const actionDigest = buildActionDigest({
    action: input.action,
    agentName: input.agentName,
    timestampIso: input.timestampIso,
    payload: input.payload,
  });

  // 2. Verify the agent's signature on the digest.
  if (!verifySignature(input.agentPublicKey, actionDigest, input.agentSignature)) {
    return { valid: false, reason: "agent_signature_invalid" };
  }

  // 3. Recompute the chain hash.
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
