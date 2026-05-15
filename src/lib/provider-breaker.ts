/**
 * SOVEREIGN MATRIX — Provider circuit-breaker wrapper (Cook 104).
 *
 * Wraps any external-provider fetch with a per-provider state machine
 * (CLOSED → OPEN → HALF-OPEN). When N consecutive failures hit the
 * threshold, the breaker OPENS and the next M requests short-circuit
 * with a structured failure — saving cost + latency on a dead
 * provider until the cooldown elapses.
 *
 * Used by the e2b + Browserbase + ElevenLabs runners (Cooks 74/78/79).
 *
 * Pure module — no I/O. Caller injects `clock` for deterministic tests.
 */

// ── Public types ──────────────────────────────────────────────────────────

export type BreakerState = "closed" | "open" | "half-open";

export interface BreakerConfig {
  /** Failures in a row before opening. Default 5. */
  failureThreshold: number;
  /** ms before half-open probe. Default 30_000. */
  cooldownMs: number;
  /** Successes needed in half-open to fully close. Default 1. */
  halfOpenProbeSuccesses: number;
}

export interface BreakerStatus {
  provider: string;
  state: BreakerState;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  /** Next probe time when in OPEN. */
  retryAt?: number;
}

export type BreakerOutcome<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      reason: "open" | "thrown";
      message?: string;
    };

const DEFAULTS: BreakerConfig = {
  failureThreshold: 5,
  cooldownMs: 30_000,
  halfOpenProbeSuccesses: 1,
};

// ── Per-provider state ────────────────────────────────────────────────────

const STATE = new Map<
  string,
  {
    state: BreakerState;
    failures: number;
    successes: number;
    retryAt: number;
  }
>();

function getState(provider: string) {
  let s = STATE.get(provider);
  if (!s) {
    s = { state: "closed", failures: 0, successes: 0, retryAt: 0 };
    STATE.set(provider, s);
  }
  return s;
}

export function _resetForTests(): void {
  STATE.clear();
}

// ── Public API ────────────────────────────────────────────────────────────

export function getStatus(provider: string): BreakerStatus {
  const s = getState(provider);
  return {
    provider,
    state: s.state,
    consecutiveFailures: s.failures,
    consecutiveSuccesses: s.successes,
    retryAt: s.state === "open" ? s.retryAt : undefined,
  };
}

/**
 * Wrap an async call with breaker state machine. Returns a structured
 * outcome — never throws. Caller decides whether to retry or surface
 * the failure to the user.
 */
export async function callWithBreaker<T>(
  provider: string,
  fn: () => Promise<T>,
  options: Partial<BreakerConfig> & { now?: () => number } = {},
): Promise<BreakerOutcome<T>> {
  const cfg = { ...DEFAULTS, ...options };
  const now = options.now ? options.now() : Date.now();
  const s = getState(provider);

  // ── State machine: OPEN → maybe HALF-OPEN ──
  if (s.state === "open") {
    if (now < s.retryAt) {
      return {
        ok: false,
        reason: "open",
        message: `Breaker open for ${provider} until ${new Date(s.retryAt).toISOString()}`,
      };
    }
    s.state = "half-open";
    s.successes = 0;
  }

  try {
    const value = await fn();
    onSuccess(s, cfg);
    return { ok: true, value };
  } catch (err) {
    onFailure(s, cfg, now);
    return {
      ok: false,
      reason: "thrown",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

function onSuccess(
  s: {
    state: BreakerState;
    failures: number;
    successes: number;
    retryAt: number;
  },
  cfg: BreakerConfig,
): void {
  s.failures = 0;
  if (s.state === "half-open") {
    s.successes++;
    if (s.successes >= cfg.halfOpenProbeSuccesses) {
      s.state = "closed";
      s.successes = 0;
    }
  } else {
    s.successes++;
  }
}

function onFailure(
  s: {
    state: BreakerState;
    failures: number;
    successes: number;
    retryAt: number;
  },
  cfg: BreakerConfig,
  now: number,
): void {
  s.successes = 0;
  s.failures++;
  if (s.state === "half-open") {
    // A failure during probe re-opens immediately.
    s.state = "open";
    s.retryAt = now + cfg.cooldownMs;
    return;
  }
  if (s.state === "closed" && s.failures >= cfg.failureThreshold) {
    s.state = "open";
    s.retryAt = now + cfg.cooldownMs;
  }
}
