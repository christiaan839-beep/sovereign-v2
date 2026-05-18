/**
 * Idempotency store — prevents duplicate processing of events with
 * at-least-once delivery semantics (Stripe webhooks, payment providers, etc.)
 *
 * Backed by Upstash Redis when configured, with an in-memory fallback.
 * The in-memory fallback is per-process and resets on deploy — acceptable
 * for low-volume providers but unsafe for high-frequency duplicates.
 *
 * Usage:
 *   import { alreadyProcessed } from "@/lib/idempotency";
 *   if (await alreadyProcessed("stripe:event", event.id)) {
 *     return NextResponse.json({ received: true, duplicate: true });
 *   }
 */

// In-memory fallback store: Map<key, expiresAt_ms>
const memoryStore = new Map<string, number>();
const MEMORY_MAX_ENTRIES = 10_000;

function pruneMemoryStore(now: number) {
  if (memoryStore.size < MEMORY_MAX_ENTRIES) return;
  for (const [key, expiresAt] of memoryStore.entries()) {
    if (expiresAt <= now) memoryStore.delete(key);
  }
}

async function setRedisIfAbsent(
  key: string,
  ttlSeconds: number,
): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Redis not configured");

  // Upstash REST SET options MUST be passed as URL query parameters,
  // not as a JSON body — the body is silently ignored. Prior version
  // sent `{NX: true, EX: ttl}` in the body and Upstash applied
  // neither, so every call succeeded unconditionally and idempotency
  // was effectively disabled. Fixed in Wave 72.
  //
  // SET key "1" NX EX <ttl> — atomic set-if-absent with expiration.
  // Returns {result: "OK"} on success, {result: null} when NX rejected
  // because the key already existed.
  const params = new URLSearchParams({
    NX: "true",
    EX: String(ttlSeconds),
  });
  const res = await fetch(
    `${url}/set/${encodeURIComponent(key)}/1?${params.toString()}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
  const data = await res.json();
  return data?.result === "OK";
}

/**
 * Returns `true` if the event has already been processed (and should be
 * skipped), `false` if this is the first time we've seen it.
 *
 * @param namespace Logical store name (e.g. "stripe:event")
 * @param id Unique event identifier (e.g. Stripe event.id)
 * @param ttlSeconds How long to remember the event (default 24h)
 */
export async function alreadyProcessed(
  namespace: string,
  id: string,
  ttlSeconds = 60 * 60 * 24,
): Promise<boolean> {
  const key = `idem:${namespace}:${id}`;
  const now = Date.now();

  const useRedis = !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );

  if (useRedis) {
    try {
      const stored = await setRedisIfAbsent(key, ttlSeconds);
      return !stored; // If we couldn't store it, something else already did.
    } catch {
      // Fall through to memory on Redis failure — graceful degradation.
    }
  }

  // In-memory fallback
  pruneMemoryStore(now);
  const existingExpiry = memoryStore.get(key);
  if (existingExpiry && existingExpiry > now) {
    return true;
  }
  memoryStore.set(key, now + ttlSeconds * 1000);
  return false;
}
