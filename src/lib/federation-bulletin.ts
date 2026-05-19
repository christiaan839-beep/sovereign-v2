/**
 * SOVEREIGN MATRIX — Federation attack-signature bulletins (wave 99).
 *
 * Publishes signed, TTL-bounded, non-PII attack fingerprints that any
 * federation member can consume to harden their own deployment. The
 * design embodies the ethics constraints documented in wave 99:
 *
 *   - TTL-bounded (default 24h, max 7d) — no permanent blacklists.
 *   - Non-PII (uses TLS JA4 + UA digest + path digest, NEVER raw IPs).
 *   - Signed (ML-DSA-65 when key configured) — recipients verify the
 *     contributing member actually authored the bulletin.
 *   - Public audit trail (persisted to audit_logs with action
 *     `honeypot.bulletin`) — every emitted bulletin is discoverable.
 *   - Network-effect compounds defensively: 100 members × 1 attacker =
 *     100 deployments hardened per attack instance.
 *
 * Wire schema: `vaos-honeypot-bulletin-v1`.
 *
 * This module is the BROADCAST LAYER only. The actual decoy endpoint
 * (the "honeypot" itself) is a separate operator deployment decision
 * with its own ethics review — most production deployments will
 * CONSUME bulletins without operating a decoy.
 */

import { createHash } from "node:crypto";
import { auditLog } from "@/lib/audit-log";
import { signMlDsa65, isPqDualSignEnabled } from "@/lib/pq-sign";
import { createLogger } from "@/lib/logger";
import {
  canonicalizeFingerprint,
  fingerprintId,
  type AttackFingerprint,
} from "@/lib/attack-fingerprint";

const log = createLogger("federation-bulletin");

export const BULLETIN_SCHEMA = "vaos-honeypot-bulletin-v1";

/** Default TTL 24h. Hard cap 7d — no permanent blacklists. */
export const DEFAULT_TTL_HOURS = 24;
export const MAX_TTL_HOURS = 24 * 7;

/** Hard cap on the fingerprint list per bulletin (bounds row size). */
export const MAX_FINGERPRINTS_PER_BULLETIN = 100;

export interface FederationBulletin {
  schema: typeof BULLETIN_SCHEMA;
  /** ISO-8601 when this bulletin was assembled. */
  issuedAt: string;
  /** ISO-8601 when bulletin entries auto-expire from active feeds. */
  expiresAt: string;
  /**
   * Issuer id — the federation member that authored this bulletin.
   * Stable identifier (e.g. "sovereign-prod"). Recipients fetch the
   * issuer's public key from the federation registry to verify the
   * mldsa65Sig below.
   */
  issuerId: string;
  /** The fingerprints batched into this bulletin. */
  fingerprints: AttackFingerprint[];
  /**
   * sha256 hex of the canonical projection of the fingerprints array.
   * Verifiers recompute to confirm no fingerprint was added/removed
   * after signing.
   */
  contentHash: string;
  /** ML-DSA-65 signature over canonical bytes; null when no key set. */
  mldsa65Sig: string | null;
  pqEnabled: boolean;
}

/** Canonical bytes that any verifier must reproduce identically. */
export function canonicalizeBulletin(
  b: Omit<FederationBulletin, "mldsa65Sig" | "pqEnabled">,
): string {
  // Fingerprints sorted by fingerprintId so the bulletin canonical is
  // independent of the order the contributing source happened to emit.
  const sortedFingerprints = [...b.fingerprints]
    .map((f) => ({ id: fingerprintId(f), f }))
    .sort((a, b2) => (a.id < b2.id ? -1 : a.id > b2.id ? 1 : 0))
    .map((entry) => JSON.parse(canonicalizeFingerprint(entry.f)));
  return JSON.stringify({
    schema: b.schema,
    issuedAt: b.issuedAt,
    expiresAt: b.expiresAt,
    issuerId: b.issuerId,
    fingerprints: sortedFingerprints,
    contentHash: b.contentHash,
  });
}

/** sha256 over the sorted fingerprints — tampering tripwire. */
export function contentHashOf(fingerprints: AttackFingerprint[]): string {
  const sortedIds = fingerprints
    .map((f) => fingerprintId(f))
    .sort()
    .join(",");
  return createHash("sha256").update(sortedIds, "utf8").digest("hex");
}

export interface BuildBulletinInput {
  issuerId: string;
  fingerprints: AttackFingerprint[];
  ttlHours?: number;
}

/**
 * Assemble + sign a federation bulletin. Validates the input set:
 *   - Caps fingerprint count at MAX_FINGERPRINTS_PER_BULLETIN
 *   - Clamps TTL into [1, MAX_TTL_HOURS]
 *   - Rejects empty issuerId
 *
 * Pure synchronous construction — no I/O. Caller persists with
 * `persistBulletin` separately so dry-run + offline signing are
 * supported.
 */
export function buildBulletin(input: BuildBulletinInput): FederationBulletin {
  if (!input.issuerId || input.issuerId.trim().length === 0) {
    throw new Error("buildBulletin: issuerId is required");
  }
  if (!Array.isArray(input.fingerprints)) {
    throw new Error("buildBulletin: fingerprints must be an array");
  }
  if (input.fingerprints.length === 0) {
    throw new Error("buildBulletin: at least one fingerprint required");
  }
  if (input.fingerprints.length > MAX_FINGERPRINTS_PER_BULLETIN) {
    throw new Error(
      `buildBulletin: fingerprint count ${input.fingerprints.length} exceeds MAX ${MAX_FINGERPRINTS_PER_BULLETIN}`,
    );
  }

  const ttlHours = Math.max(
    1,
    Math.min(MAX_TTL_HOURS, Math.round(input.ttlHours ?? DEFAULT_TTL_HOURS)),
  );

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + ttlHours * 3600 * 1000);

  const unsigned: Omit<FederationBulletin, "mldsa65Sig" | "pqEnabled"> = {
    schema: BULLETIN_SCHEMA,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    issuerId: input.issuerId,
    fingerprints: input.fingerprints,
    contentHash: contentHashOf(input.fingerprints),
  };

  const canonical = canonicalizeBulletin(unsigned);
  let mldsa65Sig: string | null = null;
  try {
    mldsa65Sig = signMlDsa65(canonical);
  } catch (err) {
    log.warn("bulletin ML-DSA-65 sign failed", { error: String(err) });
  }

  // Wave-99 security review M4: pqEnabled must reflect ACTUAL signature
  // presence, not just configuration intent. Otherwise the bulletin
  // advertises PQ-ready while carrying no signature (key file missing,
  // signing throws, etc.) — confusing for consumers and a foot-gun for
  // verifier contracts. Honest reporting: pqEnabled iff a real sig
  // landed in the envelope.
  return {
    ...unsigned,
    mldsa65Sig,
    pqEnabled: isPqDualSignEnabled() && mldsa65Sig !== null,
  };
}

export interface PersistBulletinResult {
  persisted: boolean;
  bulletinId: string;
}

/**
 * Persist a signed bulletin to audit_logs for the public feed
 * endpoint to read. Best-effort — never throws.
 *
 * Audit row shape:
 *   userId  = "system"
 *   action  = "honeypot.bulletin"
 *   resource = `bulletin:<issuerId>:<contentHash>`
 *   details  = full FederationBulletin envelope
 */
export async function persistBulletin(
  b: FederationBulletin,
): Promise<PersistBulletinResult> {
  const bulletinId = `${b.issuerId}:${b.contentHash}`;
  try {
    await auditLog({
      userId: "system",
      action: "honeypot.bulletin",
      resource: `bulletin:${bulletinId}`,
      details: {
        schema: b.schema,
        issuedAt: b.issuedAt,
        expiresAt: b.expiresAt,
        issuerId: b.issuerId,
        fingerprints: b.fingerprints,
        contentHash: b.contentHash,
        mldsa65Sig: b.mldsa65Sig,
        pqEnabled: b.pqEnabled,
      },
    });
    return { persisted: true, bulletinId };
  } catch (err) {
    log.error("bulletin persist failed", {
      bulletinId,
      error: String(err),
    });
    return { persisted: false, bulletinId };
  }
}

/**
 * Filter a list of bulletins to those still within their TTL. Used
 * by the public feed endpoint to suppress expired entries — TTLs are
 * a HARD ethics constraint, not a hint.
 */
export function activeBulletins(
  list: FederationBulletin[],
  now: Date = new Date(),
): FederationBulletin[] {
  const nowMs = now.getTime();
  return list.filter((b) => new Date(b.expiresAt).getTime() > nowMs);
}
