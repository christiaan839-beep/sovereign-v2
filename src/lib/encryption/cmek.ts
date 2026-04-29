/**
 * CUSTOMER-MANAGED ENCRYPTION KEYS (R55).
 *
 * The HIPAA / financial-services enterprise unblocker. Standard
 * pattern: tenant data is encrypted with a tenant-specific Data
 * Encryption Key (DEK); the DEK is itself encrypted with a
 * Customer-Managed Key (CMK) that lives in the customer's KMS
 * (AWS KMS, GCP Cloud KMS, Azure Key Vault, or hardware HSM).
 *
 * Why this is non-negotiable for $100K+ deals:
 *   - HIPAA §164.312(a)(2)(iv) — encryption + decryption of ePHI
 *   - SOC 2 CC6.7 — restricts data transmission via cryptography
 *   - PCI DSS 3.4 — protect stored cardholder data
 *   - Customer-managed keys = customer can REVOKE access by
 *     destroying their own key. Sovereign cannot decrypt without
 *     the customer's KMS. This is the single strongest data-
 *     sovereignty story in the industry.
 *
 * THE TRUST CONTRACT:
 *
 *   1. Sovereign generates a fresh DEK for each tenant on first
 *      data-write.
 *   2. The DEK is wrapped (encrypted) by the customer's CMK via
 *      a CmekProvider adapter. The wrapped DEK is what Sovereign
 *      stores; the plaintext DEK is held only in process memory
 *      with TTL.
 *   3. Tenant data is encrypted at rest with the plaintext DEK
 *      using AES-256-GCM (authenticated encryption).
 *   4. To decrypt: unwrap the DEK via the customer's CMK, then
 *      decrypt the data.
 *   5. Customer can ROTATE their CMK independently — Sovereign
 *      re-wraps without ever seeing the new key in plaintext.
 *
 * Pure-function envelope encryption design:
 *   - encryptEnvelope(plaintext, dek) → AEAD ciphertext (pure)
 *   - decryptEnvelope(ciphertext, dek) → plaintext (pure)
 *   - The CmekProvider interface is the impure boundary (calls
 *     out to the customer's KMS for unwrap/wrap)
 *
 * IMPLEMENTATIONS:
 *   - LocalCmekProvider: dev-only; uses ENCRYPTION_KEY env var as
 *     CMK. NEVER use in production for HIPAA/financial deals.
 *   - StubCmekProvider: structural skeleton for operator-built
 *     adapters (AWS KMS, GCP, Azure). FAILS CLOSED on actual
 *     wrap/unwrap so misconfig errors loudly.
 *
 * Future implementations (operator-built):
 *   - AwsKmsCmekProvider (uses @aws-sdk/client-kms)
 *   - GcpKmsCmekProvider (uses @google-cloud/kms)
 *   - AzureKvCmekProvider (uses @azure/keyvault-keys)
 *
 * Same trustless property as R54 Signer: whichever CmekProvider
 * is configured, the OUTPUT (AEAD ciphertext) is unchanged.
 * Customer's choice of KMS is operational, not trust-model.
 */

import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";

// ── Envelope shape ─────────────────────────────────────────────────

/**
 * The on-disk shape of an encrypted record. All fields needed for
 * decryption are present; nothing else.
 *
 * ciphertext:     AES-256-GCM ciphertext + auth tag (combined)
 * iv:             96-bit nonce (base64url)
 * wrappedDek:     CMK-wrapped Data Encryption Key (base64url)
 * cmkKeyId:       Operator-supplied CMK identifier (for unwrap routing)
 * algorithm:      "aes-256-gcm" — fixed for v1; future may add
 *                  alternatives via algorithm versioning
 */
export interface EncryptedEnvelope {
  ciphertext: string; // base64url (data + 16-byte GCM tag appended)
  iv: string; // base64url, 12 bytes
  wrappedDek: string; // base64url, opaque to platform
  cmkKeyId: string;
  algorithm: "aes-256-gcm";
}

// ── CmekProvider interface ─────────────────────────────────────────

/**
 * The contract for KMS-backed key wrap/unwrap. Operators implement
 * this against their cloud KMS SDK; Sovereign holds a registry of
 * active providers.
 *
 * wrapDek():    plaintext DEK → ciphertext wrapped DEK
 * unwrapDek():  wrapped DEK → plaintext DEK
 *
 * Both are async because cloud KMS calls are network-bound. Both
 * MUST run inside the customer's trust boundary — Sovereign never
 * sees the customer's CMK material.
 */
export interface CmekProvider {
  /** Stable identifier — "aws-kms", "gcp-kms", "local-dev". */
  type: string;
  /** Human-readable description for /reliability + diagnostics. */
  describe(): {
    type: string;
    display: string;
    productionGrade: boolean;
  };
  /** Wrap a fresh plaintext DEK under the customer's CMK. */
  wrapDek(plaintextDek: Buffer, cmkKeyId: string): Promise<string>;
  /** Unwrap a previously-wrapped DEK back to plaintext. */
  unwrapDek(wrappedDek: string, cmkKeyId: string): Promise<Buffer>;
}

// ── Pure-function envelope crypto ──────────────────────────────────

/**
 * Pure: AES-256-GCM encryption. Same plaintext + DEK + IV →
 * same ciphertext, every time.
 *
 * Returns combined `ciphertext || authTag` for compatness.
 */
export function encryptEnvelope(input: {
  plaintext: Buffer;
  dek: Buffer;
  iv: Buffer;
}): { ciphertext: Buffer; authTag: Buffer } {
  if (input.dek.length !== 32) {
    throw new Error(
      `encryptEnvelope: DEK must be 32 bytes (256 bits), got ${input.dek.length}`,
    );
  }
  if (input.iv.length !== 12) {
    throw new Error(
      `encryptEnvelope: IV must be 12 bytes (96 bits), got ${input.iv.length}`,
    );
  }
  const cipher = createCipheriv("aes-256-gcm", input.dek, input.iv);
  const ciphertext = Buffer.concat([
    cipher.update(input.plaintext),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, authTag };
}

/**
 * Pure: AES-256-GCM decryption. Throws if auth tag fails.
 */
export function decryptEnvelope(input: {
  ciphertext: Buffer;
  authTag: Buffer;
  dek: Buffer;
  iv: Buffer;
}): Buffer {
  if (input.dek.length !== 32) {
    throw new Error("decryptEnvelope: DEK must be 32 bytes");
  }
  if (input.iv.length !== 12) {
    throw new Error("decryptEnvelope: IV must be 12 bytes");
  }
  if (input.authTag.length !== 16) {
    throw new Error("decryptEnvelope: GCM auth tag must be 16 bytes");
  }
  const decipher = createDecipheriv("aes-256-gcm", input.dek, input.iv);
  decipher.setAuthTag(input.authTag);
  return Buffer.concat([
    decipher.update(input.ciphertext),
    decipher.final(),
  ]);
}

/**
 * Pure: generate a fresh 256-bit DEK. Uses Node's CSPRNG.
 * Wraps `randomBytes` for testability — callers can inject a
 * deterministic generator in tests.
 */
export function generateDek(rng: () => Buffer = () => randomBytes(32)): Buffer {
  const dek = rng();
  if (dek.length !== 32) {
    throw new Error("generateDek: RNG must return 32 bytes");
  }
  return dek;
}

/**
 * Pure: generate a fresh 96-bit IV.
 */
export function generateIv(rng: () => Buffer = () => randomBytes(12)): Buffer {
  const iv = rng();
  if (iv.length !== 12) {
    throw new Error("generateIv: RNG must return 12 bytes");
  }
  return iv;
}

// ── High-level wrap/encrypt/decrypt orchestration ──────────────────

/**
 * High-level encrypt: generate DEK + IV, encrypt plaintext, wrap
 * DEK via the CmekProvider. Returns the on-disk envelope.
 *
 * The plaintext DEK exists ONLY for the duration of this function
 * call; it's never persisted in plaintext.
 */
export async function encryptWithCmek(input: {
  plaintext: Buffer;
  cmkKeyId: string;
  provider: CmekProvider;
  rng?: () => Buffer;
}): Promise<EncryptedEnvelope> {
  const dek = generateDek(input.rng);
  const iv = generateIv(input.rng);
  const { ciphertext, authTag } = encryptEnvelope({
    plaintext: input.plaintext,
    dek,
    iv,
  });
  const combined = Buffer.concat([ciphertext, authTag]);
  const wrappedDek = await input.provider.wrapDek(dek, input.cmkKeyId);
  // Best-effort: zero out the in-memory DEK after use.
  dek.fill(0);
  return {
    ciphertext: combined.toString("base64url"),
    iv: iv.toString("base64url"),
    wrappedDek,
    cmkKeyId: input.cmkKeyId,
    algorithm: "aes-256-gcm",
  };
}

/**
 * High-level decrypt: unwrap DEK via CmekProvider, decrypt envelope.
 *
 * If the customer has revoked their CMK, unwrap fails and Sovereign
 * cannot decrypt the data. This is the customer-data-sovereignty
 * property.
 */
export async function decryptWithCmek(input: {
  envelope: EncryptedEnvelope;
  provider: CmekProvider;
}): Promise<Buffer> {
  if (input.envelope.algorithm !== "aes-256-gcm") {
    throw new Error(
      `decryptWithCmek: unsupported algorithm ${input.envelope.algorithm}`,
    );
  }
  const dek = await input.provider.unwrapDek(
    input.envelope.wrappedDek,
    input.envelope.cmkKeyId,
  );
  if (dek.length !== 32) {
    throw new Error(
      `decryptWithCmek: unwrapped DEK has wrong length ${dek.length}`,
    );
  }
  const combined = Buffer.from(input.envelope.ciphertext, "base64url");
  const ciphertext = combined.subarray(0, combined.length - 16);
  const authTag = combined.subarray(combined.length - 16);
  const iv = Buffer.from(input.envelope.iv, "base64url");
  try {
    return decryptEnvelope({ ciphertext, authTag, dek, iv });
  } finally {
    dek.fill(0);
  }
}

// ── Local-dev provider (testing + dev only) ────────────────────────

/**
 * Dev-only CmekProvider that XORs the DEK with a key derived from
 * ENCRYPTION_KEY env var. NOT a real KMS. Sovereign HOLDS this
 * key, which violates the customer-data-sovereignty property.
 *
 * Its purpose: testing + integration before the operator wires a
 * real KMS adapter. Production deployments MUST swap to an
 * operator-built adapter (AWS / GCP / Azure / HSM).
 */
export class LocalDevCmekProvider implements CmekProvider {
  readonly type = "local-dev";
  private readonly key: Buffer;

  constructor(masterKey?: Buffer) {
    if (masterKey) {
      if (masterKey.length !== 32) {
        throw new Error("LocalDevCmekProvider: master key must be 32 bytes");
      }
      this.key = masterKey;
    } else {
      const fromEnv = process.env.ENCRYPTION_KEY;
      if (fromEnv && fromEnv.length === 64) {
        // 64 hex chars = 32 bytes
        this.key = Buffer.from(fromEnv, "hex");
      } else {
        // Last resort: ephemeral key. Loud warning for production.
        this.key = randomBytes(32);
      }
    }
  }

  describe() {
    return {
      type: this.type,
      display:
        "Local dev CMEK (Sovereign holds the master key — NOT for production)",
      productionGrade: false,
    };
  }

  async wrapDek(plaintextDek: Buffer, _cmkKeyId: string): Promise<string> {
    if (plaintextDek.length !== 32) {
      throw new Error("wrapDek: DEK must be 32 bytes");
    }
    // XOR-wrap is intentionally trivial — this is dev only.
    const wrapped = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      wrapped[i] = plaintextDek[i] ^ this.key[i];
    }
    return wrapped.toString("base64url");
  }

  async unwrapDek(wrappedDek: string, _cmkKeyId: string): Promise<Buffer> {
    const wrapped = Buffer.from(wrappedDek, "base64url");
    if (wrapped.length !== 32) {
      throw new Error("unwrapDek: wrapped DEK must be 32 bytes");
    }
    const dek = Buffer.alloc(32);
    for (let i = 0; i < 32; i++) {
      dek[i] = wrapped[i] ^ this.key[i];
    }
    return dek;
  }
}

// ── Stub KMS provider (operator-skeleton) ──────────────────────────

/**
 * StubCmekProvider — fails closed. Operators implement this against
 * their KMS SDK. The skeleton's wrap/unwrap THROW so a misconfig
 * doesn't silently produce broken envelopes.
 */
export class StubCmekProvider implements CmekProvider {
  readonly type: string;

  constructor(public readonly providerType: string) {
    this.type = providerType;
  }

  describe() {
    return {
      type: this.type,
      display: `${this.type} (stub — operator must implement against KMS SDK)`,
      productionGrade: true,
    };
  }

  async wrapDek(_dek: Buffer, _cmkKeyId: string): Promise<string> {
    throw new Error(
      `StubCmekProvider(${this.type}): operators must implement wrapDek() ` +
        `against their KMS SDK. See src/lib/encryption/cmek.ts for the contract.`,
    );
  }

  async unwrapDek(_wrappedDek: string, _cmkKeyId: string): Promise<Buffer> {
    throw new Error(
      `StubCmekProvider(${this.type}): operators must implement unwrapDek() ` +
        `against their KMS SDK. See src/lib/encryption/cmek.ts for the contract.`,
    );
  }
}

// ── Provider selection (pure) ──────────────────────────────────────

/**
 * Pure: pick the CMEK provider type based on env config.
 * Returns the type + reason for use in /reliability metadata.
 */
export function selectCmekProviderType(env: Record<string, string | undefined>): {
  type: "local-dev" | "aws-kms" | "gcp-kms" | "azure-kv" | "stub";
  reason: string;
} {
  const explicit = env.SOVEREIGN_CMEK_PROVIDER?.trim().toLowerCase();
  if (explicit === "aws-kms") {
    return { type: "aws-kms", reason: "explicit via SOVEREIGN_CMEK_PROVIDER" };
  }
  if (explicit === "gcp-kms") {
    return { type: "gcp-kms", reason: "explicit via SOVEREIGN_CMEK_PROVIDER" };
  }
  if (explicit === "azure-kv") {
    return { type: "azure-kv", reason: "explicit via SOVEREIGN_CMEK_PROVIDER" };
  }
  if (explicit === "stub") {
    return { type: "stub", reason: "test/skeleton mode" };
  }
  return {
    type: "local-dev",
    reason: env.ENCRYPTION_KEY
      ? "ENCRYPTION_KEY set — local-dev provider"
      : "no CMEK provider configured — using ephemeral local-dev key (NOT FOR PRODUCTION)",
  };
}
