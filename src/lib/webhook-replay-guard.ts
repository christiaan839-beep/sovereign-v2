/**
 * SOVEREIGN MATRIX — Universal webhook replay-attack guard (Cook 180).
 *
 * Single primitive applied across all 12 webhook handlers (Stripe,
 * Clerk, HubSpot, Cal.com, Yoco, PayFast, Paystack, Telegram,
 * Twilio, Coinbase, PayPal, MoonPay). Today the freshness check
 * varies per handler; this primitive unifies it.
 *
 * Threat model:
 *   - An attacker captures a valid webhook delivery from the wire
 *     (TLS terminator, log file, MITM in transit) and replays it
 *     against our endpoint later.
 *   - The signature is still valid, so the signature-only check
 *     can't catch this.
 *   - Idempotency (alreadyProcessed by event id) catches replays
 *     of an event we've already seen, but not the first-time
 *     replay of an old event we never received.
 *
 * Mechanism:
 *   - Every signed webhook carries a timestamp the provider sets.
 *   - We reject events whose timestamp is more than MAX_AGE_MS
 *     in the past or MAX_FUTURE_MS in the future.
 *   - Combined with the existing alreadyProcessed() dedup, this
 *     gives both "I've seen you before" and "you're too old" gates.
 *
 * Pure module: no I/O. Caller passes the parsed timestamp + now.
 */

// ── Public types ──────────────────────────────────────────────────────────

export interface ReplayGuardConfig {
  /**
   * Maximum allowed lag (ms) between the event timestamp and now.
   * Default 5 minutes (300_000 ms) — matches the Stripe webhook
   * window currently in production.
   */
  maxAgeMs?: number;
  /**
   * Maximum allowed FUTURE skew (ms) — events with timestamps in
   * the future beyond this are rejected as clock-tampered.
   * Default 60 seconds.
   */
  maxFutureMs?: number;
}

export type ReplayVerdict =
  | { ok: true }
  | {
      ok: false;
      reason: "stale" | "future-skew" | "missing-timestamp" | "bad-timestamp";
      ageMs?: number;
    };

export interface WebhookProviderProfile {
  /** Provider name — for logging only. */
  provider: string;
  /** Default config applied when caller does not override. */
  config: Required<ReplayGuardConfig>;
}

// ── Defaults ──────────────────────────────────────────────────────────────

const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000;
const DEFAULT_MAX_FUTURE_MS = 60 * 1000;

// ── Per-provider profiles ────────────────────────────────────────────────

/**
 * Each provider has a different replay-resistance posture by design.
 * Stripe is strict (5 min). PayPal queues retries for 25 hours so a
 * stricter window helps. MoonPay's webhook delivery is near-instant.
 * Telegram is bursty and may lag during outages.
 */
export const PROVIDER_PROFILES: Record<string, WebhookProviderProfile> = {
  stripe: {
    provider: "stripe",
    config: { maxAgeMs: 5 * 60_000, maxFutureMs: 60_000 },
  },
  clerk: {
    provider: "clerk",
    config: { maxAgeMs: 5 * 60_000, maxFutureMs: 60_000 },
  },
  paypal: {
    provider: "paypal",
    // PayPal retries for up to 25 hours, but we still want a sane
    // window. 10 minutes balances retry tolerance vs replay risk.
    config: { maxAgeMs: 10 * 60_000, maxFutureMs: 120_000 },
  },
  moonpay: {
    provider: "moonpay",
    config: { maxAgeMs: 5 * 60_000, maxFutureMs: 60_000 },
  },
  hubspot: {
    provider: "hubspot",
    config: { maxAgeMs: 5 * 60_000, maxFutureMs: 60_000 },
  },
  calcom: {
    provider: "calcom",
    config: { maxAgeMs: 5 * 60_000, maxFutureMs: 60_000 },
  },
  twilio: {
    provider: "twilio",
    // Twilio retries aggressively; widen to 15 minutes.
    config: { maxAgeMs: 15 * 60_000, maxFutureMs: 60_000 },
  },
  telegram: {
    provider: "telegram",
    // Telegram bursts during outages; allow 30 minutes.
    config: { maxAgeMs: 30 * 60_000, maxFutureMs: 60_000 },
  },
  yoco: {
    provider: "yoco",
    config: { maxAgeMs: 5 * 60_000, maxFutureMs: 60_000 },
  },
  payfast: {
    provider: "payfast",
    config: { maxAgeMs: 5 * 60_000, maxFutureMs: 60_000 },
  },
  paystack: {
    provider: "paystack",
    config: { maxAgeMs: 5 * 60_000, maxFutureMs: 60_000 },
  },
  coinbase: {
    provider: "coinbase",
    config: { maxAgeMs: 5 * 60_000, maxFutureMs: 60_000 },
  },
};

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Verify that a webhook event is fresh enough to process. Caller
 * supplies the provider-side timestamp + the current time; the
 * verdict is one of ok / stale / future-skew / missing / bad.
 */
export function checkReplay(args: {
  timestampMs: number | null | undefined;
  now: number;
  config?: ReplayGuardConfig;
}): ReplayVerdict {
  if (
    args.timestampMs === null ||
    args.timestampMs === undefined ||
    !Number.isFinite(args.timestampMs)
  ) {
    return { ok: false, reason: "missing-timestamp" };
  }
  if (args.timestampMs <= 0) {
    return { ok: false, reason: "bad-timestamp" };
  }

  const maxAge = args.config?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const maxFuture = args.config?.maxFutureMs ?? DEFAULT_MAX_FUTURE_MS;

  const ageMs = args.now - args.timestampMs;

  if (ageMs > maxAge) {
    return { ok: false, reason: "stale", ageMs };
  }
  if (ageMs < -maxFuture) {
    return { ok: false, reason: "future-skew", ageMs };
  }
  return { ok: true };
}

/**
 * Convenience wrapper for the common provider case. Same verdict
 * shape — looks up the profile by provider name.
 */
export function checkReplayForProvider(args: {
  provider: keyof typeof PROVIDER_PROFILES | string;
  timestampMs: number | null | undefined;
  now?: number;
}): ReplayVerdict {
  const profile =
    PROVIDER_PROFILES[args.provider as keyof typeof PROVIDER_PROFILES];
  return checkReplay({
    timestampMs: args.timestampMs,
    now: args.now ?? Date.now(),
    config: profile?.config,
  });
}

/**
 * Normalises a provider-side timestamp to Unix ms. Each provider
 * encodes timestamps differently:
 *
 *   - Stripe sends an ISO `created` field (seconds since epoch as int).
 *   - PayPal sends ISO 8601 strings in `paypal-transmission-time`.
 *   - MoonPay sends ISO 8601 strings in the event body.
 *   - Telegram sends seconds-since-epoch as int.
 *
 * Use this helper to convert whatever the provider gave you into
 * a number of ms that checkReplay() can take.
 */
export function parseTimestamp(
  raw: string | number | null | undefined,
): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    // Heuristic: 10-digit number is seconds; 13-digit number is ms.
    if (raw > 1e12) return raw;
    if (raw > 1e9) return Math.round(raw * 1000);
    return null;
  }
  if (typeof raw === "string") {
    const asNumber = Number(raw);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      if (asNumber > 1e12) return asNumber;
      if (asNumber > 1e9) return Math.round(asNumber * 1000);
    }
    const t = Date.parse(raw);
    if (Number.isFinite(t)) return t;
  }
  return null;
}
