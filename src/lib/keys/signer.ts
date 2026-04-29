/**
 * KMS-ABSTRACTED SIGNER INTERFACE (R54).
 *
 * Production-grade key management. The platform's master signing
 * key (used for R44 signed reliability attestations + R45 audit
 * batch signatures) currently lives as a base64url string in env
 * vars. That works for dev + staging but fails enterprise
 * procurement: SOC 2 reviewers and HIPAA auditors expect master
 * keys to live in a KMS (AWS KMS, GCP Cloud KMS, Azure Key Vault)
 * or an HSM (CloudHSM, Thales Luna).
 *
 * R54 adds the abstraction so swapping in a KMS is a config-only
 * change. The verifier doesn't change. The canonical message
 * format doesn't change. Only the SIGN call routes through the
 * configured signer.
 *
 * THE INTERFACE:
 *
 *   interface Signer {
 *     getPublicKey(): Promise<string>      // base64url Ed25519 pubkey
 *     sign(message: string): Promise<string>  // base64url signature
 *     describe(): SignerDescription        // for diagnostics
 *   }
 *
 * IMPLEMENTATIONS shipped in v1:
 *
 *   - LocalEnvSigner: reads from SOVEREIGN_PLATFORM_PRIVATE_KEY +
 *     SOVEREIGN_PLATFORM_PUBLIC_KEY env vars (the current path).
 *   - StubKmsSigner: interface skeleton + structural test for the
 *     AWS KMS / GCP KMS / Azure Key Vault adapters operators write
 *     against this contract. Throws on actual sign() calls so the
 *     contract is testable without pulling in cloud SDKs.
 *
 * Future implementations (operator-built or future round):
 *   - AwsKmsSigner (uses @aws-sdk/client-kms)
 *   - GcpKmsSigner (uses @google-cloud/kms)
 *   - AzureKeyVaultSigner (uses @azure/keyvault-keys)
 *   - ThresholdSigner (k-of-n across multiple HSMs)
 *
 * THE TRUSTLESS PROPERTY:
 *
 * Whichever Signer is configured, the OUTPUT is unchanged: a
 * base64url Ed25519 signature over the canonical message. The
 * inspector verifier doesn't need to know whether AWS KMS or a
 * local key was used — it just verifies the signature against
 * the public key. The platform's choice of key infrastructure is
 * an operational concern, not a trust-model concern.
 *
 * Pure-function design where possible: `selectSigner` is pure;
 * the concrete implementations are necessarily stateful (they
 * hold credentials / KMS clients) but the interface boundary
 * keeps the rest of the trust stack pure.
 */

import {
  signMessage as localSignMessage,
  generateKeyPair,
} from "@/lib/agent-delegation";

// ── The interface ─────────────────────────────────────────────────

export interface SignerDescription {
  /** Stable identifier — "local-env", "aws-kms", "gcp-kms", etc. */
  type: string;
  /** Human-readable description for /reliability + ops dashboards. */
  display: string;
  /** True iff the signer holds a key that survives process restart.
   *  False = ephemeral dev key (the worst case for production). */
  durable: boolean;
  /** True iff the private key never leaves the trust boundary
   *  (HSM, hardware-bound, KMS with no-export). */
  hardwareBound: boolean;
}

export interface Signer {
  /** Returns the base64url Ed25519 public key. */
  getPublicKey(): Promise<string>;
  /** Sign a canonical message; returns base64url Ed25519 signature. */
  sign(message: string): Promise<string>;
  /** Self-describe for diagnostics + signed attestation metadata. */
  describe(): SignerDescription;
}

// ── Local env-var signer (default; current path) ───────────────────

/**
 * The default Signer. Reads SOVEREIGN_PLATFORM_PRIVATE_KEY +
 * SOVEREIGN_PLATFORM_PUBLIC_KEY from env vars. If either is missing,
 * falls back to an EPHEMERAL boot-time keypair (dev only).
 *
 * Production deployments MUST set both env vars OR swap to a KMS
 * signer.
 */
export class LocalEnvSigner implements Signer {
  private privateKey: string;
  private publicKey: string;
  private isEphemeral: boolean;

  constructor() {
    const envPriv = process.env.SOVEREIGN_PLATFORM_PRIVATE_KEY;
    const envPub = process.env.SOVEREIGN_PLATFORM_PUBLIC_KEY;
    if (envPriv && envPub) {
      this.privateKey = envPriv;
      this.publicKey = envPub;
      this.isEphemeral = false;
    } else {
      const kp = generateKeyPair();
      this.privateKey = kp.privateKey;
      this.publicKey = kp.publicKey;
      this.isEphemeral = true;
    }
  }

  async getPublicKey(): Promise<string> {
    return this.publicKey;
  }

  async sign(message: string): Promise<string> {
    return localSignMessage(this.privateKey, message);
  }

  describe(): SignerDescription {
    return {
      type: "local-env",
      display: this.isEphemeral
        ? "Local ephemeral key (DEV ONLY — set SOVEREIGN_PLATFORM_PRIVATE_KEY for production)"
        : "Local env-var key (set via SOVEREIGN_PLATFORM_PRIVATE_KEY)",
      durable: !this.isEphemeral,
      hardwareBound: false,
    };
  }
}

// ── KMS adapter contract (skeleton — operator-specialized) ─────────

/**
 * StubKmsSigner — structural skeleton + tests for the contract
 * operators implement against. The actual cloud-SDK calls are
 * intentionally NOT pulled into this codebase to keep the platform
 * dependency-light.
 *
 * Operators ship adapters by:
 *   1. Implementing this contract against their KMS SDK.
 *   2. Wiring it via SOVEREIGN_SIGNER_TYPE env var.
 *
 * The skeleton's `sign()` THROWS — so a misconfiguration where the
 * stub leaks into production would loudly fail rather than silently
 * return invalid signatures.
 */
export interface KmsSignerConfig {
  /** "aws-kms" | "gcp-kms" | "azure-kv" | other — operator-set. */
  provider: string;
  /** KMS-specific key id (ARN, resource name, key vault URL). */
  keyId: string;
  /** KMS-specific region (where applicable). */
  region?: string;
  /** Pre-fetched public key (operator caches at boot). */
  publicKey: string;
}

export class StubKmsSigner implements Signer {
  constructor(private readonly config: KmsSignerConfig) {}

  async getPublicKey(): Promise<string> {
    return this.config.publicKey;
  }

  async sign(_message: string): Promise<string> {
    throw new Error(
      `StubKmsSigner is a structural placeholder. Operators must implement ` +
        `the Signer contract against their KMS SDK (provider: ${this.config.provider}). ` +
        `See src/lib/keys/signer.ts for the interface.`,
    );
  }

  describe(): SignerDescription {
    return {
      type: this.config.provider,
      display: `${this.config.provider} (key: ${this.config.keyId})`,
      durable: true,
      hardwareBound: this.config.provider.includes("hsm"),
    };
  }
}

// ── Selection (pure function) ──────────────────────────────────────

/**
 * Pure: choose which Signer to instantiate based on env config.
 *
 * Logic:
 *   - SOVEREIGN_SIGNER_TYPE="aws-kms" + relevant config → StubKms
 *     (operator implements actual sign() in their adapter)
 *   - SOVEREIGN_SIGNER_TYPE unset or "local-env" → LocalEnvSigner
 *
 * Returns a description of the selection for /reliability page +
 * signed attestation metadata.
 *
 * Pure with respect to the env snapshot; the actual instantiation
 * (which is impure — class constructor, possibly fetches public
 * key from KMS) lives in `getActiveSigner()`.
 */
export function selectSignerType(env: Record<string, string | undefined>): {
  type: "local-env" | "aws-kms" | "gcp-kms" | "azure-kv" | "stub-kms";
  reason: string;
} {
  const explicit = env.SOVEREIGN_SIGNER_TYPE?.trim().toLowerCase();
  if (explicit === "aws-kms") {
    return { type: "aws-kms", reason: "explicit via SOVEREIGN_SIGNER_TYPE" };
  }
  if (explicit === "gcp-kms") {
    return { type: "gcp-kms", reason: "explicit via SOVEREIGN_SIGNER_TYPE" };
  }
  if (explicit === "azure-kv") {
    return { type: "azure-kv", reason: "explicit via SOVEREIGN_SIGNER_TYPE" };
  }
  if (explicit === "stub-kms") {
    return { type: "stub-kms", reason: "test/skeleton mode" };
  }
  return {
    type: "local-env",
    reason:
      env.SOVEREIGN_PLATFORM_PRIVATE_KEY && env.SOVEREIGN_PLATFORM_PUBLIC_KEY
        ? "env-var keys configured"
        : "no signer configured — using ephemeral dev key",
  };
}

// ── Process-wide active signer (singleton) ─────────────────────────

let cachedSigner: Signer | null = null;

/**
 * Get the active Signer. Memoized for the process lifetime so we
 * don't reconstruct the local key (or the KMS connection) per call.
 *
 * In tests: call `_resetSignerForTesting()` between cases.
 */
export function getActiveSigner(): Signer {
  if (cachedSigner) return cachedSigner;
  const selection = selectSignerType(process.env);
  if (selection.type === "local-env") {
    cachedSigner = new LocalEnvSigner();
    return cachedSigner;
  }
  // For non-local types, the operator's adapter must register itself
  // before getActiveSigner is called. Until that happens we use the
  // stub, which fails loudly on .sign().
  cachedSigner = new StubKmsSigner({
    provider: selection.type,
    keyId: process.env.SOVEREIGN_KMS_KEY_ID ?? "(unset)",
    region: process.env.SOVEREIGN_KMS_REGION,
    publicKey: process.env.SOVEREIGN_PLATFORM_PUBLIC_KEY ?? "(unset)",
  });
  return cachedSigner;
}

/**
 * Operator hook: register a custom Signer adapter at boot. Once
 * registered, `getActiveSigner()` returns this instance for the
 * rest of the process lifetime.
 *
 * Used by operators who ship an AwsKmsSigner / GcpKmsSigner /
 * AzureKeyVaultSigner adapter — they call this at process start
 * before any signing path runs.
 */
export function registerActiveSigner(signer: Signer): void {
  cachedSigner = signer;
}

/** Test helper. Clears the cache so each test gets a fresh signer. */
export function _resetSignerForTesting(): void {
  cachedSigner = null;
}
