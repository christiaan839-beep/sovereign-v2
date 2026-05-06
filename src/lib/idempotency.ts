/**
 * Idempotency store — prevents duplicate processing of events with
 * at-least-once delivery semantics (PayPal/Stripe/Clerk webhooks,
 * cron retries, etc.).
 *
 * Three-tier fallback strategy, in order of preference:
 *
 *   1. Upstash Redis when configured — fastest (sub-10ms),
 *      cluster-shared, TTL-managed. Preferred for high-throughput
 *      providers.
 *   2. Postgres `webhook_events` table — durable across deploys,
 *      cluster-shared, indexed. Survives Lambda cold starts and
 *      multi-region replicas. Used when Redis is missing or fails.
 *   3. In-memory `Map` — last resort. Per-process, evaporates on
 *      cold start. Acceptable only when both Redis and DB are
 *      unreachable; pages Slack via the warn() log.
 *
 * The DB tier was added because PayPal retries events for up to
 * 24 hours; the in-memory fallback would let a 6-minute-later
 * retry process a payment a second time on a fresh Lambda. This
 * is a real failure mode, not theoretical.
 *
 * Usage:
 *   import { alreadyProcessed } from "@/lib/idempotency";
 *   if (await alreadyProcessed("paypal:event", event.id)) {
 *     return NextResponse.json({ received: true, duplicate: true });
 *   }
 */

import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("idempotency");

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

  // SET key "1" NX EX <ttl> — atomic set-if-absent with expiration.
  const res = await fetch(`${url}/set/${encodeURIComponent(key)}/1`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ NX: true, EX: ttlSeconds }),
  });
  const data = await res.json();
  return data?.result === "OK";
}

/**
 * Tier 2: Postgres-backed dedupe via `webhook_events` table. Inserts
 * (provider, event_id) — composite primary key raises 23505 on
 * duplicate, which we catch and report. Returns:
 *   - true  → first time we've seen this id (proceed)
 *   - false → duplicate (skip)
 *   - null  → DB unreachable / table missing (caller falls through
 *             to in-memory tier)
 */
async function setDbIfAbsent(
  provider: string,
  eventId: string,
): Promise<boolean | null> {
  try {
    await db.insert(webhookEvents).values({
      provider,
      eventId,
      status: "processing",
    });
    return true;
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "23505") return false; // duplicate
    if (pgCode === "42P01") return null; // table missing → fall through
    // Any other error: treat as unavailable, fall through to memory.
    log.warn("DB idempotency check failed — falling to memory tier", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Returns `true` if the event has already been processed (and should
 * be skipped), `false` if this is the first time we've seen it.
 *
 * @param namespace Logical store name. Use the form `provider:kind`
 *   (e.g. `paypal:event`, `stripe:event`, `clerk:user.created`) so
 *   the DB-tier `provider` column is meaningful.
 * @param id Unique event identifier from the provider.
 * @param ttlSeconds How long Redis remembers the event (default 24h).
 *   The DB tier keeps events 90 days (cleaned by the weekly cron).
 */
export async function alreadyProcessed(
  namespace: string,
  id: string,
  ttlSeconds = 60 * 60 * 24,
): Promise<boolean> {
  const key = `idem:${namespace}:${id}`;
  const now = Date.now();

  // Tier 1: Redis (preferred — fastest)
  const useRedis = !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
  if (useRedis) {
    try {
      const stored = await setRedisIfAbsent(key, ttlSeconds);
      return !stored;
    } catch {
      // Fall through to DB tier on Redis failure.
    }
  }

  // Tier 2: Postgres (durable across cold starts)
  const dbResult = await setDbIfAbsent(namespace, id);
  if (dbResult !== null) {
    return !dbResult;
  }

  // Tier 3: In-memory (last resort, per-process)
  pruneMemoryStore(now);
  const existingExpiry = memoryStore.get(key);
  if (existingExpiry && existingExpiry > now) {
    return true;
  }
  memoryStore.set(key, now + ttlSeconds * 1000);
  return false;
}
