/**
 * SOVEREIGN MATRIX — Receipt chain ratchet (Cook 94).
 *
 * Forward-secret HMAC signing: each receipt's signing key is derived
 * from the previous one, so a leaked key only forges receipts AFTER
 * the leak — never before. The ratchet itself is the unconditionally
 * audit-friendly version of "key rotation" because the rotation
 * cadence is per-receipt, not per-quarter.
 *
 * Construction (HKDF-style):
 *
 *   k₀ = HMAC(rootKey, "epoch-0")
 *   k_{n+1} = HMAC(k_n, "ratchet")
 *   signature_n = HMAC(k_n, canonical(receipt_n))
 *
 * The verifier needs k_n (NOT the root) and the receipt index n. A
 * leaked k_n compromises every k_m for m ≥ n; receipts m < n stay
 * unforgeable because HMAC is one-way under a fresh key.
 */

import { createHmac, timingSafeEqual } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface RatchetEpoch {
  index: number;
  /** Hex-encoded 32-byte derived key. */
  key: string;
}

export interface RatchetState {
  current: RatchetEpoch;
}

// ── Derivation ────────────────────────────────────────────────────────────

const RATCHET_INFO = Buffer.from("ratchet");
const EPOCH_ZERO_INFO = Buffer.from("epoch-0");

function derive(prevHex: string, info: Buffer): string {
  return createHmac("sha256", Buffer.from(prevHex, "hex"))
    .update(info)
    .digest("hex");
}

/** Initialize the ratchet from a root key. Returns epoch 0. */
export function initRatchet(rootKey: string): RatchetState {
  if (!rootKey) throw new Error("initRatchet: rootKey is required");
  const rootBuf = Buffer.from(rootKey, "utf8");
  const k0 = createHmac("sha256", rootBuf)
    .update(EPOCH_ZERO_INFO)
    .digest("hex");
  return { current: { index: 0, key: k0 } };
}

/** Advance the ratchet forward; returns the new state + the previous epoch. */
export function advance(state: RatchetState): {
  next: RatchetState;
  previous: RatchetEpoch;
} {
  const previous = state.current;
  const k1 = derive(previous.key, RATCHET_INFO);
  return {
    next: { current: { index: previous.index + 1, key: k1 } },
    previous,
  };
}

// ── Signing + verification ────────────────────────────────────────────────

export interface SignedReceipt {
  index: number;
  signature: string;
}

/** Sign a canonical payload under the current epoch key. */
export function signWithEpoch(
  state: RatchetState,
  canonical: string,
): SignedReceipt {
  const signature = createHmac("sha256", Buffer.from(state.current.key, "hex"))
    .update(canonical)
    .digest("hex");
  return { index: state.current.index, signature };
}

/** Verify a signature against the explicit epoch key. */
export function verifyWithEpoch(
  epoch: RatchetEpoch,
  canonical: string,
  signature: string,
): boolean {
  if (epoch.index < 0) return false;
  const expected = createHmac("sha256", Buffer.from(epoch.key, "hex"))
    .update(canonical)
    .digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Reach a specific epoch from a root key without storing intermediates.
 * Used by the verifier when it only has the root + index.
 */
export function reachEpoch(rootKey: string, index: number): RatchetEpoch {
  if (index < 0) throw new Error("reachEpoch: index must be ≥ 0");
  let state = initRatchet(rootKey);
  for (let i = 0; i < index; i++) {
    state = advance(state).next;
  }
  return state.current;
}
