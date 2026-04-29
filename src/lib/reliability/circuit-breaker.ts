/**
 * CIRCUIT BREAKER — reliability primitive (R48).
 *
 * The "Stripe-shape" infrastructure pattern: when an upstream
 * dependency starts failing, stop hammering it. Three-state machine
 * (closed → open → half-open) with automatic recovery and bounded
 * concurrent probes.
 *
 * Why this matters at $100B-shape scale:
 *   - One degraded provider (Anthropic, OpenAI, Gemini, NIM) cannot
 *     cascade into platform-wide outage
 *   - The cost-runaway guard handles BUDGET; the circuit breaker
 *     handles AVAILABILITY. Both are required for reliability.
 *   - The state machine is observable: every transition writes an
 *     event that surfaces in /reliability + signed attestations
 *
 * Pure-function evaluator (`evaluateCircuitState`) — same inputs →
 * same state transitions, every time. No DB; the breaker state lives
 * in memory per process. R49 will optionally persist it to Redis for
 * cluster-wide consistency.
 *
 * USAGE:
 *
 *   const breaker = getCircuitBreaker("anthropic-claude");
 *   const result = await breaker.run(() => callAnthropic(prompt));
 *   // throws CircuitOpenError if blocked at the gate
 *   // throws UpstreamFailedError if the call ran and threw
 *
 * STATE MACHINE:
 *
 *   CLOSED ──[failure threshold reached]──> OPEN
 *      ▲                                      │
 *      │                                      │ [openDurationMs elapsed]
 *      │                                      ▼
 *      └──[probe succeeds]──── HALF_OPEN ◄────┘
 *
 *   - CLOSED: normal operation; calls pass through.
 *   - OPEN: all calls fast-fail with CIRCUIT_OPEN. After a cool-off
 *     window, breaker transitions to HALF_OPEN.
 *   - HALF_OPEN: ONE probe is allowed through. Success → CLOSED.
 *     Failure → OPEN for another cool-off cycle.
 *
 * Default thresholds (calibrated to typical LLM provider behaviour):
 *   - failureThreshold: 5 failures within slidingWindowMs
 *   - slidingWindowMs: 60_000 (1 minute)
 *   - openDurationMs: 30_000 (30 second cool-off)
 *   - halfOpenProbeLimit: 1 (single concurrent probe allowed)
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitConfig {
  /** Stable id for observability + audit logs. */
  key: string;
  /** Failures within slidingWindow that flip CLOSED → OPEN. */
  failureThreshold: number;
  /** Sliding window for failure counting (ms). */
  slidingWindowMs: number;
  /** How long OPEN persists before HALF_OPEN probe (ms). */
  openDurationMs: number;
  /** Max concurrent probes during HALF_OPEN. */
  halfOpenProbeLimit: number;
  /** Optional clock for testability. */
  now?: () => number;
}

export const DEFAULT_CIRCUIT_CONFIG: Omit<CircuitConfig, "key" | "now"> = {
  failureThreshold: 5,
  slidingWindowMs: 60_000,
  openDurationMs: 30_000,
  halfOpenProbeLimit: 1,
};

/**
 * Internal state shape. Exposed for unit tests + observability.
 * The pure `evaluateCircuitState` function works on this shape so
 * the state machine is testable without instantiating timers.
 */
export interface CircuitInternalState {
  state: CircuitState;
  /** Timestamps of recent failures (within slidingWindow). */
  failureTimestamps: number[];
  /** When the breaker entered OPEN (used to compute HALF_OPEN transition). */
  openedAt: number | null;
  /** How many probes are currently in-flight in HALF_OPEN. */
  inFlightProbes: number;
  /** Total successes / failures since process start (lifetime stats). */
  totalSuccesses: number;
  totalFailures: number;
  /** Timestamp of most recent state transition. */
  lastTransitionAt: number;
}

/**
 * Custom errors so callers can branch:
 *   - CircuitOpenError → fast-fail; do not retry, call elsewhere.
 *   - UpstreamFailedError → call ran, threw; standard retry logic.
 */
export class CircuitOpenError extends Error {
  readonly code = "CIRCUIT_OPEN" as const;
  constructor(public readonly key: string, public readonly state: CircuitState) {
    super(`circuit ${key} is ${state}; fast-failing`);
    this.name = "CircuitOpenError";
  }
}

export class UpstreamFailedError extends Error {
  readonly code = "UPSTREAM_FAILED" as const;
  constructor(public readonly key: string, public readonly cause: unknown) {
    super(`upstream ${key} failed: ${String(cause)}`);
    this.name = "UpstreamFailedError";
  }
}

/**
 * PURE FUNCTION. Given a current state + config + an event, return
 * the next state. The CircuitBreaker class is a thin wrapper that
 * holds the state and hands it to this function.
 *
 * Events:
 *   - "request_attempt": gate decision — should we proceed or block?
 *   - "request_success": a request succeeded
 *   - "request_failure": a request failed
 *
 * Returns:
 *   - the new state object
 *   - a `gate` decision: "allow" | "block_open" | "allow_probe"
 */
export function evaluateCircuitState(input: {
  state: CircuitInternalState;
  event: "request_attempt" | "request_success" | "request_failure";
  now: number;
  config: CircuitConfig;
}): {
  state: CircuitInternalState;
  gate: "allow" | "block_open" | "allow_probe";
} {
  const { state: prev, event, now, config } = input;
  // Drop failures older than the sliding window — pure pruning step.
  const recentFailures = prev.failureTimestamps.filter(
    (t) => now - t < config.slidingWindowMs,
  );

  if (event === "request_attempt") {
    if (prev.state === "OPEN") {
      // Maybe transition to HALF_OPEN if cool-off elapsed.
      if (
        prev.openedAt !== null &&
        now - prev.openedAt >= config.openDurationMs
      ) {
        // Allow ONE probe.
        if (prev.inFlightProbes < config.halfOpenProbeLimit) {
          return {
            state: {
              ...prev,
              state: "HALF_OPEN",
              failureTimestamps: recentFailures,
              inFlightProbes: prev.inFlightProbes + 1,
              lastTransitionAt: now,
            },
            gate: "allow_probe",
          };
        }
        // Probe slot full — keep blocking.
        return {
          state: { ...prev, failureTimestamps: recentFailures },
          gate: "block_open",
        };
      }
      // Still cooling off.
      return {
        state: { ...prev, failureTimestamps: recentFailures },
        gate: "block_open",
      };
    }

    if (prev.state === "HALF_OPEN") {
      if (prev.inFlightProbes < config.halfOpenProbeLimit) {
        return {
          state: {
            ...prev,
            failureTimestamps: recentFailures,
            inFlightProbes: prev.inFlightProbes + 1,
          },
          gate: "allow_probe",
        };
      }
      return {
        state: { ...prev, failureTimestamps: recentFailures },
        gate: "block_open",
      };
    }

    // CLOSED: pass through.
    return {
      state: { ...prev, failureTimestamps: recentFailures },
      gate: "allow",
    };
  }

  if (event === "request_success") {
    const updated: CircuitInternalState = {
      ...prev,
      failureTimestamps: recentFailures,
      totalSuccesses: prev.totalSuccesses + 1,
      // Decrement probe slot if we were in HALF_OPEN.
      inFlightProbes:
        prev.state === "HALF_OPEN" || prev.state === "OPEN"
          ? Math.max(0, prev.inFlightProbes - 1)
          : prev.inFlightProbes,
    };
    if (prev.state === "HALF_OPEN") {
      // Probe success → CLOSED.
      return {
        state: {
          ...updated,
          state: "CLOSED",
          openedAt: null,
          lastTransitionAt: now,
          // On recovery, clear the failure window so a single recent
          // bad cycle doesn't immediately re-trip.
          failureTimestamps: [],
        },
        gate: "allow",
      };
    }
    return { state: updated, gate: "allow" };
  }

  // request_failure
  const newFailures = [...recentFailures, now];
  const updated: CircuitInternalState = {
    ...prev,
    failureTimestamps: newFailures,
    totalFailures: prev.totalFailures + 1,
    inFlightProbes:
      prev.state === "HALF_OPEN" || prev.state === "OPEN"
        ? Math.max(0, prev.inFlightProbes - 1)
        : prev.inFlightProbes,
  };

  if (prev.state === "HALF_OPEN") {
    // Probe failed — back to OPEN with reset cool-off.
    return {
      state: {
        ...updated,
        state: "OPEN",
        openedAt: now,
        lastTransitionAt: now,
      },
      gate: "block_open",
    };
  }

  // CLOSED + threshold check → OPEN if too many failures.
  if (newFailures.length >= config.failureThreshold) {
    return {
      state: {
        ...updated,
        state: "OPEN",
        openedAt: now,
        lastTransitionAt: now,
      },
      gate: "block_open",
    };
  }

  return { state: updated, gate: "allow" };
}

/**
 * Stateful wrapper around `evaluateCircuitState`. Holds the state
 * for one circuit (e.g., one upstream provider) and provides
 * `run()` for callers.
 */
export class CircuitBreaker {
  private state: CircuitInternalState;
  private readonly config: CircuitConfig;
  private readonly nowFn: () => number;

  constructor(config: Partial<CircuitConfig> & { key: string }) {
    this.config = {
      ...DEFAULT_CIRCUIT_CONFIG,
      ...config,
    };
    this.nowFn = config.now ?? (() => Date.now());
    this.state = {
      state: "CLOSED",
      failureTimestamps: [],
      openedAt: null,
      inFlightProbes: 0,
      totalSuccesses: 0,
      totalFailures: 0,
      lastTransitionAt: this.nowFn(),
    };
  }

  /** Read-only view of internal state — for observability. */
  inspect(): Readonly<CircuitInternalState> {
    return this.state;
  }

  /**
   * Run the upstream call through the breaker. Throws
   * `CircuitOpenError` if the gate blocks; `UpstreamFailedError`
   * if the call runs and throws.
   */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    const now = this.nowFn();
    const attempt = evaluateCircuitState({
      state: this.state,
      event: "request_attempt",
      now,
      config: this.config,
    });
    this.state = attempt.state;
    if (attempt.gate === "block_open") {
      throw new CircuitOpenError(this.config.key, this.state.state);
    }

    try {
      const result = await fn();
      const success = evaluateCircuitState({
        state: this.state,
        event: "request_success",
        now: this.nowFn(),
        config: this.config,
      });
      this.state = success.state;
      return result;
    } catch (err) {
      const failure = evaluateCircuitState({
        state: this.state,
        event: "request_failure",
        now: this.nowFn(),
        config: this.config,
      });
      this.state = failure.state;
      throw new UpstreamFailedError(this.config.key, err);
    }
  }
}

/**
 * Process-wide registry. Most callers want a single breaker per
 * upstream key — this is the convenient lookup.
 */
const breakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(
  key: string,
  config?: Partial<CircuitConfig>,
): CircuitBreaker {
  const existing = breakers.get(key);
  if (existing) return existing;
  const created = new CircuitBreaker({ key, ...config });
  breakers.set(key, created);
  return created;
}

/**
 * Test helper. Resets all breakers — used by integration tests so
 * suite ordering doesn't leak state across tests.
 */
export function _resetAllCircuitBreakersForTesting(): void {
  breakers.clear();
}
