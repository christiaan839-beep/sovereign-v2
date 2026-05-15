/**
 * SOVEREIGN MATRIX — Anonymous replay-access credentials (Cook 136).
 *
 * External auditors (Big-4 partners, regulator examiners, internal
 * auditors of a peer tenant) need to replay a receipt without learning
 * which tenant produced it. This module issues short-lived capability
 * tokens that prove "the bearer is authorized to replay receipt R"
 * without exposing the tenant id to the verifier.
 *
 * Shape is BBS+-flavored — blind issuance + selective disclosure —
 * but implemented with HMAC-SHA256 over a domain-separated bundle so
 * we don't pull in a heavy pairing-curve dependency. Trade-off:
 * verification requires the issuer (or any holder of the group secret)
 * to validate, NOT a third party without the secret. Pure HMAC is fine
 * for Sovereign's auditor-replay use case because the verifier is
 * always the receipts-service itself (it MUST hold the group secret
 * to fetch the receipt body anyway).
 *
 * Pure module — caller persists the group secret rotation schedule.
 */

import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface CredentialIssueRequest {
  /** Issuer-side group secret. 32 bytes hex. */
  groupSecret: string;
  /** Receipt id this token grants replay access to. */
  receiptId: string;
  /** Auditor identifier — opaque to the verifier. */
  auditorId: string;
  /** Unix ms when the token stops being valid. */
  expiresAt: number;
  /** Optional binding to the receipt's tenant for issuer-side audit. */
  tenantId?: string;
  now?: number;
}

export interface AnonCredential {
  /** Receipt id the token grants access to. */
  receiptId: string;
  /** Hex auditor id (opaque to verifier; issuer uses it for forensic logs). */
  auditorId: string;
  /** Issuance time (unix ms). */
  issuedAt: number;
  /** Expiry time (unix ms). */
  expiresAt: number;
  /** Random salt — prevents two tokens for the same receipt looking alike. */
  nonce: string;
  /** Hex HMAC-SHA256 over the canonical bundle. */
  mac: string;
}

export interface VerifyRequest {
  groupSecret: string;
  credential: AnonCredential;
  /** The receipt id the auditor is trying to replay — must match. */
  receiptId: string;
  now?: number;
}

export type VerifyOutcome =
  | { ok: true }
  | { ok: false; reason: "expired" | "receipt-mismatch" | "bad-mac" };

// ── Helpers ───────────────────────────────────────────────────────────────

function canonical(c: {
  receiptId: string;
  auditorId: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
}): string {
  // Domain-separated to defend against cross-protocol attacks.
  return `anon-cred-v1|${c.receiptId}|${c.auditorId}|${c.issuedAt}|${c.expiresAt}|${c.nonce}`;
}

function macFor(groupSecret: string, body: string): string {
  return createHmac("sha256", Buffer.from(groupSecret, "hex"))
    .update(body)
    .digest("hex");
}

function constantTimeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a, "hex");
  const B = Buffer.from(b, "hex");
  if (A.length !== B.length) return false;
  return timingSafeEqual(A, B);
}

// ── Public API ────────────────────────────────────────────────────────────

/** Generate a fresh 32-byte group secret (hex). */
export function newGroupSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Issue a credential the auditor uses to replay one specific receipt.
 * The token itself is NOT a JWT — it's a tight HMAC bundle so any
 * forgery requires the group secret, and any tampering invalidates
 * the MAC.
 */
export function issueCredential(req: CredentialIssueRequest): AnonCredential {
  if (!/^[0-9a-f]{64}$/i.test(req.groupSecret)) {
    throw new Error("issueCredential: groupSecret must be 64 hex chars");
  }
  if (!req.receiptId) throw new Error("issueCredential: receiptId required");
  if (!req.auditorId) throw new Error("issueCredential: auditorId required");
  const now = req.now ?? Date.now();
  if (req.expiresAt <= now) {
    throw new Error("issueCredential: expiresAt must be in the future");
  }
  const nonce = randomBytes(16).toString("hex");
  const body = canonical({
    receiptId: req.receiptId,
    auditorId: req.auditorId,
    issuedAt: now,
    expiresAt: req.expiresAt,
    nonce,
  });
  return {
    receiptId: req.receiptId,
    auditorId: req.auditorId,
    issuedAt: now,
    expiresAt: req.expiresAt,
    nonce,
    mac: macFor(req.groupSecret, body),
  };
}

/**
 * Verify a credential. Returns ok:true only when: MAC matches AND the
 * receiptId in the credential matches the one being replayed AND now is
 * before expiry. Constant-time MAC comparison.
 */
export function verifyCredential(req: VerifyRequest): VerifyOutcome {
  const now = req.now ?? Date.now();
  if (req.credential.receiptId !== req.receiptId) {
    return { ok: false, reason: "receipt-mismatch" };
  }
  if (now >= req.credential.expiresAt) {
    return { ok: false, reason: "expired" };
  }
  const expected = macFor(
    req.groupSecret,
    canonical({
      receiptId: req.credential.receiptId,
      auditorId: req.credential.auditorId,
      issuedAt: req.credential.issuedAt,
      expiresAt: req.credential.expiresAt,
      nonce: req.credential.nonce,
    }),
  );
  if (!constantTimeEqual(expected, req.credential.mac)) {
    return { ok: false, reason: "bad-mac" };
  }
  return { ok: true };
}

/**
 * Anonymize an auditor id for audit logs without breaking the auditor's
 * ability to prove they were the holder. Returns a stable hex digest;
 * the auditor can reveal the preimage on dispute. Selective-disclosure
 * shape — verifier sees the digest, knows nothing else.
 */
export function anonymizeAuditor(auditorId: string, salt: string): string {
  return createHash("sha256").update(`${salt}|${auditorId}`).digest("hex");
}

/**
 * Rotate the group secret. Returns a NEW secret + a sunset window
 * during which both secrets must be accepted by the verifier. Caller
 * persists both, marks the old one read-only, and revokes after the
 * sunset elapses.
 */
export function rotateGroupSecret(args: {
  /** ms during which the old secret is still accepted. Default 7d. */
  sunsetMs?: number;
  now?: number;
}): { next: string; oldValidUntil: number } {
  const now = args.now ?? Date.now();
  const sunsetMs = args.sunsetMs ?? 7 * 24 * 60 * 60 * 1000;
  return {
    next: newGroupSecret(),
    oldValidUntil: now + sunsetMs,
  };
}
