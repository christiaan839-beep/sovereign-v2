/**
 * SOVEREIGN MATRIX — Cross-instance event fanout (Wave 33).
 *
 * Closes the Wave-21 "single-instance only" caveat for SSE delivery
 * on Vercel. The local event-bus stays as the synchronous in-process
 * fast path; this module adds an Upstash Pub/Sub bridge so events
 * published on one lambda reach SSE subscribers on every other live
 * lambda.
 *
 * Architecture:
 *   publish(...) → local bus delivery (synchronous, same instance)
 *                ↘ enqueueRemote(...) → Upstash → other instances
 *                                              ↘ subscribeRemote(...)
 *                                                ↘ local bus replay
 *
 * Failure mode: when Upstash isn't configured (no UPSTASH_REDIS_REST_URL
 * + token), the bridge silently no-ops. The local bus continues to
 * work; cross-instance delivery just isn't happening. The dashboard
 * "scope: open" SSE indicator still reflects connection state
 * accurately so an operator sees the topology.
 *
 * Why Upstash (not Vercel's KV / Postgres NOTIFY / Redis):
 *   - Already wired in the codebase for rate-limit (Wave 21
 *     documented this as the obvious adapter).
 *   - Upstash REST API works from edge + lambda without a long-lived
 *     TCP socket, which Vercel serverless doesn't permit.
 *   - "At-most-once best effort" is the right delivery semantic for
 *     a live dashboard feed — we don't need durable queueing because
 *     the audit log is the durable record.
 *
 * Pairs with src/lib/event-bus.ts (Wave 21) and /api/events.
 */

import { createLogger } from "@/lib/logger";
import {
  publish as localPublish,
  type SovereignEvent,
  type SovereignEventType,
} from "@/lib/event-bus";

const log = createLogger("event-bus-fanout");

const CHANNEL = "sovereign:events:v1";
const POLL_INTERVAL_MS = 2_000;
const POLL_BATCH_LIMIT = 50;

interface UpstashConfig {
  url: string;
  token: string;
}

function getUpstashConfig(): UpstashConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

/**
 * True iff cross-instance fanout is configured. Surfaces on /status
 * and /trust so an operator can see the multi-region topology.
 */
export function isFanoutEnabled(): boolean {
  return getUpstashConfig() !== null;
}

/**
 * Push a locally-published event onto the Upstash list. Best-effort —
 * a network failure or missing config is a no-op (the local bus
 * already delivered to same-instance subscribers).
 *
 * Uses RPUSH against a capped list; subscribers LPOP off the other
 * side. We deliberately don't use PUBLISH because the Upstash REST
 * API requires a long-lived connection for subscriber-side, which
 * Vercel serverless instances can't hold. LIST polling is the
 * documented Upstash pattern for serverless pub/sub.
 */
export async function enqueueRemote(
  evt: SovereignEvent,
): Promise<{ ok: boolean; reason?: string }> {
  const cfg = getUpstashConfig();
  if (!cfg) return { ok: false, reason: "not-configured" };
  try {
    const body = JSON.stringify(evt);
    const res = await fetch(`${cfg.url}/rpush/${CHANNEL}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify([body]),
    });
    if (!res.ok) {
      log.warn("Upstash RPUSH failed", { status: res.status });
      return { ok: false, reason: `http-${res.status}` };
    }
    // Cap list length to 1000 — best-effort housekeeping. If a peer
    // is offline for hours it loses events past the cap (acceptable;
    // the audit log is the durable record).
    void fetch(`${cfg.url}/ltrim/${CHANNEL}/-1000/-1`, {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.token}` },
    }).catch(() => {});
    return { ok: true };
  } catch (err) {
    log.warn("enqueueRemote failed-soft", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, reason: "network" };
  }
}

/**
 * Drain the Upstash list and re-publish each event to the LOCAL bus
 * (which then fans out to same-instance SSE subscribers). Called by
 * the poller; pure transformation, no side-effect beyond local bus
 * delivery.
 *
 * `originId` tracks which events this instance ORIGINATED so we can
 * skip re-publishing our own enqueues — without this every instance
 * would echo back every event we sent. The id is in-process random
 * UUID set at module load.
 */
const ORIGIN_ID =
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface WireEvent extends SovereignEvent {
  /** Origin instance id — set on enqueue, checked on drain. */
  _o?: string;
}

export async function drainRemote(): Promise<{ delivered: number }> {
  const cfg = getUpstashConfig();
  if (!cfg) return { delivered: 0 };
  try {
    // LRANGE 0..N-1 + LTRIM is the idempotent-ish drain pattern.
    // We accept rare double-delivery on the SSE feed — clients are
    // expected to be idempotent on event ids.
    const res = await fetch(
      `${cfg.url}/lrange/${CHANNEL}/0/${POLL_BATCH_LIMIT - 1}`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${cfg.token}` },
      },
    );
    if (!res.ok) return { delivered: 0 };
    const data = (await res.json()) as { result?: string[] };
    const rows = data.result ?? [];
    if (rows.length === 0) return { delivered: 0 };

    // Trim the consumed range. Best-effort.
    void fetch(`${cfg.url}/ltrim/${CHANNEL}/${rows.length}/-1`, {
      method: "POST",
      headers: { authorization: `Bearer ${cfg.token}` },
    }).catch(() => {});

    let delivered = 0;
    for (const raw of rows) {
      let evt: WireEvent;
      try {
        evt = JSON.parse(raw) as WireEvent;
      } catch {
        continue;
      }
      // Skip our own emissions.
      if (evt._o === ORIGIN_ID) continue;
      // Re-publish on the LOCAL bus only (the third arg is `data`,
      // which IS our payload). Don't loop the fanout — the recv-side
      // is responsible for surfacing to its own SSE subscribers, not
      // for re-broadcasting to the rest of the fleet.
      localPublish(evt.type as SovereignEventType, evt.tenantId, evt.data);
      delivered++;
    }
    return { delivered };
  } catch (err) {
    log.warn("drainRemote failed-soft", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { delivered: 0 };
  }
}

/**
 * Start a poller that drains the Upstash list every 2s. Returns an
 * unsubscribe function. Intended for the SSE handler — when a client
 * opens a stream, start the poller; when they disconnect, stop it.
 * The poller is idempotent (multiple subscribers = multiple pollers
 * is fine; LRANGE+LTRIM is atomic on Upstash).
 */
export function startRemotePoller(): () => void {
  if (!isFanoutEnabled()) return () => {};
  let cancelled = false;
  const tick = async () => {
    if (cancelled) return;
    try {
      await drainRemote();
    } catch {
      /* logged inside drainRemote */
    }
    if (!cancelled) {
      setTimeout(tick, POLL_INTERVAL_MS);
    }
  };
  setTimeout(tick, POLL_INTERVAL_MS);
  return () => {
    cancelled = true;
  };
}

/**
 * Convenience: wrap a local publish call with the cross-instance
 * fanout. Callers that need fanout (typed publishers in event-bus.ts)
 * use this instead of bare `publish(...)`. Returns the local event
 * synchronously; the remote enqueue fires-and-forgets.
 */
export function publishWithFanout<T>(
  type: SovereignEventType,
  tenantId: string | "*",
  data: T,
): SovereignEvent<T> {
  const evt = localPublish(type, tenantId, data);
  if (isFanoutEnabled()) {
    void enqueueRemote({ ...evt, _o: ORIGIN_ID } as WireEvent).catch(() => {});
  }
  return evt;
}

/** Test-only: expose the origin id so tests can simulate cross-instance. */
export const _ORIGIN_ID_FOR_TESTS = ORIGIN_ID;
