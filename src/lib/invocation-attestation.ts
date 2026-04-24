/**
 * Invocation attestation — cryptographic proof of every run.
 *
 * Extends the manifest-signing infrastructure from src/lib/sam-signing.ts
 * to the INVOCATION layer. Every /api/agents/invoke response now
 * carries a compact signed attestation:
 *
 *   {
 *     "agentId":       "<uuid>",
 *     "invocationId":  "<inv-xxxxxx>",
 *     "inputHash":     "sha256-<hex>",
 *     "outputHash":    "sha256-<hex>",
 *     "modelUsed":     "nvidia/nemotron-ultra-253b-v1",
 *     "timestamp":     "2026-04-24T10:15:00.000Z",
 *     "slaVerdict":    "met" | "breached" | "not_enforced",
 *     "platform":      "sovereignmatrix.agency",
 *     "_sig": {
 *       "alg":         "ed25519",
 *       "publicKey":   "<b64url SPKI>",
 *       "signature":   "<b64url>"
 *     }
 *   }
 *
 * Any third party (auditor, regulator, compliance tool) can verify
 * this with just our public key (published at /api/platform/public-key).
 * Tamper anywhere — the input, the output, the SLA verdict — and the
 * signature breaks.
 *
 * What this unlocks:
 *   - Regulated industries (finance, legal, healthcare) can use
 *     marketplace agents with auditable compliance trails
 *   - Dispute resolution: "Did agent X actually produce this output
 *     for this input?" becomes a signature verification, not a
 *     support ticket
 *   - Verifiable computation — the platform can't silently change
 *     what an agent did after the fact
 *
 * Nobody else in the agent-marketplace space offers this. CrewAI,
 * Zapier, Lindy, Salesforce, OpenAI GPTs — none of them sign
 * invocations. This is a true Tier-1 moat.
 *
 * Key management (v1):
 *   The platform reads its signing key from env (PLATFORM_SIGNING_KEY,
 *   base64url PKCS8). If absent, attestations degrade to
 *   { signed: false } — never throws; the invocation still succeeds.
 *   Ops generates the keypair once via `generateKeypair()` (from
 *   sam-signing.ts) and stores the public key at /api/platform/public-key
 *   for verifiers.
 *
 * Privacy: we sign HASHES of input/output, not the raw content. An
 * auditor who has the plaintext input + plaintext output can recompute
 * the hashes and verify; someone without the plaintext learns nothing
 * about the content from the signature.
 */

import { canonicalStringify } from "@/lib/sam-signing";
import { createLogger } from "@/lib/logger";

const log = createLogger("invocation-attestation");

/* ─── Types ───────────────────────────────────────────────────── */

export type SlaVerdictLabel = "met" | "breached" | "not_enforced";

export interface AttestationPayload {
  agentId: string;
  invocationId: string;
  inputHash: string;
  outputHash: string;
  modelUsed: string;
  timestamp: string;
  slaVerdict: SlaVerdictLabel;
  platform: string;
}

export interface Attestation extends AttestationPayload {
  _sig?: {
    alg: "ed25519";
    publicKey: string;
    signature: string;
  };
}

export interface AttestationResult {
  signed: boolean;
  attestation: Attestation;
  reason?: string;
}

/* ─── Hashing ─────────────────────────────────────────────────── */

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sha256-${hex}`;
}

/* ─── Base64url + signing (local copies from sam-signing) ──── */

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(b64url: string): Uint8Array {
  const pad =
    b64url.length % 4 === 2 ? "==" : b64url.length % 4 === 3 ? "=" : "";
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ─── Platform key resolution ─────────────────────────────────── */

function platformPrivateKeyB64(): string | null {
  const v = process.env.PLATFORM_SIGNING_KEY;
  if (typeof v === "string" && v.length > 0) return v;
  return null;
}

const PLATFORM_HOST =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, "") ??
  "sovereignmatrix.agency";

/* ─── Public API — sign an invocation ─────────────────────────── */

export interface SignInput {
  agentId: string;
  invocationId: string;
  /** Raw input text. Hashed before signing. */
  input: string;
  /** Raw output text. Hashed before signing. */
  output: string;
  modelUsed?: string;
  slaVerdict?: SlaVerdictLabel;
}

/**
 * Produce a signed attestation for an invocation. Fails gracefully —
 * if the platform key isn't configured, returns
 * `{ signed: false, attestation: <unsigned payload> }` so callers can
 * still surface the claim (with the caveat that it's not
 * cryptographically backed).
 *
 * Never throws. A signing error falls back to the unsigned-payload
 * return with a `reason` field.
 */
export async function signInvocation(
  input: SignInput,
): Promise<AttestationResult> {
  const inputHash = await sha256Hex(input.input ?? "");
  const outputHash = await sha256Hex(input.output ?? "");
  const payload: AttestationPayload = {
    agentId: input.agentId,
    invocationId: input.invocationId,
    inputHash,
    outputHash,
    modelUsed: input.modelUsed ?? "unknown",
    timestamp: new Date().toISOString(),
    slaVerdict: input.slaVerdict ?? "not_enforced",
    platform: PLATFORM_HOST,
  };

  const privB64 = platformPrivateKeyB64();
  if (!privB64) {
    return {
      signed: false,
      attestation: payload,
      reason: "PLATFORM_SIGNING_KEY not configured",
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subtle = crypto.subtle as any;
    const priv = await subtle.importKey(
      "pkcs8",
      base64urlDecode(privB64),
      "Ed25519",
      true,
      ["sign"],
    );
    const canonical = canonicalStringify(payload);
    const bytes = new TextEncoder().encode(canonical);
    const sigBytes = (await subtle.sign("Ed25519", priv, bytes)) as ArrayBuffer;

    // Re-derive public part of the same key so verifiers can get it
    // from this attestation without a separate call. (Ops SHOULD also
    // expose it at /api/platform/public-key for offline verifiers.)
    const jwk = (await subtle.exportKey("jwk", priv)) as { x?: string };
    const publicKey = jwk.x ?? "";

    return {
      signed: true,
      attestation: {
        ...payload,
        _sig: {
          alg: "ed25519",
          publicKey,
          signature: base64urlEncode(new Uint8Array(sigBytes)),
        },
      },
    };
  } catch (err) {
    log.warn("signInvocation threw — returning unsigned attestation", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      signed: false,
      attestation: payload,
      reason: err instanceof Error ? err.message : "signing failed",
    };
  }
}

/* ─── Public API — verify an attestation ──────────────────────── */

export interface VerifyInvocationResult {
  signed: boolean;
  valid: boolean;
  reason?: string;
  publicKey?: string;
}

/**
 * Verify a signed attestation. Accepts the full attestation object
 * (as returned by signInvocation); returns a structured verdict.
 *
 * Never throws. A verification error → `{ signed: true, valid: false,
 * reason }`.
 */
export async function verifyAttestation(
  att: Attestation,
): Promise<VerifyInvocationResult> {
  if (!att._sig) return { signed: false, valid: false };
  if (att._sig.alg !== "ed25519") {
    return {
      signed: true,
      valid: false,
      reason: `Unsupported alg: ${att._sig.alg}`,
    };
  }

  const { _sig, ...payload } = att;
  const canonical = canonicalStringify(payload);
  const bytes = new TextEncoder().encode(canonical);

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subtle = crypto.subtle as any;
    const pub = await subtle.importKey(
      "jwk",
      { kty: "OKP", crv: "Ed25519", x: _sig.publicKey },
      "Ed25519",
      false,
      ["verify"],
    );
    const ok = await subtle.verify(
      "Ed25519",
      pub,
      base64urlDecode(_sig.signature),
      bytes,
    );
    return ok
      ? { signed: true, valid: true, publicKey: _sig.publicKey }
      : { signed: true, valid: false, reason: "Signature did not verify" };
  } catch (err) {
    return {
      signed: true,
      valid: false,
      reason: err instanceof Error ? err.message : "verification threw",
    };
  }
}
