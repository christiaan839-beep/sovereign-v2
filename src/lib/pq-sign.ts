/**
 * SOVEREIGN MATRIX — Post-quantum dual-signing (audit-2026-05).
 *
 * Wire-stable extension to the receipt signing scheme that co-signs
 * every canonical projection with Ed25519 (v2) AND ML-DSA-65 (v3,
 * NIST-standardised Dilithium3 from FIPS 204).
 *
 * Why now: clinical-trial and tax-audit verticals retain receipts for
 * 7-25 years. That's well past the harvest-now-decrypt-later horizon
 * for store-and-replay attacks on Ed25519 once a cryptographically-
 * relevant quantum computer ships. Dual-signing today makes those
 * receipts forward-secure: a verifier in 2040 can re-check the ML-DSA
 * signature using only the public key, even if Ed25519 has fallen.
 *
 * Wire format (extends the v2 scheme in agent-runs.ts):
 *   v2=<base64-ed25519>            ← Ed25519-only (current default)
 *   v3=<base64-ed25519>.<base64-mldsa65>  ← dual-signed (this module)
 *
 * Verifiers must accept v2 indefinitely (historical receipts) AND v3
 * (forward-secure receipts). The `verifyDualSig` helper handles both.
 *
 * Configuration:
 *   AGENT_RUN_ED25519_PRIVATE_KEY     ← existing (PEM)
 *   AGENT_RUN_MLDSA65_PRIVATE_KEY     ← NEW (base64 of 4032-byte secret)
 *   AGENT_RUN_MLDSA65_PUBLIC_KEY      ← NEW (base64 of 1952-byte pubkey)
 *
 * Generate a Dilithium3 keypair with:
 *   import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
 *   const { secretKey, publicKey } = ml_dsa65.keygen();
 *   Buffer.from(secretKey).toString("base64") // → env var
 *   Buffer.from(publicKey).toString("base64") // → env var + /.well-known
 */

import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { createLogger } from "@/lib/logger";

const log = createLogger("pq-sign");

// ── Configuration loader ──────────────────────────────────────────

let cachedSecretKey: Uint8Array | null = null;
let cachedPublicKey: Uint8Array | null = null;
let cachedSecretB64: string | null = null;

function loadKeys(): {
  secretKey: Uint8Array | null;
  publicKey: Uint8Array | null;
} {
  const secretB64 = process.env.AGENT_RUN_MLDSA65_PRIVATE_KEY;
  const publicB64 = process.env.AGENT_RUN_MLDSA65_PUBLIC_KEY;

  if (!secretB64 || !publicB64) {
    return { secretKey: null, publicKey: null };
  }
  // Memoise — base64 decode is cheap but no need to repeat per call.
  if (cachedSecretB64 === secretB64 && cachedSecretKey && cachedPublicKey) {
    return { secretKey: cachedSecretKey, publicKey: cachedPublicKey };
  }
  try {
    cachedSecretKey = Uint8Array.from(Buffer.from(secretB64, "base64"));
    cachedPublicKey = Uint8Array.from(Buffer.from(publicB64, "base64"));
    cachedSecretB64 = secretB64;
    return { secretKey: cachedSecretKey, publicKey: cachedPublicKey };
  } catch (err) {
    log.warn("pq-sign keys are present but malformed — disabling PQ branch", {
      error: err instanceof Error ? err.message : String(err),
    });
    cachedSecretKey = null;
    cachedPublicKey = null;
    return { secretKey: null, publicKey: null };
  }
}

/**
 * True iff Dilithium3 dual-signing is configured. Callers can use this
 * to advertise PQ-readiness in receipt envelopes and on /trust.
 */
export function isPqDualSignEnabled(): boolean {
  const { secretKey, publicKey } = loadKeys();
  return secretKey !== null && publicKey !== null;
}

/**
 * Sign canonical bytes with ML-DSA-65 (Dilithium3). Returns the
 * base64-encoded signature, or null when keys are not configured.
 */
export function signMlDsa65(canonical: string): string | null {
  const { secretKey } = loadKeys();
  if (!secretKey) return null;
  // Noble API: sign(msg, secretKey) — argument order matters.
  const sig = ml_dsa65.sign(Buffer.from(canonical, "utf8"), secretKey);
  return Buffer.from(sig).toString("base64");
}

/**
 * Verify an ML-DSA-65 signature against canonical bytes. Returns false
 * when keys are not configured (a verifier without the public key
 * cannot accept any PQ signature — explicit rather than implicit).
 */
export function verifyMlDsa65(
  canonical: string,
  signatureB64: string,
): boolean {
  const { publicKey } = loadKeys();
  if (!publicKey) return false;
  let sigBytes: Uint8Array;
  try {
    sigBytes = Uint8Array.from(Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
  try {
    // Noble API: verify(sig, msg, pubKey).
    return ml_dsa65.verify(sigBytes, Buffer.from(canonical, "utf8"), publicKey);
  } catch {
    return false;
  }
}

/**
 * Verify a dual-signature in the v3 wire format
 * (`v3=<ed25519-b64>.<mldsa65-b64>`). Both signatures must validate
 * for the receipt to be accepted as forward-secure. Use this in /api/
 * verify when the env signals PQ enforcement is on.
 *
 * `verifyEd25519` is a caller-supplied function so this module stays
 * decoupled from agent-runs.ts (the current Ed25519 verifier lives
 * there) and the cycle stays clean.
 */
export function verifyDualSig(
  canonical: string,
  wire: string,
  verifyEd25519: (canonical: string, signature: string) => boolean,
): { ok: boolean; ed25519: boolean; mldsa65: boolean } {
  if (!wire.startsWith("v3=")) {
    return { ok: false, ed25519: false, mldsa65: false };
  }
  const body = wire.slice(3);
  const parts = body.split(".");
  if (parts.length !== 2) {
    return { ok: false, ed25519: false, mldsa65: false };
  }
  const [edB64, mlB64] = parts;
  const ed = verifyEd25519(canonical, `v2=${edB64}`);
  const ml = verifyMlDsa65(canonical, mlB64);
  return { ok: ed && ml, ed25519: ed, mldsa65: ml };
}

/**
 * Format a v3 signature wire string from raw base64-encoded components.
 * Pure string composer — kept here so the wire layout has a single
 * definition site.
 */
export function formatV3Wire(ed25519B64: string, mldsa65B64: string): string {
  return `v3=${ed25519B64}.${mldsa65B64}`;
}
