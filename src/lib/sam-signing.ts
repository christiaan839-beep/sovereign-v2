/**
 * SAM v1.0 manifest signing — ed25519 via WebCrypto.
 *
 * Creators cryptographically sign their manifests before submission.
 * The signature + public key travel with the manifest in a nested
 * `_sig` object:
 *
 *   {
 *     "sam": "1.0",
 *     "slug": "invoice-ocr",
 *     ...other fields...,
 *     "_sig": {
 *       "alg": "ed25519",
 *       "publicKey": "<base64url-encoded SPKI>",
 *       "signature": "<base64url-encoded detached signature>"
 *     }
 *   }
 *
 * At verification time we:
 *   1. Extract _sig and remove it from the object
 *   2. Canonicalize the remaining object via deterministicStringify
 *   3. Verify signature against publicKey + canonical bytes
 *
 * Why this matters: NO other agent marketplace cryptographically
 * attests creator intent. A platform that silently modifies a
 * submitted agent is indistinguishable from one that doesn't. Signed
 * manifests give creators publishable proof "this agent came from me"
 * and give buyers "this hasn't been silently altered" — both
 * attestation axes are unique to this platform.
 *
 * Implementation: WebCrypto is on Node 18+, ed25519 support in
 * Node 20+. All operations are async because crypto.subtle is async.
 *
 * Scope for v1: signatures are OPTIONAL. Manifests without _sig are
 * accepted normally; manifests WITH _sig are verified at submission
 * time and rejected if the signature is invalid. Creators who want
 * attestation get it; creators who don't care keep working.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("sam-signing");

/* ─── Types ───────────────────────────────────────────────────── */

export interface ManifestSignature {
  /** Algorithm identifier. Only "ed25519" is accepted in v1. */
  alg: "ed25519";
  /** Base64url-encoded SPKI public key bytes. */
  publicKey: string;
  /** Base64url-encoded detached signature bytes. */
  signature: string;
}

export interface SignedManifest {
  _sig?: ManifestSignature;
  [key: string]: unknown;
}

export interface VerifyResult {
  /** True if the manifest carries no signature (not an error). */
  unsigned: boolean;
  /** True if a signature was present AND verified. */
  valid: boolean;
  /** Short explanation of why invalid. */
  reason?: string;
  /** The public key that signed, if verified. */
  publicKey?: string;
}

/* ─── Base64url helpers (no deps) ─────────────────────────────── */

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(b64url: string): Uint8Array {
  const pad = b64url.length % 4 === 2 ? "==" : b64url.length % 4 === 3 ? "=" : "";
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/* ─── Deterministic JSON ──────────────────────────────────────── */

/**
 * Emit a canonical JSON string for signing: keys sorted recursively,
 * no whitespace, strings JSON-encoded, numbers finite-only, arrays
 * preserved in order.
 *
 * Why our own: standard JSON.stringify doesn't guarantee key order
 * across implementations. Signing requires byte-exact canonicalization
 * so the verifier produces identical bytes to the signer.
 */
export function canonicalStringify(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "null";
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalStringify).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts: string[] = [];
    for (const k of keys) {
      parts.push(JSON.stringify(k) + ":" + canonicalStringify(obj[k]));
    }
    return "{" + parts.join(",") + "}";
  }
  return "null";
}

/* ─── Key generation (creator-side helper) ────────────────────── */

/**
 * Generate a fresh ed25519 keypair. Creators run this ONCE and keep
 * the private key locally; the public key is embedded in every
 * signed manifest. Returned in base64url-encoded SPKI/PKCS8 form for
 * easy copy/paste.
 *
 * Not used by the server; exposed here for consumers of the library
 * (the CLI, future UI, tests).
 */
export async function generateKeypair(): Promise<{
  publicKeyB64: string;
  privateKeyB64: string;
}> {
  // See sign/verify functions — "Ed25519" is runtime-supported
  // but types haven't caught up.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subtle = crypto.subtle as any;
  const kp = (await subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const pub = await subtle.exportKey("spki", kp.publicKey);
  const priv = await subtle.exportKey("pkcs8", kp.privateKey);
  return {
    publicKeyB64: base64urlEncode(new Uint8Array(pub)),
    privateKeyB64: base64urlEncode(new Uint8Array(priv)),
  };
}

/* ─── Sign a manifest ─────────────────────────────────────────── */

/**
 * Sign a manifest with a creator-held private key. Returns a NEW
 * manifest object with `_sig` attached. The input object is not
 * mutated.
 *
 * Intended for CLI use — the server never signs on behalf of
 * creators (that would defeat the point of creator attestation).
 */
export async function signManifest(
  manifest: Record<string, unknown>,
  privateKeyB64: string,
): Promise<SignedManifest> {
  // Strip any existing _sig before canonicalizing, so re-signs
  // don't include the old sig in the payload.
  const { _sig: _existing, ...body } = manifest as SignedManifest;
  void _existing;

  // Node 20+'s WebCrypto supports "Ed25519" at runtime but the lib
  // types haven't caught up. Narrow to `subtle` once then cast, so
  // the rest of this function reads cleanly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subtle = crypto.subtle as any;

  const priv = await subtle.importKey(
    "pkcs8",
    base64urlDecode(privateKeyB64),
    "Ed25519",
    false,
    ["sign"],
  );

  const payload = new TextEncoder().encode(canonicalStringify(body));
  const sigBytes = await subtle.sign("Ed25519", priv, payload);

  // Re-derive the public key from the private key so the caller
  // doesn't need to keep them in sync. jwk export gives us x (the
  // public bytes) alongside d (the secret bytes).
  const jwk = (await subtle.exportKey(
    "jwk",
    await subtle.importKey(
      "pkcs8",
      base64urlDecode(privateKeyB64),
      "Ed25519",
      true,
      ["sign"],
    ),
  )) as { x?: string };
  const xB64url = jwk.x ?? "";

  return {
    ...body,
    _sig: {
      alg: "ed25519",
      publicKey: xB64url,
      signature: base64urlEncode(new Uint8Array(sigBytes)),
    },
  };
}

/* ─── Verify a manifest ───────────────────────────────────────── */

/**
 * Check a manifest's signature. Returns a structured verdict that
 * the submission route can branch on. Never throws for expected
 * failures (malformed sig, wrong alg, unverified bytes).
 */
export async function verifyManifestSignature(
  manifest: unknown,
): Promise<VerifyResult> {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { unsigned: true, valid: false };
  }
  const m = manifest as SignedManifest;
  const sig = m._sig;
  if (!sig) return { unsigned: true, valid: false };
  if (sig.alg !== "ed25519") {
    return {
      unsigned: false,
      valid: false,
      reason: `Unsupported signature algorithm: ${sig.alg}`,
    };
  }
  if (typeof sig.publicKey !== "string" || typeof sig.signature !== "string") {
    return { unsigned: false, valid: false, reason: "Malformed _sig block" };
  }

  const { _sig: _, ...body } = m;
  void _;
  const payload = new TextEncoder().encode(canonicalStringify(body));

  try {
    // Raw ed25519 public keys are 32 bytes; WebCrypto imports them
    // via jwk { kty: "OKP", crv: "Ed25519", x: <base64url> }.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subtle = crypto.subtle as any;
    const pub = await subtle.importKey(
      "jwk",
      { kty: "OKP", crv: "Ed25519", x: sig.publicKey },
      "Ed25519",
      false,
      ["verify"],
    );
    const ok = await subtle.verify(
      "Ed25519",
      pub,
      base64urlDecode(sig.signature),
      payload,
    );
    return ok
      ? { unsigned: false, valid: true, publicKey: sig.publicKey }
      : {
          unsigned: false,
          valid: false,
          reason: "Signature did not verify against payload",
          publicKey: sig.publicKey,
        };
  } catch (err) {
    log.warn("verifyManifestSignature threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      unsigned: false,
      valid: false,
      reason: "Verification threw — likely malformed key or signature bytes",
    };
  }
}
