/**
 * SOVEREIGN MATRIX — Webhook retry queue (Cook 121).
 *
 * Buffers outbound webhook deliveries (Stripe / GitHub / Slack
 * downstream calls) with exponential backoff + jitter. Composes
 * with Cook 47 webhook-triggers (inbound) — this module is the
 * OUTBOUND complement.
 *
 * Pure module — caller injects the deliverer. State is in-memory;
 * production swaps to Postgres/Redis once a persistent queue is
 * wired. Receipt-friendly outcomes.
 */

import { createHash, randomBytes } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface WebhookDelivery {
  id: string;
  url: string;
  body: string;
  /** Optional headers (signing already applied by caller). */
  headers: Record<string, string>;
  /** Attempts so far. */
  attempts: number;
  /** Next-attempt unix ms. */
  nextAttemptMs: number;
  /** Created-at unix ms. */
  createdMs: number;
  /** Permanent failure flag — set when maxAttempts exhausted. */
  dead: boolean;
  /** Last error message (informational). */
  lastError?: string;
}

export interface RetryConfig {
  /** Max delivery attempts before marking dead. Default 8. */
  maxAttempts: number;
  /** Base delay in ms. Default 1000. */
  baseDelayMs: number;
  /** Max delay between attempts. Default 60 * 60 * 1000. */
  maxDelayMs: number;
}

export type DelivererOutcome =
  | { ok: true; status: number }
  | { ok: false; status?: number; transient: boolean; message: string };

export type Deliverer = (
  delivery: WebhookDelivery,
) => Promise<DelivererOutcome>;

const DEFAULTS: RetryConfig = {
  maxAttempts: 8,
  baseDelayMs: 1_000,
  maxDelayMs: 60 * 60 * 1000,
};

// ── In-memory queue ──────────────────────────────────────────────────────

const QUEUE = new Map<string, WebhookDelivery>();

export function _resetForTests(): void {
  QUEUE.clear();
}

export function listPending(now: number = Date.now()): WebhookDelivery[] {
  return [...QUEUE.values()].filter((d) => !d.dead && d.nextAttemptMs <= now);
}

export function listDead(): WebhookDelivery[] {
  return [...QUEUE.values()].filter((d) => d.dead);
}

// ── Enqueue ──────────────────────────────────────────────────────────────

export function enqueue(args: {
  url: string;
  body: string;
  headers?: Record<string, string>;
  now?: number;
}): WebhookDelivery {
  const id = `whk_${createHash("sha256")
    .update(
      `${args.url}|${args.body}|${args.now ?? Date.now()}|${randomBytes(4).toString("hex")}`,
    )
    .digest("hex")
    .slice(0, 24)}`;
  const now = args.now ?? Date.now();
  const delivery: WebhookDelivery = {
    id,
    url: args.url,
    body: args.body,
    headers: args.headers ?? {},
    attempts: 0,
    nextAttemptMs: now,
    createdMs: now,
    dead: false,
  };
  QUEUE.set(id, delivery);
  return delivery;
}

// ── Backoff math ─────────────────────────────────────────────────────────

/**
 * Exponential backoff with full jitter.
 *   delay_n = min(maxDelay, baseDelay × 2^n) × random in [0.5, 1]
 *
 * Caller passes a deterministic random for tests.
 */
export function nextBackoff(
  attempts: number,
  config: RetryConfig = DEFAULTS,
  random: () => number = Math.random,
): number {
  const cap = Math.min(config.maxDelayMs, config.baseDelayMs * 2 ** attempts);
  // Half-to-full jitter.
  return Math.floor(cap * (0.5 + random() * 0.5));
}

// ── Tick (drain) ─────────────────────────────────────────────────────────

export interface TickReport {
  attempted: number;
  delivered: number;
  retried: number;
  killed: number;
}

/**
 * Attempt every delivery whose nextAttemptMs ≤ now. Pure aside from
 * the queue store + the supplied deliverer. Caller schedules this
 * on the cron (Cook 73 pattern) or fires it on-demand from a
 * dispatch worker.
 */
export async function tick(
  deliverer: Deliverer,
  config: Partial<RetryConfig> = {},
  now: number = Date.now(),
  random: () => number = Math.random,
): Promise<TickReport> {
  const cfg = { ...DEFAULTS, ...config };
  const pending = listPending(now);
  const report: TickReport = {
    attempted: 0,
    delivered: 0,
    retried: 0,
    killed: 0,
  };

  for (const delivery of pending) {
    report.attempted++;
    delivery.attempts++;
    try {
      const result = await deliverer(delivery);
      if (result.ok) {
        QUEUE.delete(delivery.id);
        report.delivered++;
      } else if (!result.transient) {
        // Permanent failure → mark dead immediately, don't burn attempts.
        delivery.dead = true;
        delivery.lastError = result.message;
        report.killed++;
      } else {
        // Transient → schedule next attempt OR kill if exhausted.
        if (delivery.attempts >= cfg.maxAttempts) {
          delivery.dead = true;
          delivery.lastError = result.message;
          report.killed++;
        } else {
          delivery.lastError = result.message;
          delivery.nextAttemptMs =
            now + nextBackoff(delivery.attempts, cfg, random);
          report.retried++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (delivery.attempts >= cfg.maxAttempts) {
        delivery.dead = true;
        delivery.lastError = msg;
        report.killed++;
      } else {
        delivery.lastError = msg;
        delivery.nextAttemptMs =
          now + nextBackoff(delivery.attempts, cfg, random);
        report.retried++;
      }
    }
  }

  return report;
}
