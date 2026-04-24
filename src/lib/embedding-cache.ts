/**
 * Embedding cache — deterministic text → 2048-d vector.
 *
 * Query embeddings for /marketplace/search hit NIM on every call
 * today. But the same search text always produces the same vector,
 * so repeated queries ("invoice extractor", "cold email", …) are
 * wasted NIM round-trips.
 *
 * This cache makes identical-text lookups O(1) in memory (or ~5ms
 * through Upstash) instead of ~200ms NIM round-trip. On a marketplace
 * with heavy search traffic we expect 60–80% hit rate.
 *
 * Storage strategy (same pattern as ai-cache.ts):
 *   - Upstash Redis if UPSTASH_REDIS_REST_URL is set (cross-instance)
 *   - Otherwise a per-instance FIFO Map capped at 500 entries
 *
 * TTL: 7 days. Embeddings don't drift — only a model upgrade would
 * invalidate them, and a model upgrade is a deliberate ops event
 * that should include `purgeEmbeddingCache()`.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("embedding-cache");

const USE_UPSTASH = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

const memoryCache = new Map<string, { vec: number[]; expires: number }>();
const MAX_MEM_ENTRIES = 500;
const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

/* ─── Metrics (best-effort; in-memory) ────────────────────────── */

let hits = 0;
let misses = 0;
let sets = 0;

export function getEmbeddingCacheStats(): {
  mode: string;
  memoryEntries: number;
  hits: number;
  misses: number;
  sets: number;
  hitRate: number;
} {
  const total = hits + misses;
  return {
    mode: USE_UPSTASH ? "upstash+memory" : "memory-only",
    memoryEntries: memoryCache.size,
    hits,
    misses,
    sets,
    hitRate: total > 0 ? hits / total : 0,
  };
}

/* ─── Key derivation ──────────────────────────────────────────── */

/**
 * Embeddings are per-model, so the key includes the model name.
 * Same text, different model → different vector. We use a length-
 * bounded djb2 hash for short keys (Upstash TTL keys should stay
 * < 100 bytes for cheap lookups).
 */
function cacheKey(text: string, model: string): string {
  const payload = `${model}::${text.trim().toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `emb:${model.slice(0, 32)}:${hash >>> 0}`;
}

/* ─── Upstash adapter ─────────────────────────────────────────── */

async function upstashGet(key: string): Promise<number[] | null> {
  try {
    const res = await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(key)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
        },
      },
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: string };
    if (!body.result) return null;
    const parsed = JSON.parse(body.result) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.every((n) => typeof n === "number") ? (parsed as number[]) : null;
  } catch (err) {
    log.warn("upstash get failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function upstashSet(
  key: string,
  vec: number[],
  ttlSeconds: number,
): Promise<void> {
  try {
    await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/setex/${encodeURIComponent(key)}/${ttlSeconds}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(JSON.stringify(vec)),
      },
    );
  } catch (err) {
    log.warn("upstash set failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Fall through to memory cache for degraded service.
  }
}

/* ─── Memory adapter ──────────────────────────────────────────── */

function memoryGet(key: string): number[] | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.vec;
}

function memorySet(key: string, vec: number[], ttlSeconds: number): void {
  // Simple FIFO eviction — when we hit MAX, drop the oldest entry.
  if (memoryCache.size >= MAX_MEM_ENTRIES) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
  memoryCache.set(key, {
    vec,
    expires: Date.now() + ttlSeconds * 1000,
  });
}

/* ─── Public API ──────────────────────────────────────────────── */

export async function getCachedEmbedding(
  text: string,
  model: string,
): Promise<number[] | null> {
  const clean = text?.trim();
  if (!clean) return null;
  const key = cacheKey(clean, model);

  // Check memory first (fastest). Upstash is the cross-instance
  // truth, but a local hit is ~1µs vs ~5ms for the network round-trip.
  const memHit = memoryGet(key);
  if (memHit) {
    hits++;
    return memHit;
  }
  if (USE_UPSTASH) {
    const upHit = await upstashGet(key);
    if (upHit) {
      hits++;
      // Warm memory too for the next in-instance lookup.
      memorySet(key, upHit, DEFAULT_TTL_SECONDS);
      return upHit;
    }
  }
  misses++;
  return null;
}

export async function setCachedEmbedding(
  text: string,
  model: string,
  vec: number[],
): Promise<void> {
  const clean = text?.trim();
  if (!clean || !Array.isArray(vec) || vec.length === 0) return;
  const key = cacheKey(clean, model);
  sets++;

  memorySet(key, vec, DEFAULT_TTL_SECONDS);
  if (USE_UPSTASH) {
    await upstashSet(key, vec, DEFAULT_TTL_SECONDS);
  }
}

/**
 * Ops-only: clear all in-memory cache entries. Call after a model
 * upgrade or if the cache appears poisoned. Upstash entries expire
 * on their own TTL; use `FLUSHDB` on Upstash directly to clear those.
 */
export function purgeEmbeddingCacheMemory(): number {
  const n = memoryCache.size;
  memoryCache.clear();
  hits = 0;
  misses = 0;
  sets = 0;
  return n;
}
