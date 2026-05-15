/**
 * SOVEREIGN MATRIX — Personal Access Token store (Cook 88).
 *
 * Hash-only persistence — the cleartext token is shown to the user
 * exactly ONCE at creation time and never stored. Verification
 * compares SHA-256 hashes in constant time.
 *
 * Persistence: in-memory until migration 0021 brings the
 * `personalAccessTokens` table online. The shape mirrors what the
 * persistent table will hold so the swap is a 20-line PR.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";

export interface PatRecord {
  id: string;
  userId: string;
  label: string;
  /** Hex SHA-256 of the issued token. */
  hash: string;
  /** Only the first 8 chars of the cleartext, for display. */
  prefix: string;
  createdAt: number;
  /** Last time this PAT successfully authenticated. */
  lastUsedAt?: number;
  /** Optional ISO expiry. */
  expiresAt?: number;
}

const STORE = new Map<string, PatRecord>();

const TOKEN_PREFIX = "sk_pat_";
const TOKEN_BYTES = 32;

/** Generate a fresh token + hash. Token is shown once to the caller. */
export function issue(opts: {
  userId: string;
  label: string;
  ttlMs?: number;
}): { record: PatRecord; cleartext: string } {
  if (!opts.userId || !opts.label) {
    throw new Error("issue: userId + label are required");
  }
  if (opts.label.length > 80) {
    throw new Error("issue: label must be ≤ 80 chars");
  }
  const random = randomBytes(TOKEN_BYTES).toString("base64url");
  const cleartext = `${TOKEN_PREFIX}${random}`;
  const hash = createHash("sha256").update(cleartext).digest("hex");
  const id = createHash("sha256")
    .update(`pat|${opts.userId}|${Date.now()}|${random.slice(0, 6)}`)
    .digest("hex")
    .slice(0, 24);
  const record: PatRecord = {
    id,
    userId: opts.userId,
    label: opts.label,
    hash,
    prefix: cleartext.slice(0, 12),
    createdAt: Date.now(),
    ...(opts.ttlMs ? { expiresAt: Date.now() + opts.ttlMs } : {}),
  };
  STORE.set(id, record);
  return { record, cleartext };
}

/** List the caller's PATs (hash-only, never returns cleartext). */
export function listFor(userId: string): PatRecord[] {
  const out: PatRecord[] = [];
  for (const rec of STORE.values()) {
    if (rec.userId === userId) out.push(rec);
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

/** Revoke a PAT by id. Returns true if revoked. */
export function revoke(id: string, userId: string): boolean {
  const rec = STORE.get(id);
  if (!rec || rec.userId !== userId) return false;
  STORE.delete(id);
  return true;
}

/**
 * Constant-time verify a cleartext token against the store.
 * Updates lastUsedAt on success. Returns the matching record or null.
 */
export function verify(cleartext: string): PatRecord | null {
  if (!cleartext || !cleartext.startsWith(TOKEN_PREFIX)) return null;
  const incoming = createHash("sha256").update(cleartext).digest("hex");
  const incomingBuf = Buffer.from(incoming, "hex");
  let match: PatRecord | null = null;
  // Scan every record in constant time per record. We CANNOT early-
  // return on length mismatch because the loop is what makes the
  // comparison timing-safe — bail-outs leak length-class info.
  for (const rec of STORE.values()) {
    const storedBuf = Buffer.from(rec.hash, "hex");
    if (storedBuf.length === incomingBuf.length) {
      // Side-effect-free compare. Capture the result without branching
      // on it until the loop completes.
      if (timingSafeEqual(storedBuf, incomingBuf)) {
        match = rec;
      }
    }
  }
  if (!match) return null;
  if (match.expiresAt && match.expiresAt < Date.now()) return null;
  match.lastUsedAt = Date.now();
  return match;
}

/** Test-only reset hook. */
export function _resetForTests(): void {
  STORE.clear();
}
