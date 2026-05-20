/**
 * SOVEREIGN MATRIX — Federation block-set (wave 104).
 *
 * The bridge between the federation peer-pull cron (wave 102/103) and
 * the live guard layer. Pulled fingerprintIds are written to a Redis
 * SET by the cron; guards query the set per-request to record a
 * `federationMatch` attribution on their results.
 *
 * Architectural choices:
 *   - Redis (Upstash) for cross-isolate persistence. Serverless
 *     isolates don't share memory, so an in-process Set wouldn't see
 *     the cron's writes. Reuses the same Upstash credentials as
 *     `src/lib/rate-limit.ts` — no new env vars.
 *   - Single SET at `sovereign:federation:blockset`. Cron pipelines
 *     DEL + SADD + EXPIRE in one Redis roundtrip. The whole set
 *     refreshes every cron tick.
 *   - In-process cache wraps `isFederationBlocked()` per fingerprintId
 *     for 30s, amortising Redis cost across high-volume guards.
 *   - Fail-open. Redis down → query returns false. We NEVER block a
 *     user just because Redis is unavailable. The trade-off: federation
 *     defence degrades, local defence stays intact.
 *
 * Important invariant (wave 104, observability-only scope):
 *   This module ENABLES guards to learn that a fingerprint matched
 *   the federation. It does NOT make a block decision. The decision
 *   stays with the local detector. A future wave can wire the
 *   match into an escalation policy after operators measure false-
 *   positive rates from the federation feed.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("federation-block-set");

/** Single Redis SET key holding the active federation block-list. */
const BLOCKSET_KEY = "sovereign:federation:blockset";

/** Block-set TTL — matches the bulletin TTL ceiling (wave 99). */
const BLOCKSET_TTL_SECONDS = 24 * 3600;

/** Per-fingerprintId cache TTL — short enough to invalidate quickly. */
const CACHE_TTL_MS = 30_000;

/** Hard cap on members written per cron tick — bounds Upstash request size. */
const MAX_MEMBERS_PER_WRITE = 5_000;

// ── In-process membership cache ──────────────────────────────────────────

/**
 * Cache entry: a single fingerprintId membership decision with its
 * expiry timestamp. We deliberately cache BOTH true and false results —
 * a "false" answer cached for 30s is the throughput optimisation that
 * makes this primitive viable on the hot path.
 */
interface CacheEntry {
  matched: boolean;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/** Exposed for tests — resets the in-process membership cache. */
export function clearLocalCache(): void {
  cache.clear();
}

// ── Configuration helpers ────────────────────────────────────────────────

function getRedisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

// ── Write path (cron-side) ──────────────────────────────────────────────

export interface WriteBlockSetResult {
  written: number;
  ok: boolean;
}

/**
 * Replace the federation block-set with the supplied fingerprintIds.
 * Best-effort — never throws. Returns observability metrics so the
 * cron can include them in its response body.
 *
 * Pipeline: DEL → SADD (chunked if > MAX_MEMBERS_PER_WRITE) → EXPIRE.
 * Issued as a single Upstash REST request to keep cost predictable.
 *
 * When Redis isn't configured, returns `{ written: 0, ok: false }`
 * with a single log warn. Federation requires Redis — in-process state
 * doesn't survive serverless isolates, so there's no useful fallback
 * for writes (unlike rate-limit which has a sensible in-memory
 * fallback for the single-isolate case).
 */
export async function writeBlockSet(
  fingerprintIds: string[],
): Promise<WriteBlockSetResult> {
  const config = getRedisConfig();
  if (!config) {
    log.warn(
      "writeBlockSet no-op (UPSTASH_REDIS_REST_URL / TOKEN unset); " +
        "federation requires Redis to function across serverless isolates",
    );
    return { written: 0, ok: false };
  }

  // De-dup + sanity-check inputs. Cron output is already deduped by
  // wave-102's extractFingerprintIds, but defence in depth.
  const unique = [...new Set(fingerprintIds)]
    .filter((id) => typeof id === "string" && /^[a-f0-9]{64}$/i.test(id))
    .slice(0, MAX_MEMBERS_PER_WRITE);

  // SET-clear semantics: DEL the key, then either SADD the new members
  // or just EXPIRE the (empty) key so the absence is uniform across
  // peers. When unique is empty the pipeline is DEL only.
  const pipeline: unknown[][] = [["DEL", BLOCKSET_KEY]];
  if (unique.length > 0) {
    // SADD accepts variadic members; one command writes all of them.
    pipeline.push(["SADD", BLOCKSET_KEY, ...unique]);
    pipeline.push(["EXPIRE", BLOCKSET_KEY, BLOCKSET_TTL_SECONDS]);
  }

  try {
    const res = await fetch(`${config.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pipeline),
    });
    if (!res.ok) {
      log.warn("writeBlockSet pipeline non-2xx", { status: res.status });
      return { written: 0, ok: false };
    }
    // Invalidate the in-process cache — the next reader should see
    // the freshly-written set, not stale 30s-old answers.
    // NOTE: local-only invalidation. Other Vercel isolates retain
    // their own caches and may serve stale answers for up to
    // CACHE_TTL_MS before re-reading. Acceptable under the wave-104
    // observability-only scope (local detector is authoritative). If
    // a future wave wires `federationMatch.matched` into the block
    // decision, replace this with a Redis pub/sub fan-out or shorten
    // CACHE_TTL_MS — the cross-isolate gap becomes a correctness
    // concern once federation influences the block verdict.
    clearLocalCache();
    return { written: unique.length, ok: true };
  } catch (err) {
    log.warn("writeBlockSet failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { written: 0, ok: false };
  }
}

// ── Read path (guard-side) ──────────────────────────────────────────────

/**
 * Membership query: does the federation block-set contain this
 * fingerprintId? Cached per-isolate for 30s.
 *
 * Fail-open: if Redis isn't configured OR Redis throws OR the response
 * is malformed, returns `false`. The federation defence layer is
 * additive on top of local detection — its absence must never cause
 * over-blocking. This is the explicit trade-off documented in the
 * wave-104 plan.
 *
 * The 30s cache is per-isolate, not global. On Vercel, each cold-start
 * isolate begins with an empty cache; the first request to each
 * fingerprintId after isolate creation costs one Redis roundtrip.
 * Acceptable cost on the hot path.
 */
export async function isFederationBlocked(
  fingerprintId: string,
): Promise<boolean> {
  if (typeof fingerprintId !== "string" || fingerprintId.length === 0) {
    return false;
  }

  // Check the in-process cache first.
  const cached = cache.get(fingerprintId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.matched;
  }

  const config = getRedisConfig();
  if (!config) {
    // Cache the negative — no Redis configured, no membership. We
    // still want to short-circuit the env lookup on the hot path.
    cache.set(fingerprintId, { matched: false, expiresAt: now + CACHE_TTL_MS });
    return false;
  }

  let matched = false;
  try {
    const res = await fetch(`${config.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([["SISMEMBER", BLOCKSET_KEY, fingerprintId]]),
    });
    if (res.ok) {
      const data = (await res.json()) as Array<{ result?: number | string }>;
      // Upstash returns the integer result for SISMEMBER (0 or 1).
      const v = data?.[0]?.result;
      matched = v === 1 || v === "1";
    }
  } catch (err) {
    log.warn("isFederationBlocked Redis failure", {
      error: err instanceof Error ? err.message : String(err),
    });
    matched = false;
  }

  // Cache both true AND false so a high-volume guard doesn't pay
  // the Redis cost on every call. Stale-false ≤ 30s is the explicit
  // trade-off; documented at the module level.
  cache.set(fingerprintId, { matched, expiresAt: now + CACHE_TTL_MS });
  return matched;
}
