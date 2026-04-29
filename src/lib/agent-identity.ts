/**
 * AGENT IDENTITY MANIFESTS (KYA).
 *
 * Round 38 — closes the last major gap in the cryptographic agent-
 * trust stack. Each agent has a signed identity manifest declaring
 * ownership, capabilities, model provenance, code provenance, and
 * training-data declarations.
 *
 * See docs/adr/0006-agent-identity-manifests.md for full design.
 *
 * THE KYA TRUST CHAIN:
 *
 *   user (R34 user_signing_keys.public_key)
 *     ↓ signs manifest
 *   AgentIdentityManifest v1
 *     ↓ user signs new version (chain-linked to v1)
 *   AgentIdentityManifest v2
 *     ↓ revocation (signed by same user key)
 *   ✗ All future verifications fail
 *
 * Pure-function core. Same Ed25519 + canonical-JSON pattern as R34
 * CADC and R37 ACTs. Verifier code ports cleanly to
 * @sovereign/inspector for offline verification.
 */

import { createHash } from "node:crypto";
import {
  signMessage,
  verifySignature,
  canonicalJsonStringify,
} from "@/lib/agent-delegation";

// ── Types ──────────────────────────────────────────────────────────

export interface IdentityManifest {
  /** Spec version. */
  $schema: "sovereign-identity-manifest/v1";
  /** Stable identifier for this agent across versions. */
  id: string;
  name: string;
  /** Semver-style version string declared by the manifest itself. */
  version: string;
  /** Owner's userId (NOT email — public-safe). */
  owner: string;
  /** Base64URL Ed25519 public key (the user's CADC key). */
  ownerPublicKey: string;
  /** Free-form purpose declaration. */
  purpose: string;
  /** Capabilities this agent declares it can perform. */
  capabilities: string[];
  /** Model provenance (which models, prompt hash). */
  modelProvenance: {
    models: string[];
    promptHash: string;
  };
  /** Code provenance (repo, commit, build time). */
  codeProvenance?: {
    repository?: string;
    commitHash?: string;
    buildTimestamp?: string;
  };
  /** Free-form training-data declaration. */
  trainingDataDeclaration?: string;
  /** Chain hash of the previous manifest version, or null for first. */
  previousManifestHash: string | null;
  /** ISO 8601. */
  issuedAt: string;
  /** ISO 8601. */
  expiresAt: string;
}

export interface SignedManifest extends IdentityManifest {
  /** The exact canonical message that was signed. */
  manifestMessage: string;
  /** Base64URL Ed25519 signature over manifestMessage. */
  manifestSignature: string;
  /** sha256(prev_chain_hash || manifestMessage || manifestSignature). */
  chainHash: string;
  /** Optional revocation. */
  revokedAt?: string;
  revocationMessage?: string;
  revocationSignature?: string;
}

// ── Canonical message construction ─────────────────────────────────

/**
 * Build the canonical message string that gets signed.
 *
 * Format (line-separated, deterministic):
 *   v1
 *   id:{agentId}
 *   name:{name}
 *   version:{version}
 *   owner:{owner}
 *   ownerPublicKey:{key}
 *   purposeHash:{sha256-of-purpose}
 *   capabilitiesHash:{sha256-of-canonical-JSON-array}
 *   modelProvenanceHash:{sha256-of-canonical-JSON}
 *   codeProvenanceHash:{sha256-of-canonical-JSON, or "none"}
 *   trainingDataHash:{sha256-of-string, or "none"}
 *   previous:{previousManifestHash | "GENESIS"}
 *   issued:{issuedAt}
 *   expires:{expiresAt}
 *
 * Pure function. Hashing nested objects keeps the message at fixed shape.
 */
export function buildManifestMessage(m: IdentityManifest): string {
  const purposeHash = createHash("sha256").update(m.purpose).digest("hex");
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

/**
 * Compute the chain hash for a manifest row.
 * sha256(previousManifestHash || manifestMessage || manifestSignature)
 */
export function computeManifestChainHash(input: {
  previousManifestHash: string | null;
  manifestMessage: string;
  manifestSignature: string;
}): string {
  return createHash("sha256")
    .update(
      [
        input.previousManifestHash ?? "GENESIS",
        input.manifestMessage,
        input.manifestSignature,
      ].join("|"),
    )
    .digest("hex");
}

// ── Sign + revoke primitives ───────────────────────────────────────

/**
 * Sign an identity manifest. Pure function — composes the message,
 * signs with the owner's private key, computes the chain hash.
 *
 * The owner's public key is embedded in the manifest, so verifiers
 * don't need a separate lookup to verify the signature.
 */
export function signManifest(input: {
  manifest: IdentityManifest;
  ownerPrivateKey: string;
}): SignedManifest {
  const message = buildManifestMessage(input.manifest);
  const signature = signMessage(input.ownerPrivateKey, message);
  const chainHash = computeManifestChainHash({
    previousManifestHash: input.manifest.previousManifestHash,
    manifestMessage: message,
    manifestSignature: signature,
  });
  return {
    ...input.manifest,
    manifestMessage: message,
    manifestSignature: signature,
    chainHash,
  };
}

/**
 * Build a canonical revocation message. Owner signs this with the
 * SAME key that signed the original manifest.
 */
export function buildRevocationMessage(input: {
  manifestId: string;
  manifestVersion: string;
  reason: string;
  issuedAt: string;
}): string {
  return [
    "v1",
    "revoke-manifest",
    `manifest:${input.manifestId}`,
    `version:${input.manifestVersion}`,
    `reason:${input.reason}`,
    `issued:${input.issuedAt}`,
  ].join("\n");
}

// ── Verification (the public API) ───────────────────────────────────

/**
 * Verify an identity manifest. Returns granular reasons for failures.
 *
 * Pure function. Used both server-side and ported to
 * @sovereign/inspector for offline verification.
 *
 * Checks:
 *   1. manifestMessage matches canonical reconstruction
 *   2. manifestSignature is valid against ownerPublicKey
 *   3. chainHash matches recompute
 *   4. NOT expired (or expired check is conditional via opts.skipExpiryCheck)
 *   5. If revoked: revocation signature is valid (kill-switch fraud defense)
 */
export function verifyManifest(input: {
  manifest: SignedManifest;
  /** The expected owner public key. Must match manifest.ownerPublicKey. */
  expectedOwnerPublicKey: string;
  /** Optional clock for testability. */
  now?: Date;
  /** Optional: skip expiry check (e.g. for forensics on past manifests). */
  skipExpiryCheck?: boolean;
}):
  | { valid: true; revoked: boolean }
  | { valid: false; reason: string } {
  const m = input.manifest;
  const now = input.now ?? new Date();

  // 1. Verify the embedded owner pubkey matches expected.
  if (m.ownerPublicKey !== input.expectedOwnerPublicKey) {
    return { valid: false, reason: "owner_pubkey_mismatch" };
  }

  // 2. Reconstruct canonical message and compare.
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

  // 3. Verify the signature against the owner's pubkey.
  if (
    !verifySignature(
      m.ownerPublicKey,
      m.manifestMessage,
      m.manifestSignature,
    )
  ) {
    return { valid: false, reason: "signature_invalid" };
  }

  // 4. Recompute and verify chain hash.
  const expectedChainHash = computeManifestChainHash({
    previousManifestHash: m.previousManifestHash,
    manifestMessage: m.manifestMessage,
    manifestSignature: m.manifestSignature,
  });
  if (m.chainHash !== expectedChainHash) {
    return { valid: false, reason: "chain_hash_mismatch" };
  }

  // 5. Check expiry.
  if (!input.skipExpiryCheck && now >= new Date(m.expiresAt)) {
    return { valid: false, reason: "manifest_expired" };
  }

  // 6. If revoked: verify the revocation signature.
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

/**
 * Verify a complete manifest version chain (v1 → v2 → ... → vN).
 *
 * Each version's previousManifestHash must equal the previous row's
 * chainHash. Tampering with any past version breaks every subsequent
 * chain hash.
 *
 * Pure function. Returns the index of the first broken row.
 */
export function verifyManifestChain(input: {
  manifests: SignedManifest[];
  expectedOwnerPublicKey: string;
  now?: Date;
}):
  | { valid: true; activeManifest: SignedManifest | null }
  | { valid: false; reason: string; index: number } {
  if (input.manifests.length === 0) {
    return { valid: true, activeManifest: null };
  }
  let prevChainHash: string | null = null;
  let activeManifest: SignedManifest | null = null;

  for (let i = 0; i < input.manifests.length; i++) {
    const m = input.manifests[i];

    // Genesis manifests have prev = null; subsequent versions reference parent.
    if (i === 0) {
      if (m.previousManifestHash !== null) {
        return { valid: false, reason: "first_has_parent", index: 0 };
      }
    } else {
      if (m.previousManifestHash !== prevChainHash) {
        return { valid: false, reason: "previous_hash_mismatch", index: i };
      }
    }

    const result = verifyManifest({
      manifest: m,
      expectedOwnerPublicKey: input.expectedOwnerPublicKey,
      now: input.now,
      // For chain verification, allow expired versions (we want the
      // historical chain to be verifiable; the LATEST version's expiry
      // is what matters for "is this manifest currently valid?").
      skipExpiryCheck: i < input.manifests.length - 1,
    });
    if (!result.valid) {
      return { valid: false, reason: result.reason, index: i };
    }

    prevChainHash = m.chainHash;
    if (!result.revoked) {
      activeManifest = m;
    }
  }

  return { valid: true, activeManifest };
}
