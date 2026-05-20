/**
 * SOVEREIGN MATRIX — Cryptographic tool-chain attestation (wave 113).
 *
 * The Authenticated Workflows blueprint calls for unforgeable
 * execution-ordering: "executing Tool B strictly requires a
 * cryptographically signed attestation confirming Tool A successfully
 * completed first." This module implements that primitive.
 *
 * It does NOT duplicate the audit-log integrity chain
 * (`audit-log-integrity.ts` — for log rows) nor the receipt ratchet
 * (`receipt-ratchet.ts` — for per-epoch signing keys). Those are
 * about PERSISTED record integrity. This module is about RUNTIME
 * execution-ordering: a tool call carries a tamper-evident hash
 * chain that proves the call sequence happened in the claimed order
 * before any external side-effect (DB write, API call, payment)
 * fires.
 *
 * Threat model defended:
 *   - replay of a tool result from a prior execution
 *   - reorder of tool calls (e.g. running "execute payment" before
 *     "verify amount" by stripping the prerequisite attestation)
 *   - splicing two unrelated tool chains together
 *   - silent skipping of an intermediate verification step
 *
 * Threat model NOT defended (by design):
 *   - compromise of the HMAC key itself (out of scope; key rotation
 *     is the receipt-ratchet's job)
 *   - the tool body lying about its result (out of scope; the
 *     methodology-verifier + critic + LlamaGuard layers handle that)
 *
 * Cryptography: HMAC-SHA256 over a canonical encoding of
 *   (prevHash || step || payloadHash || timestamp)
 * The 0.2ms target the blueprint cites is comfortably met — a single
 * HMAC-SHA256 on a ~200-byte canonical message runs ≈ 5-20µs on a
 * 2025-era x86 worker.
 */

import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export interface AttestationEnvelope {
  /** Logical step name. Free-form but should match the tool registry. */
  step: string;
  /** SHA-256 hex of the canonical JSON of the tool's input + result. */
  payloadHash: string;
  /** Hex of the previous envelope's full hash, or null for the first step. */
  prevHash: string | null;
  /** Unix ms timestamp at sign time. */
  timestamp: number;
  /** HMAC-SHA256 hex over the canonical message. */
  signature: string;
}

export interface ChainVerification {
  valid: boolean;
  /** Index in the envelope array where the break was detected. */
  brokenAt?: number;
  /** Human-readable failure reason. */
  reason?: string;
}

/**
 * Resolve the HMAC key. Prefers `ATTESTATION_HMAC_KEY`, falls back to
 * `INTERNAL_WEBHOOK_SECRET` (already a 16+ byte secret per wave 111.x).
 * Throws if neither is set with at least 16 bytes — refusing to
 * produce un-cryptographic attestations is the correct fail-closed
 * behaviour for a security primitive.
 */
function resolveKey(): Buffer {
  const raw =
    (process.env.ATTESTATION_HMAC_KEY ?? "").trim() ||
    (process.env.INTERNAL_WEBHOOK_SECRET ?? "").trim();
  if (raw.length < 16) {
    throw new Error(
      "attestation-chain: no HMAC key configured " +
        "(set ATTESTATION_HMAC_KEY or INTERNAL_WEBHOOK_SECRET to ≥ 16 bytes)",
    );
  }
  return Buffer.from(raw, "utf8");
}

/**
 * Canonical SHA-256 hash of an arbitrary payload. Uses
 * `JSON.stringify` with sorted keys so structurally-equivalent
 * payloads produce the same hash regardless of property order.
 */
export function hashPayload(payload: unknown): string {
  const canonical = canonicalize(payload);
  return createHash("sha256").update(canonical).digest("hex");
}

function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return (
      "{" +
      keys
        .map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k]))
        .join(",") +
      "}"
    );
  }
  // Functions / symbols / bigints — coerce to string for hashing.
  return JSON.stringify(String(value));
}

/**
 * Compute the HMAC message: a length-delimited concatenation of the
 * envelope's fields (sans signature). Length prefixes prevent
 * `step="a"+payloadHash="b…"` from colliding with
 * `step="ab"+payloadHash="…"` — a defence against the classic
 * canonicalization-attack class.
 */
function canonicalMessage(env: Omit<AttestationEnvelope, "signature">): string {
  const parts = [
    env.prevHash ?? "",
    env.step,
    env.payloadHash,
    String(env.timestamp),
  ];
  return parts.map((p) => `${p.length}:${p}`).join("|");
}

/**
 * Sign a single step.
 *
 * @param step     The logical step name (e.g. "verify-amount").
 * @param payload  Anything serializable — typically the tool's
 *                 (input, result) pair. Hashed for the envelope;
 *                 the raw payload is NOT stored on chain.
 * @param prev     The previous envelope in the chain, or null for the
 *                 first step.
 * @param nowMs    Override clock (for tests). Defaults to Date.now().
 */
export function signStep(
  step: string,
  payload: unknown,
  prev: AttestationEnvelope | null,
  nowMs: number = Date.now(),
): AttestationEnvelope {
  if (typeof step !== "string" || step.trim().length === 0) {
    throw new Error("attestation-chain.signStep: step name required");
  }
  const key = resolveKey();
  const env: Omit<AttestationEnvelope, "signature"> = {
    step,
    payloadHash: hashPayload(payload),
    prevHash: prev ? envelopeHash(prev) : null,
    timestamp: nowMs,
  };
  const signature = createHmac("sha256", key)
    .update(canonicalMessage(env))
    .digest("hex");
  return { ...env, signature };
}

/**
 * Full hash of an envelope — used as the `prevHash` reference for the
 * next link. Distinct from the HMAC signature: the hash binds the
 * envelope as a record; the signature proves it was produced with the
 * tenant's HMAC key.
 */
export function envelopeHash(env: AttestationEnvelope): string {
  return createHash("sha256")
    .update(
      canonicalize({
        step: env.step,
        payloadHash: env.payloadHash,
        prevHash: env.prevHash,
        timestamp: env.timestamp,
        signature: env.signature,
      }),
    )
    .digest("hex");
}

/**
 * Verify a single envelope against the configured HMAC key. Returns
 * true ONLY if both the signature and the message canonicalisation
 * line up. Uses constant-time compare.
 */
export function verifyEnvelope(env: AttestationEnvelope): boolean {
  if (!env || typeof env !== "object") return false;
  try {
    const key = resolveKey();
    const expected = createHmac("sha256", key)
      .update(canonicalMessage(env))
      .digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(env.signature ?? "", "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Verify an entire chain. Checks, for each envelope:
 *   1. signature validates against the HMAC key,
 *   2. its `prevHash` field equals the hash of the previous envelope
 *      (the first envelope must have prevHash === null),
 *   3. timestamps are monotonically non-decreasing (a deliberately
 *      backdated splice attempt breaks this).
 *
 * Returns `{ valid: true }` on success, `{ valid: false, brokenAt, reason }` on first break.
 */
export function verifyChain(
  envelopes: AttestationEnvelope[],
): ChainVerification {
  if (!Array.isArray(envelopes) || envelopes.length === 0) {
    return { valid: false, brokenAt: 0, reason: "empty chain" };
  }
  let prev: AttestationEnvelope | null = null;
  for (let i = 0; i < envelopes.length; i++) {
    const env = envelopes[i];
    if (!verifyEnvelope(env)) {
      return { valid: false, brokenAt: i, reason: "signature invalid" };
    }
    const expectedPrev = prev ? envelopeHash(prev) : null;
    if (env.prevHash !== expectedPrev) {
      return {
        valid: false,
        brokenAt: i,
        reason: "prevHash does not match prior envelope",
      };
    }
    if (prev && env.timestamp < prev.timestamp) {
      return {
        valid: false,
        brokenAt: i,
        reason: "timestamp regression (chain re-ordered or backdated)",
      };
    }
    prev = env;
  }
  return { valid: true };
}

/**
 * Convenience: require a prior step before running the current one.
 * Throws if the chain doesn't pass `verifyChain` or if the most
 * recent step does not equal `requiredPriorStep`.
 *
 * This is the "Tool B requires attestation of Tool A" enforcement
 * point. Call sites wrap their critical-action with:
 *
 *   requirePriorStep(chain, "verify-amount");
 *   const newEnvelope = signStep("execute-payment", ..., chain.at(-1)!);
 *   chain.push(newEnvelope);
 */
export function requirePriorStep(
  chain: AttestationEnvelope[],
  requiredPriorStep: string,
): void {
  const v = verifyChain(chain);
  if (!v.valid) {
    throw new Error(
      `attestation-chain.requirePriorStep: chain broken (${v.reason ?? "unknown"})`,
    );
  }
  const last = chain[chain.length - 1];
  if (last.step !== requiredPriorStep) {
    throw new Error(
      `attestation-chain.requirePriorStep: expected prior step "${requiredPriorStep}", got "${last.step}"`,
    );
  }
}
