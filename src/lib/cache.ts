/**
 * RESPONSE CACHE — Upstash Redis-compatible caching layer.
 * 
 * Caches agent responses to avoid re-calling NIM for identical queries.
 * Dramatically reduces latency on repeated requests (3000ms → <50ms).
 * 
 * Mode 1 (Default): In-memory LRU cache (per serverless instance).
 * Mode 2 (Production): Upstash Redis when UPSTASH_REDIS_REST_URL is set.
 * 
 * To upgrade to Upstash:
 * 1. Create account at upstash.com (free tier: 10K requests/day)
 * 2. Add env vars:
 *    UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
 *    UPSTASH_REDIS_REST_TOKEN=your-token
 */

const USE_UPSTASH = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// In-memory FIFO cache (fallback). True LRU would require re-inserting on
// get() to refresh position; we intentionally keep the simpler FIFO behavior.
const memoryCache = new Map<string, { value: string; expires: number }>();
const MAX_CACHE_SIZE = 500;

/**
 * Deterministic deep-stringify — sorts keys at every level so two payloads
 * with the same content but different key order hash to the same string.
 * Used as the input to cache-key generation.
 *
 * NOTE: the previous impl used JSON.stringify(value, sortedKeys) which
 * collapsed nested objects to {} (replacer-array filters keys at *every*
 * level, not just the top). That caused silent cache collisions across
 * payloads that differed only in nested fields.
 */
export function deterministicStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) {
    return "[" + value.map(deterministicStringify).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    "{" +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ":" +
          deterministicStringify((value as Record<string, unknown>)[k])
      )
      .join(",") +
    "}"
  );
}

function generateCacheKey(agent: string, payload: unknown): string {
  const sorted = deterministicStringify(payload);
  // djb2-style hash — adequate for a 500-entry in-memory cache
  let hash = 0;
  for (let i = 0; i < sorted.length; i++) {
    const char = sorted.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `cache:${agent}:${Math.abs(hash).toString(36)}`;
}

// ── Upstash helpers ──

async function upstashSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/set/${key}/${encodeURIComponent(value)}/ex/${ttlSeconds}`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN!}` },
    });
  } catch {
    // Fallback to memory
    memorySet(key, value, ttlSeconds);
  }
}

async function upstashGet(key: string): Promise<string | null> {
  try {
    const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN!}` },
    });
    const data = await res.json();
    return data?.result || null;
  } catch {
    return memoryGet(key);
  }
}

// ── Memory helpers ──

function memorySet(key: string, value: string, ttlSeconds: number): void {
  // Evict oldest if full
  if (memoryCache.size >= MAX_CACHE_SIZE) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
}

function memoryGet(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

// ── Public API ──

export async function cacheGet(agent: string, payload: unknown): Promise<unknown | null> {
  const key = generateCacheKey(agent, payload);

  if (USE_UPSTASH) {
    const cached = await upstashGet(key);
    if (cached) {
      try { return JSON.parse(cached); } catch { return null; }
    }
    return null;
  }

  const cached = memoryGet(key);
  if (cached) {
    try { return JSON.parse(cached); } catch { return null; }
  }
  return null;
}

export async function cacheSet(agent: string, payload: unknown, response: unknown, ttlSeconds: number = 300): Promise<void> {
  const key = generateCacheKey(agent, payload);
  const value = JSON.stringify(response);

  if (USE_UPSTASH) {
    await upstashSet(key, value, ttlSeconds);
  } else {
    memorySet(key, value, ttlSeconds);
  }
}

export function getCacheMode(): string {
  return USE_UPSTASH ? "upstash" : "memory";
}

export function getCacheStats(): { mode: string; entries: number; maxSize: number } {
  // Clean expired entries
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (now > entry.expires) memoryCache.delete(key);
  }

  return {
    mode: getCacheMode(),
    entries: memoryCache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}
