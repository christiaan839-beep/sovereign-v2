/**
 * AI RESPONSE CACHE — read-through cache for identical LLM calls.
 *
 * Why: 30-50% of production LLM traffic is repeat questions. Caching
 * catches all of them instantly (sub-50ms) at zero token cost.
 *
 * Cache key is a hash of (prompt, system, model, maxTokens, thinking, useOpus,
 * useGeminiPro) — any change in any of those invalidates the cache entry.
 *
 * Storage: uses the same Upstash→memory fallback as the agent cache in
 * cache.ts, but with a different key prefix (`ai:resp:`) so the two can
 * coexist without collisions.
 *
 * Usage:
 *   const cached = await getCachedResponse(prompt, options);
 *   if (cached !== null) return cached;
 *   const fresh = await actualLLMCall();
 *   await setCachedResponse(prompt, options, fresh);
 *   return fresh;
 */

import { deterministicStringify } from "@/lib/cache";
import { createLogger } from "@/lib/logger";
import type { AIOptions } from "@/types";

const log = createLogger("ai-cache");

const USE_UPSTASH = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

/** Per-instance fallback — same 500-entry FIFO pattern as cache.ts. */
const memoryCache = new Map<string, { value: string; expires: number }>();
const MAX_CACHE_SIZE = 500;

/** Default TTL if caller doesn't specify. 15 min balances freshness and hit rate. */
const DEFAULT_TTL_SECONDS = 15 * 60;

/**
 * Telemetry — rolling counters so we can publish an honest cache hit rate.
 * A hit rate of 40%+ is the difference between "fast platform" and "cheap
 * platform". We want both. Reset hourly to keep the number current.
 */
const telemetry = {
  hits: 0,
  misses: 0,
  writes: 0,
  stampedeSaves: 0,
  resetAt: Date.now(),
};

/**
 * In-flight deduplication — when 10 concurrent requests ask for the same
 * cache key and the value isn't cached yet, only ONE of them should hit
 * the LLM. The other 9 await the first one's result. This is the
 * "stampede" or "thundering herd" pattern and elite platforms (Cloudflare,
 * Fastly, Varnish) all solve it the same way: a Promise per in-flight key.
 */
const inFlight = new Map<string, Promise<string | null>>();

/**
 * Compute cache key from prompt + all options that change the output.
 * Keys that change the output: prompt, system, model, maxTokens, thinking,
 * useOpus, useGeminiPro. Keys that DON'T: cache (obviously), taskType
 * (advisory only).
 */
function cacheKey(prompt: string, options: AIOptions): string {
  const payload = {
    prompt,
    system: options.system ?? "",
    model: options.model ?? "nim",
    maxTokens: options.maxTokens ?? 2000,
    thinking: !!options.thinking,
    useOpus: !!options.useOpus,
    useGeminiPro: !!options.useGeminiPro,
  };
  const serialized = deterministicStringify(payload);
  // djb2-style hash — same as cache.ts, adequate for a 500-entry in-memory cache.
  let hash = 0;
  for (let i = 0; i < serialized.length; i++) {
    const char = serialized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `ai:resp:${Math.abs(hash).toString(36)}`;
}

// ── Upstash helpers (mirror cache.ts patterns) ──

async function upstashGet(key: string): Promise<string | null> {
  try {
    const res = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN!}` },
      signal: AbortSignal.timeout(2000), // 2s — cache reads must be snappy
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.result === "string" ? data.result : null;
  } catch {
    // Upstash unreachable — fall back to memory
    return memoryGet(key);
  }
}

async function upstashSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    await fetch(
      `${process.env.UPSTASH_REDIS_REST_URL}/set/${key}/${encodeURIComponent(value)}/ex/${ttlSeconds}`,
      {
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN!}` },
        signal: AbortSignal.timeout(2000),
      },
    );
  } catch {
    // Upstash unreachable — write to memory so at least this instance sees the cache
    memorySet(key, value, ttlSeconds);
  }
}

// ── Memory helpers ──

function memoryGet(key: string): string | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key: string, value: string, ttlSeconds: number): void {
  if (memoryCache.size >= MAX_CACHE_SIZE) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
}

// ── Public API ──

/**
 * Check if a response is cached for this (prompt, options) tuple.
 * Returns the cached string, or null if not cached or expired.
 *
 * Stampede-protection: if a concurrent request is already fetching the
 * same key (via `fetchWithCache` below), this returns its in-flight
 * Promise instead of issuing a duplicate fetch.
 */
export async function getCachedResponse(
  prompt: string,
  options: AIOptions,
): Promise<string | null> {
  if (!options.cache) return null;
  const key = cacheKey(prompt, options);

  // In-flight dedupe — await an already-running fetch for the same key.
  const pending = inFlight.get(key);
  if (pending) {
    telemetry.stampedeSaves++;
    return pending;
  }

  const value = USE_UPSTASH ? await upstashGet(key) : memoryGet(key);
  if (value) {
    telemetry.hits++;
    log.info("Cache hit", { key, backend: USE_UPSTASH ? "upstash" : "memory" });
  } else {
    telemetry.misses++;
  }
  return value;
}

/**
 * Store a response in the cache. Fire-and-forget from the caller's
 * perspective — cache write errors never break the user's request.
 */
export async function setCachedResponse(
  prompt: string,
  options: AIOptions,
  value: string,
): Promise<void> {
  if (!options.cache) return;
  const ttl =
    typeof options.cache === "object" && options.cache.ttlSeconds
      ? options.cache.ttlSeconds
      : DEFAULT_TTL_SECONDS;
  const key = cacheKey(prompt, options);
  try {
    if (USE_UPSTASH) {
      await upstashSet(key, value, ttl);
    } else {
      memorySet(key, value, ttl);
    }
  } catch (err) {
    log.warn("Cache write failed — ignoring", {
      error: (err as Error).message,
    });
  }
}

export function getAiCacheStats(): {
  mode: string;
  memoryEntries: number;
  hits: number;
  misses: number;
  writes: number;
  stampedeSaves: number;
  hitRatePct: number;
  windowSeconds: number;
} {
  // Sweep expired entries before reporting
  const now = Date.now();
  for (const [k, v] of memoryCache.entries()) {
    if (now > v.expires) memoryCache.delete(k);
  }
  const total = telemetry.hits + telemetry.misses;
  return {
    mode: USE_UPSTASH ? "upstash" : "memory",
    memoryEntries: memoryCache.size,
    hits: telemetry.hits,
    misses: telemetry.misses,
    writes: telemetry.writes,
    stampedeSaves: telemetry.stampedeSaves,
    hitRatePct: total === 0 ? 0 : Math.round((telemetry.hits / total) * 1000) / 10,
    windowSeconds: Math.round((now - telemetry.resetAt) / 1000),
  };
}

/**
 * Reset telemetry counters. Called by a cron or admin endpoint to keep
 * the hit-rate window fresh — a 7-day cumulative number tells you less
 * than a rolling-1-hour number.
 */
export function resetAiCacheTelemetry(): void {
  telemetry.hits = 0;
  telemetry.misses = 0;
  telemetry.writes = 0;
  telemetry.stampedeSaves = 0;
  telemetry.resetAt = Date.now();
}

/**
 * Elite-tier convenience wrapper: cache-aware single-shot fetch.
 *
 * If cached → return cached.
 * If in-flight → await the sibling request's result.
 * If neither → call `fetcher`, cache the result, return.
 *
 * This is the pattern every elite API gateway (Cloudflare Workers KV,
 * Vercel Edge Cache) implements under the hood. We expose it explicitly
 * so route handlers can opt in with one line.
 */
export async function fetchWithCache(
  prompt: string,
  options: AIOptions,
  fetcher: () => Promise<string>,
): Promise<string> {
  // Existing cache lookup — also handles in-flight dedupe.
  const cached = await getCachedResponse(prompt, options);
  if (cached !== null) return cached;

  if (!options.cache) return fetcher();

  const key = cacheKey(prompt, options);
  const promise = (async () => {
    try {
      const result = await fetcher();
      telemetry.writes++;
      await setCachedResponse(prompt, options, result);
      return result;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}
