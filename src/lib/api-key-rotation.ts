/**
 * SOVEREIGN MATRIX — API key rotation (Cook 125).
 *
 * Per-tenant API key lifecycle with overlapping validity windows so
 * a rotation NEVER breaks an in-flight call.
 *
 * Lifecycle:
 *   1. `mint(tenantId, label)` → cleartext shown ONCE + hash stored
 *   2. `rotate(tenantId, oldKeyId)` → mints new key, marks old as
 *      retiring with `gracePeriodMs` validity remaining
 *   3. `verify(cleartext)` → matches against ANY non-revoked key
 *      whose validity window covers `now`
 *   4. `revoke(keyId)` → immediate kill, no grace period
 *
 * Pure module. Hash-only storage (Cook 88 pattern), constant-time
 * compare.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export type KeyStatus = "active" | "retiring" | "revoked" | "expired";

export interface ApiKeyRecord {
  id: string;
  tenantId: string;
  label: string;
  hash: string;
  prefix: string;
  status: KeyStatus;
  createdAt: number;
  /** Time when retiring keys lose validity. Active keys: undefined. */
  retiresAt?: number;
  /** When revoke() was called. */
  revokedAt?: number;
  lastUsedAt?: number;
}

export interface RotationConfig {
  /** ms a retiring key remains valid after rotate(). Default 30 days. */
  gracePeriodMs: number;
}

const DEFAULTS: RotationConfig = {
  gracePeriodMs: 30 * 24 * 60 * 60 * 1000,
};

const TOKEN_PREFIX = "sk_apk_";
const TOKEN_BYTES = 32;

// ── Store ─────────────────────────────────────────────────────────────────

const STORE = new Map<string, ApiKeyRecord>();

export function _resetForTests(): void {
  STORE.clear();
}

// ── Helpers ───────────────────────────────────────────────────────────────

function hashOf(cleartext: string): string {
  return createHash("sha256").update(cleartext).digest("hex");
}

function generateKeyId(tenantId: string): string {
  return createHash("sha256")
    .update(`${tenantId}|${Date.now()}|${randomBytes(8).toString("hex")}`)
    .digest("hex")
    .slice(0, 24);
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Mint a fresh API key. Cleartext shown ONCE; only hash + prefix
 * persisted. Throws on missing tenantId / label.
 */
export function mint(args: { tenantId: string; label: string; now?: number }): {
  record: ApiKeyRecord;
  cleartext: string;
} {
  if (!args.tenantId) throw new Error("mint: tenantId required");
  if (!args.label || args.label.length > 80) {
    throw new Error("mint: label required, max 80 chars");
  }
  const random = randomBytes(TOKEN_BYTES).toString("base64url");
  const cleartext = `${TOKEN_PREFIX}${random}`;
  const id = generateKeyId(args.tenantId);
  const record: ApiKeyRecord = {
    id,
    tenantId: args.tenantId,
    label: args.label,
    hash: hashOf(cleartext),
    prefix: cleartext.slice(0, 12),
    status: "active",
    createdAt: args.now ?? Date.now(),
  };
  STORE.set(id, record);
  return { record, cleartext };
}

/**
 * Rotate a key: mint a new one + mark the old as `retiring` for the
 * grace window. Returns BOTH records so the caller can hand back the
 * new cleartext + remind the user of the retire deadline.
 */
export function rotate(args: {
  oldKeyId: string;
  newLabel?: string;
  now?: number;
  config?: Partial<RotationConfig>;
}): {
  retiring: ApiKeyRecord;
  fresh: { record: ApiKeyRecord; cleartext: string };
} {
  const old = STORE.get(args.oldKeyId);
  if (!old) throw new Error("rotate: oldKeyId not found");
  if (old.status === "revoked" || old.status === "expired") {
    throw new Error(`rotate: cannot rotate ${old.status} key`);
  }
  const now = args.now ?? Date.now();
  const cfg = { ...DEFAULTS, ...(args.config ?? {}) };
  old.status = "retiring";
  old.retiresAt = now + cfg.gracePeriodMs;
  const fresh = mint({
    tenantId: old.tenantId,
    label: args.newLabel ?? `${old.label} (rotated)`,
    now,
  });
  return { retiring: old, fresh };
}

/** Immediate kill — no grace period. */
export function revoke(id: string, now: number = Date.now()): boolean {
  const rec = STORE.get(id);
  if (!rec) return false;
  rec.status = "revoked";
  rec.revokedAt = now;
  return true;
}

/**
 * Verify a cleartext token against the store. Scans every key in
 * constant time per key. Returns the matching record OR null.
 *
 * Time-window enforcement: retiring keys are valid until retiresAt;
 * expired/revoked keys are never valid.
 */
export function verify(
  cleartext: string,
  now: number = Date.now(),
): ApiKeyRecord | null {
  if (!cleartext.startsWith(TOKEN_PREFIX)) return null;
  const incoming = hashOf(cleartext);
  const incomingBuf = Buffer.from(incoming, "hex");
  let match: ApiKeyRecord | null = null;
  for (const rec of STORE.values()) {
    const storedBuf = Buffer.from(rec.hash, "hex");
    if (storedBuf.length === incomingBuf.length) {
      if (timingSafeEqual(storedBuf, incomingBuf)) {
        match = rec;
      }
    }
  }
  if (!match) return null;
  if (match.status === "revoked") return null;
  if (match.status === "retiring") {
    if (match.retiresAt === undefined || match.retiresAt < now) {
      match.status = "expired";
      return null;
    }
  }
  if (match.status === "expired") return null;
  match.lastUsedAt = now;
  return match;
}

/** List keys for a tenant (hash-only — never returns cleartext). */
export function listFor(tenantId: string): ApiKeyRecord[] {
  return [...STORE.values()]
    .filter((r) => r.tenantId === tenantId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export const API_KEY_CONSTANTS = {
  TOKEN_PREFIX,
  DEFAULT_GRACE_PERIOD_MS: DEFAULTS.gracePeriodMs,
};
