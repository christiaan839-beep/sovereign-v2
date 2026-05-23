/**
 * SOVEREIGN MATRIX — Live agent activity bus (Wave 152).
 *
 * In-process pub/sub for "an agent run just landed" events. The
 * factory pushes one tick per signed receipt; subscribers receive
 * them via an async iterator (perfect for Server-Sent-Events streams).
 *
 * Why in-process (vs Redis / Postgres LISTEN):
 *   - Single Vercel function instance handles all sse subscribers
 *     for that instance's runs — fanout across pods is a nice-to-
 *     have, not a must-have for an operator war-room UI
 *   - Zero new infrastructure dependencies
 *   - Trivially testable as a pure-function ring buffer
 *
 * Capacity:
 *   - Ring buffer of 200 ticks (default) — recent activity is
 *     replayed on subscription so the war-room loads with history
 *   - Subscriber buffers capped at 64 unread ticks; overflow drops
 *     oldest to keep memory bounded under slow consumers
 *
 * API:
 *   - `publishTick(tick)`           — call from agent-factory after recordRun
 *   - `subscribeTicks(filter?)`     — returns AsyncIterable<Tick>
 *   - `getRecentTicks(limit?)`      — snapshot for non-streaming callers
 *   - `getActivityStats()`          — global counters for admin tile
 *
 * All exports are pure-function-testable on the singleton.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("agent-activity-bus");

const MAX_BUFFER_TICKS = 200;
const MAX_SUBSCRIBER_QUEUE = 64;

export type TickStatus = "auto-approved" | "needs-approval" | "blocked";

export interface ActivityTick {
  id: string;
  agentName: string;
  modelUsed: string;
  userId: string | null;
  status: TickStatus;
  durationMs: number;
  /** Iso timestamp emitted by publisher. */
  at: string;
  /** Optional bandit pick observed at routing time. */
  banditPick?: string;
}

interface Subscriber {
  /** Optional agentName filter; empty = all agents. */
  agentFilter: string | null;
  queue: ActivityTick[];
  /** Resolves the current pending take() when a tick lands. */
  notify: (() => void) | null;
  closed: boolean;
}

const ringBuffer: ActivityTick[] = [];
const subscribers = new Set<Subscriber>();
const counters = {
  total: 0,
  approved: 0,
  blocked: 0,
  needsApproval: 0,
};

/**
 * Publish one tick. Called from agent-factory's signed-receipt path.
 * Pushes onto the ring buffer + every live subscriber's queue.
 * Best-effort — failures inside handlers never bubble.
 */
export function publishTick(tick: ActivityTick): void {
  try {
    ringBuffer.push(tick);
    if (ringBuffer.length > MAX_BUFFER_TICKS) {
      ringBuffer.splice(0, ringBuffer.length - MAX_BUFFER_TICKS);
    }
    counters.total++;
    if (tick.status === "auto-approved") counters.approved++;
    else if (tick.status === "blocked") counters.blocked++;
    else if (tick.status === "needs-approval") counters.needsApproval++;

    for (const sub of subscribers) {
      if (sub.closed) continue;
      if (sub.agentFilter && sub.agentFilter !== tick.agentName) continue;
      sub.queue.push(tick);
      if (sub.queue.length > MAX_SUBSCRIBER_QUEUE) {
        sub.queue.splice(0, sub.queue.length - MAX_SUBSCRIBER_QUEUE);
      }
      sub.notify?.();
    }
  } catch (err) {
    log.warn("publishTick failed", { error: String(err) });
  }
}

export function getRecentTicks(limit: number = 50): ActivityTick[] {
  const clamped = Math.min(Math.max(limit, 1), MAX_BUFFER_TICKS);
  return ringBuffer.slice(-clamped);
}

export function getActivityStats() {
  return {
    bufferSize: ringBuffer.length,
    subscriberCount: subscribers.size,
    total: counters.total,
    approved: counters.approved,
    blocked: counters.blocked,
    needsApproval: counters.needsApproval,
  };
}

/**
 * Subscribe to ticks as an async iterable. Caller pulls via for-await.
 * Closing the iterator via .return() or AbortSignal removes the
 * subscriber atomically.
 *
 * On subscription, RECENT history is replayed (last 32 ticks matching
 * the filter) so a fresh war-room load isn't empty.
 */
export function subscribeTicks(
  opts: {
    agentFilter?: string | null;
    signal?: AbortSignal;
    replay?: number;
  } = {},
): AsyncIterable<ActivityTick> & { close: () => void } {
  const sub: Subscriber = {
    agentFilter: opts.agentFilter ?? null,
    queue: [],
    notify: null,
    closed: false,
  };

  // Pre-load with recent matching history
  const replayN = Math.min(Math.max(opts.replay ?? 32, 0), MAX_BUFFER_TICKS);
  if (replayN > 0) {
    const tail = ringBuffer.slice(-MAX_BUFFER_TICKS);
    for (const t of tail) {
      if (sub.agentFilter && sub.agentFilter !== t.agentName) continue;
      sub.queue.push(t);
    }
    if (sub.queue.length > replayN) {
      sub.queue.splice(0, sub.queue.length - replayN);
    }
  }

  subscribers.add(sub);

  if (opts.signal) {
    opts.signal.addEventListener(
      "abort",
      () => {
        sub.closed = true;
        sub.notify?.();
        subscribers.delete(sub);
      },
      { once: true },
    );
  }

  function close() {
    sub.closed = true;
    sub.notify?.();
    subscribers.delete(sub);
  }

  return {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<ActivityTick>> {
          while (true) {
            if (sub.queue.length > 0) {
              return { value: sub.queue.shift()!, done: false };
            }
            if (sub.closed) {
              return {
                value: undefined as unknown as ActivityTick,
                done: true,
              };
            }
            await new Promise<void>((resolve) => {
              sub.notify = () => {
                sub.notify = null;
                resolve();
              };
            });
          }
        },
        async return(): Promise<IteratorResult<ActivityTick>> {
          close();
          return { value: undefined as unknown as ActivityTick, done: true };
        },
      };
    },
    close,
  };
}

/** TEST-ONLY: reset the in-process state. */
export function _resetActivityBus(): void {
  ringBuffer.length = 0;
  for (const s of subscribers) {
    s.closed = true;
    s.notify?.();
  }
  subscribers.clear();
  counters.total = 0;
  counters.approved = 0;
  counters.blocked = 0;
  counters.needsApproval = 0;
}
