/**
 * SOVEREIGN MATRIX — HTTP response cache (Cook 129).
 *
 * GET/POST response cache for read-heavy endpoints (/agents,
 * /trust, /api/case-studies). LRU with TTL, stale-while-revalidate
 * window, ETag round-trip support, vary-by-headers for per-tenant
 * caching.
 *
 * Pure module — caller wires the cache around any handler that
 * derives output purely from URL + headers (NOT from request body
 * mutations).
 */

import { createHash } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface CachedResponse {
  body: string;
  status: number;
  contentType: string;
  etag: string;
  createdAt: number;
  /** Cache-only — not sent over the wire. */
  size: number;
}

export interface CacheKey {
  url: string;
  method: string;
  varyHeaders: Record<string, string>;
}

export interface CacheConfig {
  /** Max entries. Default 1000. */
  maxEntries: number;
  /** Fresh TTL in ms. Default 60_000. */
  freshMs: number;
  /** Stale-while-revalidate window in ms. Default 300_000. */
  swrMs: number;
  /** Max single-response body size. Default 256 KB. */
  maxBodyBytes: number;
}

export type CacheOutcome =
  | { kind: "fresh"; cached: CachedResponse }
  | { kind: "stale"; cached: CachedResponse }
  | { kind: "miss" };

const DEFAULTS: CacheConfig = {
  maxEntries: 1000,
  freshMs: 60_000,
  swrMs: 300_000,
  maxBodyBytes: 256 * 1024,
};

// ── Store ─────────────────────────────────────────────────────────────────

const STORE = new Map<string, CachedResponse>();
let totalSize = 0;

export function _resetForTests(): void {
  STORE.clear();
  totalSize = 0;
}

// ── Key derivation ───────────────────────────────────────────────────────

export function deriveKey(key: CacheKey): string {
  const varyParts = Object.keys(key.varyHeaders)
    .sort()
    .map((h) => `${h.toLowerCase()}=${key.varyHeaders[h]}`)
    .join("|");
  return createHash("sha256")
    .update(`${key.method}|${key.url}|${varyParts}`)
    .digest("hex");
}

export function deriveEtag(body: string): string {
  return `"${createHash("sha256").update(body).digest("hex").slice(0, 32)}"`;
}

// ── Lookup ────────────────────────────────────────────────────────────────

export function lookup(
  key: CacheKey,
  config: Partial<CacheConfig> = {},
  now: number = Date.now(),
): CacheOutcome {
  const cfg = { ...DEFAULTS, ...config };
  const k = deriveKey(key);
  const cached = STORE.get(k);
  if (!cached) return { kind: "miss" };
  const age = now - cached.createdAt;
  if (age < cfg.freshMs) {
    // Promote on access (LRU touch).
    STORE.delete(k);
    STORE.set(k, cached);
    return { kind: "fresh", cached };
  }
  if (age < cfg.freshMs + cfg.swrMs) {
    return { kind: "stale", cached };
  }
  // Past stale window — evict + miss.
  STORE.delete(k);
  totalSize -= cached.size;
  return { kind: "miss" };
}

// ── Store ────────────────────────────────────────────────────────────────

export function put(
  key: CacheKey,
  response: { body: string; status: number; contentType: string },
  config: Partial<CacheConfig> = {},
  now: number = Date.now(),
): CachedResponse | null {
  const cfg = { ...DEFAULTS, ...config };
  const size = new TextEncoder().encode(response.body).byteLength;
  if (size > cfg.maxBodyBytes) return null;
  const k = deriveKey(key);
  const old = STORE.get(k);
  if (old) {
    totalSize -= old.size;
    STORE.delete(k);
  }
  const entry: CachedResponse = {
    body: response.body,
    status: response.status,
    contentType: response.contentType,
    etag: deriveEtag(response.body),
    createdAt: now,
    size,
  };
  STORE.set(k, entry);
  totalSize += size;
  // LRU eviction by count.
  while (STORE.size > cfg.maxEntries) {
    const first = STORE.keys().next();
    if (first.done) break;
    const e = STORE.get(first.value);
    if (e) totalSize -= e.size;
    STORE.delete(first.value);
  }
  return entry;
}

// ── ETag check ───────────────────────────────────────────────────────────

/**
 * If-None-Match handling: returns true when the caller's etag
 * matches the cached one (caller responds 304).
 */
export function matchesEtag(
  key: CacheKey,
  ifNoneMatch: string | null | undefined,
): boolean {
  if (!ifNoneMatch) return false;
  const cached = STORE.get(deriveKey(key));
  if (!cached) return false;
  return cached.etag === ifNoneMatch.trim();
}

// ── Stats ────────────────────────────────────────────────────────────────

export function stats(): {
  entries: number;
  bytes: number;
} {
  return { entries: STORE.size, bytes: totalSize };
}
