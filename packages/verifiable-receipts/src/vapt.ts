/**
 * Verifiable Agentic Payment Token (VAPT) — transaction-scoped tokens
 * for autonomous agent purchases.
 *
 * The open-source analogue of Mastercard Agent Pay / Visa Agentic
 * Commerce. A VAPT cryptographically binds an autonomous agent to a
 * verified human user's pre-authorized transaction envelope. Merchants
 * accept the token, settlement happens, but neither merchant nor the
 * agent runtime ever sees the user's underlying payment credentials.
 *
 * Why this matters: the Gemini "Agentic Transition" research correctly
 * flags identity attribution as the primary security failure of the
 * early agentic era. VAPT is the wire-format primitive that closes
 * that gap for monetary actions. Apache 2.0 — competitors compete on
 * settlement rails + fraud scoring, not on whether a token is
 * cryptographically verifiable.
 *
 * Wire format:
 *
 *   vapt1.<base64url(canonical_json)>.<base64url(ed25519_signature)>
 *
 * Canonical JSON keys are sorted lexicographically. The signed bytes
 * are the UTF-8 encoding of the canonical JSON. Signature is Ed25519
 * over the canonical bytes by the *user's* (or user's delegate's)
 * keypair — proves the agent acted under verified user authority.
 *
 * Constraints enforced at verification:
 *   - `expiresAt`: short-lived, max 1h from issuance
 *   - `maxAmount`: absolute spend ceiling for this token
 *   - `currency`: ISO 4217 three-letter code
 *   - `merchantAllowlist`: optional list of accepted merchant ids
 *   - `singleUse`: idempotency hint to settlement layer
 *   - `userId`: opaque user identifier
 *   - `agentId`: opaque agent identifier
 *
 * See docs/specs/vapt-1.0.md for the frozen wire-format spec.
 */

import { createHash } from "node:crypto";

/**
 * The data signed inside a VAPT. Field order in this interface is
 * arbitrary — canonicalize() sorts keys before serializing.
 */
export interface VaptPayload {
  /** Stable scheme tag. Always "vapt1". */
  scheme: "vapt1";
  /** Stable token id (UUID or similar). One-shot. */
  tokenId: string;
  /** Opaque user identifier. Whatever the issuer uses to identify the human. */
  userId: string;
  /** Opaque agent identifier. The agent slug + run id, typically. */
  agentId: string;
  /** Maximum amount this token can authorize, in the smallest currency unit. */
  maxAmount: number;
  /** ISO 4217 three-letter currency code (USD, EUR, ZAR, etc.). */
  currency: string;
  /** ISO 8601 instant when this token was minted. */
  issuedAt: string;
  /** ISO 8601 instant when this token stops being valid. */
  expiresAt: string;
  /**
   * Optional allowlist of merchant identifiers. If present, the token
   * MUST only be accepted by listed merchants. Empty array means
   * "no merchants accepted" — not "any merchant". Use undefined for
   * "any merchant".
   */
  merchantAllowlist?: string[];
  /** Hint to the settlement layer: this token should never be reused. */
  singleUse: boolean;
  /**
   * Optional purpose field — free-form human-readable description.
   * Useful for audit trails ("groceries delivery") but not enforced.
   */
  purpose?: string;
}

export interface VerifyVaptOptions {
  /** Settle-against amount in the smallest currency unit. */
  proposedAmount: number;
  /** Currency of the proposed transaction. */
  proposedCurrency: string;
  /** Merchant attempting to redeem the token. */
  proposedMerchantId: string;
  /** Verifier's current wall-clock time. Defaults to now. */
  now?: Date;
  /**
   * Verifier function. Takes (canonicalBytes, signatureBytes,
   * publicKeyMaterial) and returns true if the signature verifies.
   * Caller supplies their own primitive — Node `crypto.verify`,
   * @noble/ed25519, KMS HSM, whatever.
   */
  verifySignature: (
    canonical: string,
    signature: Uint8Array,
    publicKeyMaterial: unknown,
  ) => boolean;
  /** Whatever material the verifySignature callback understands. */
  publicKeyMaterial: unknown;
}

export interface VaptVerifyResult {
  ok: boolean;
  reason?: string;
  /** The parsed payload (always returned, even on failure, for audit). */
  payload?: VaptPayload;
}

const VAPT_PREFIX = "vapt1.";

/**
 * Stable lexicographic JSON canonicalization. JS JSON.stringify with
 * a key-sorting replacer is sufficient because we don't carry nested
 * objects whose key order would also matter. (If we add nested
 * objects in v2, replace this with a full RFC 8785 implementation.)
 */
function canonicalize(payload: VaptPayload): string {
  const keys = Object.keys(payload).sort() as Array<keyof VaptPayload>;
  const ordered: Record<string, unknown> = {};
  for (const k of keys) {
    const v = payload[k];
    if (v !== undefined) ordered[k] = v;
  }
  return JSON.stringify(ordered);
}

function base64UrlEncode(bytes: Uint8Array | string): string {
  const buf =
    typeof bytes === "string" ? Buffer.from(bytes, "utf8") : Buffer.from(bytes);
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

/**
 * Mint a VAPT wire token from a payload + a sign function.
 *
 * The caller's `sign` callback is responsible for whatever cryptographic
 * primitive they have available (Node crypto.sign, @noble/ed25519, KMS
 * remote sign). The signature is bound to the canonical bytes.
 */
export function mintVapt(
  payload: Omit<VaptPayload, "scheme">,
  sign: (canonical: string) => Uint8Array,
): string {
  const fullPayload: VaptPayload = { ...payload, scheme: "vapt1" };
  validateMintInputs(fullPayload);
  const canonical = canonicalize(fullPayload);
  const sig = sign(canonical);
  const payloadB64 = base64UrlEncode(canonical);
  const sigB64 = base64UrlEncode(sig);
  return `${VAPT_PREFIX}${payloadB64}.${sigB64}`;
}

function validateMintInputs(p: VaptPayload): void {
  if (p.scheme !== "vapt1") throw new Error("VAPT: scheme must be 'vapt1'");
  if (!p.tokenId) throw new Error("VAPT: tokenId required");
  if (!p.userId) throw new Error("VAPT: userId required");
  if (!p.agentId) throw new Error("VAPT: agentId required");
  if (typeof p.maxAmount !== "number" || p.maxAmount <= 0) {
    throw new Error("VAPT: maxAmount must be positive number");
  }
  if (!/^[A-Z]{3}$/.test(p.currency)) {
    throw new Error("VAPT: currency must be ISO 4217 three-letter code");
  }
  const issued = Date.parse(p.issuedAt);
  const expires = Date.parse(p.expiresAt);
  if (!Number.isFinite(issued)) throw new Error("VAPT: issuedAt invalid");
  if (!Number.isFinite(expires)) throw new Error("VAPT: expiresAt invalid");
  if (expires <= issued) {
    throw new Error("VAPT: expiresAt must be after issuedAt");
  }
  // Max lifetime: 1 hour to bound replay risk.
  if (expires - issued > 60 * 60 * 1000) {
    throw new Error("VAPT: lifetime exceeds 1 hour");
  }
  if (typeof p.singleUse !== "boolean") {
    throw new Error("VAPT: singleUse must be boolean");
  }
}

/**
 * Parse a VAPT wire token. Returns the payload bytes + signature bytes
 * without verifying the signature. Verification is the verifier's job.
 */
export function parseVapt(
  token: string,
): { canonical: string; payload: VaptPayload; signature: Uint8Array } | null {
  if (!token.startsWith(VAPT_PREFIX)) return null;
  const body = token.slice(VAPT_PREFIX.length);
  const dot = body.indexOf(".");
  if (dot < 0) return null;
  const payloadB64 = body.slice(0, dot);
  const sigB64 = body.slice(dot + 1);
  let canonical: string;
  let signature: Buffer;
  try {
    canonical = base64UrlDecode(payloadB64).toString("utf8");
    signature = base64UrlDecode(sigB64);
  } catch {
    return null;
  }
  let payload: VaptPayload;
  try {
    payload = JSON.parse(canonical) as VaptPayload;
  } catch {
    return null;
  }
  if (payload.scheme !== "vapt1") return null;
  return { canonical, payload, signature };
}

/**
 * Verify a VAPT against a proposed settlement transaction.
 *
 * Returns ok=true only when ALL constraints pass:
 *   - parses cleanly
 *   - signature verifies under the supplied public key material
 *   - now is within [issuedAt, expiresAt]
 *   - proposedAmount ≤ maxAmount
 *   - proposedCurrency === currency
 *   - merchantAllowlist (if present) contains proposedMerchantId
 *
 * Any failure returns ok=false with a short reason string and the
 * parsed payload (when available) for audit logging.
 */
export function verifyVapt(
  token: string,
  opts: VerifyVaptOptions,
): VaptVerifyResult {
  const parsed = parseVapt(token);
  if (!parsed) return { ok: false, reason: "malformed token" };

  const { canonical, payload, signature } = parsed;

  // Signature first — never trust unsigned payload data.
  if (!opts.verifySignature(canonical, signature, opts.publicKeyMaterial)) {
    return { ok: false, reason: "signature does not verify", payload };
  }

  const now = (opts.now ?? new Date()).getTime();
  const issued = Date.parse(payload.issuedAt);
  const expires = Date.parse(payload.expiresAt);

  if (!Number.isFinite(issued) || !Number.isFinite(expires)) {
    return { ok: false, reason: "issuedAt or expiresAt invalid", payload };
  }
  if (expires <= issued) {
    return {
      ok: false,
      reason: "expiresAt must be after issuedAt",
      payload,
    };
  }
  // Re-enforce the 1-hour spec ceiling at verify time. The mint
  // validator enforces this too, but a malicious or buggy minter
  // can violate it — the verifier must not honor a token whose
  // embedded lifetime exceeds policy.
  if (expires - issued > 60 * 60 * 1000) {
    return {
      ok: false,
      reason: "token lifetime exceeds 1-hour spec ceiling",
      payload,
    };
  }

  if (now < issued) {
    return { ok: false, reason: "token not yet valid", payload };
  }
  if (now > expires) {
    return { ok: false, reason: "token expired", payload };
  }
  if (opts.proposedAmount <= 0) {
    return { ok: false, reason: "proposed amount must be positive", payload };
  }
  if (opts.proposedAmount > payload.maxAmount) {
    return {
      ok: false,
      reason: `proposed amount ${opts.proposedAmount} exceeds maxAmount ${payload.maxAmount}`,
      payload,
    };
  }
  if (opts.proposedCurrency !== payload.currency) {
    return {
      ok: false,
      reason: `currency mismatch (token=${payload.currency}, proposed=${opts.proposedCurrency})`,
      payload,
    };
  }
  if (Array.isArray(payload.merchantAllowlist)) {
    if (payload.merchantAllowlist.length === 0) {
      return {
        ok: false,
        reason: "merchantAllowlist is empty — no merchants accepted",
        payload,
      };
    }
    if (!payload.merchantAllowlist.includes(opts.proposedMerchantId)) {
      return {
        ok: false,
        reason: `merchant ${opts.proposedMerchantId} not in allowlist`,
        payload,
      };
    }
  }
  return { ok: true, payload };
}

/**
 * SHA-256 hash of the canonical bytes. Useful for idempotency keys on
 * the settlement layer — a verifier records `vaptHash(token)` to
 * detect replay across distributed processes.
 */
export function vaptHash(token: string): string {
  const parsed = parseVapt(token);
  if (!parsed) return "";
  return createHash("sha256").update(parsed.canonical, "utf8").digest("hex");
}
