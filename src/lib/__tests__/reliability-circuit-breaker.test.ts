/**
 * src/lib/reliability/circuit-breaker (R48) — tests.
 *
 * Pure-function state machine + stateful wrapper. The generic
 * pattern; coexists with the existing per-provider breakers in
 * src/lib/circuit-breaker.ts.
 *
 * Tests use a fake clock for deterministic timing.
 *
 * Covers:
 *   - CLOSED → OPEN after N failures
 *   - OPEN fast-fails (no upstream call)
 *   - OPEN → HALF_OPEN after cool-off elapses
 *   - HALF_OPEN probe success → CLOSED (recovered)
 *   - HALF_OPEN probe failure → OPEN (re-tripped)
 *   - Sliding window prunes old failures
 *   - HALF_OPEN concurrent-probe limit honored
 *   - Recovery clears the failure window
 *   - Lifetime success/failure counters increment
 *   - getCircuitBreaker() returns the same instance per key
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  evaluateCircuitState,
  CircuitBreaker,
  CircuitOpenError,
  UpstreamFailedError,
  getCircuitBreaker,
  _resetAllCircuitBreakersForTesting,
  type CircuitInternalState,
  type CircuitConfig,
} from "../reliability/circuit-breaker";

const config: CircuitConfig = {
  key: "test",
  failureThreshold: 3,
  slidingWindowMs: 60_000,
  openDurationMs: 30_000,
  halfOpenProbeLimit: 1,
};

const initialState = (): CircuitInternalState => ({
  state: "CLOSED",
  failureTimestamps: [],
  openedAt: null,
  inFlightProbes: 0,
  totalSuccesses: 0,
  totalFailures: 0,
  lastTransitionAt: 0,
});

describe("evaluateCircuitState (pure)", () => {
  it("CLOSED + first attempt → allow, no state change", () => {
    const r = evaluateCircuitState({
      state: initialState(),
      event: "request_attempt",
      now: 1000,
      config,
    });
    expect(r.gate).toBe("allow");
    expect(r.state.state).toBe("CLOSED");
  });

  it("CLOSED + success → allow, increments totalSuccesses", () => {
    const r = evaluateCircuitState({
      state: initialState(),
      event: "request_success",
      now: 1000,
      config,
    });
    expect(r.state.totalSuccesses).toBe(1);
    expect(r.state.state).toBe("CLOSED");
  });

  it("CLOSED + failure (below threshold) → stays CLOSED", () => {
    let s = initialState();
    for (let i = 0; i < 2; i++) {
      const r = evaluateCircuitState({
        state: s,
        event: "request_failure",
        now: 1000 + i,
        config,
      });
      s = r.state;
    }
    expect(s.state).toBe("CLOSED");
    expect(s.failureTimestamps.length).toBe(2);
  });

  it("CLOSED → OPEN when failure threshold reached", () => {
    let s = initialState();
    for (let i = 0; i < 3; i++) {
      const r = evaluateCircuitState({
        state: s,
        event: "request_failure",
        now: 1000 + i,
        config,
      });
      s = r.state;
    }
    expect(s.state).toBe("OPEN");
    expect(s.openedAt).toBe(1002);
  });

  it("OPEN + attempt before cool-off → block_open", () => {
    const opened: CircuitInternalState = {
      ...initialState(),
      state: "OPEN",
      openedAt: 1000,
      failureTimestamps: [990, 995, 1000],
    };
    const r = evaluateCircuitState({
      state: opened,
      event: "request_attempt",
      now: 1500,
      config,
    });
    expect(r.gate).toBe("block_open");
    expect(r.state.state).toBe("OPEN");
  });

  it("OPEN → HALF_OPEN after cool-off; first attempt is allow_probe", () => {
    const opened: CircuitInternalState = {
      ...initialState(),
      state: "OPEN",
      openedAt: 1000,
      failureTimestamps: [990, 995, 1000],
    };
    const r = evaluateCircuitState({
      state: opened,
      event: "request_attempt",
      now: 31_500,
      config,
    });
    expect(r.gate).toBe("allow_probe");
    expect(r.state.state).toBe("HALF_OPEN");
    expect(r.state.inFlightProbes).toBe(1);
  });

  it("HALF_OPEN + success → CLOSED with cleared failure window", () => {
    const halfOpen: CircuitInternalState = {
      ...initialState(),
      state: "HALF_OPEN",
      inFlightProbes: 1,
      failureTimestamps: [990, 995, 1000],
    };
    const r = evaluateCircuitState({
      state: halfOpen,
      event: "request_success",
      now: 32_000,
      config,
    });
    expect(r.state.state).toBe("CLOSED");
    expect(r.state.failureTimestamps).toEqual([]);
    expect(r.state.inFlightProbes).toBe(0);
  });

  it("HALF_OPEN + failure → OPEN again with reset cool-off", () => {
    const halfOpen: CircuitInternalState = {
      ...initialState(),
      state: "HALF_OPEN",
      inFlightProbes: 1,
      failureTimestamps: [990, 995, 1000],
      openedAt: 1000,
    };
    const r = evaluateCircuitState({
      state: halfOpen,
      event: "request_failure",
      now: 32_000,
      config,
    });
    expect(r.state.state).toBe("OPEN");
    expect(r.state.openedAt).toBe(32_000);
    expect(r.state.inFlightProbes).toBe(0);
  });

  it("HALF_OPEN concurrent-probe limit honored", () => {
    const halfOpen: CircuitInternalState = {
      ...initialState(),
      state: "HALF_OPEN",
      inFlightProbes: 1,
    };
    const r = evaluateCircuitState({
      state: halfOpen,
      event: "request_attempt",
      now: 32_000,
      config,
    });
    expect(r.gate).toBe("block_open");
  });

  it("sliding window prunes old failures", () => {
    let s = initialState();
    for (let i = 0; i < 2; i++) {
      const r = evaluateCircuitState({
        state: s,
        event: "request_failure",
        now: 1000 + i,
        config,
      });
      s = r.state;
    }
    const future = evaluateCircuitState({
      state: s,
      event: "request_attempt",
      now: 1_000_000,
      config,
    });
    expect(future.state.failureTimestamps).toEqual([]);
  });
});

describe("CircuitBreaker class", () => {
  it("CLOSED breaker: successful calls pass through and count successes", async () => {
    const cb = new CircuitBreaker({ key: "test", failureThreshold: 3 });
    const result = await cb.run(async () => "ok");
    expect(result).toBe("ok");
    expect(cb.inspect().totalSuccesses).toBe(1);
    expect(cb.inspect().state).toBe("CLOSED");
  });

  it("threshold failures → breaker opens; subsequent calls fast-fail", async () => {
    const cb = new CircuitBreaker({ key: "test", failureThreshold: 2 });
    for (let i = 0; i < 2; i++) {
      await expect(
        cb.run(async () => {
          throw new Error("upstream");
        }),
      ).rejects.toBeInstanceOf(UpstreamFailedError);
    }
    expect(cb.inspect().state).toBe("OPEN");
    let ranInner = false;
    await expect(
      cb.run(async () => {
        ranInner = true;
        return "x";
      }),
    ).rejects.toBeInstanceOf(CircuitOpenError);
    expect(ranInner).toBe(false);
  });

  it("OPEN → HALF_OPEN → CLOSED after cool-off and probe success", async () => {
    let now = 1000;
    const cb = new CircuitBreaker({
      key: "test",
      failureThreshold: 2,
      openDurationMs: 100,
      now: () => now,
    });
    for (let i = 0; i < 2; i++) {
      await expect(
        cb.run(async () => {
          throw new Error("nope");
        }),
      ).rejects.toBeInstanceOf(UpstreamFailedError);
    }
    expect(cb.inspect().state).toBe("OPEN");
    now = 2000;
    const result = await cb.run(async () => "recovered");
    expect(result).toBe("recovered");
    expect(cb.inspect().state).toBe("CLOSED");
    expect(cb.inspect().failureTimestamps).toEqual([]);
  });

  it("HALF_OPEN probe failure → re-trips OPEN", async () => {
    let now = 1000;
    const cb = new CircuitBreaker({
      key: "test",
      failureThreshold: 2,
      openDurationMs: 100,
      now: () => now,
    });
    for (let i = 0; i < 2; i++) {
      await expect(
        cb.run(async () => {
          throw new Error("nope");
        }),
      ).rejects.toBeInstanceOf(UpstreamFailedError);
    }
    now = 2000;
    await expect(
      cb.run(async () => {
        throw new Error("still down");
      }),
    ).rejects.toBeInstanceOf(UpstreamFailedError);
    expect(cb.inspect().state).toBe("OPEN");
    expect(cb.inspect().openedAt).toBe(2000);
  });

  it("CircuitOpenError carries key + state for ops observability", async () => {
    const cb = new CircuitBreaker({ key: "anthropic", failureThreshold: 1 });
    await expect(
      cb.run(async () => {
        throw new Error("first failure");
      }),
    ).rejects.toBeInstanceOf(UpstreamFailedError);
    try {
      await cb.run(async () => "blocked");
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CircuitOpenError);
      if (err instanceof CircuitOpenError) {
        expect(err.code).toBe("CIRCUIT_OPEN");
        expect(err.key).toBe("anthropic");
      }
    }
  });
});

describe("getCircuitBreaker registry", () => {
  beforeEach(() => {
    _resetAllCircuitBreakersForTesting();
  });

  it("returns the same instance for the same key", () => {
    const a = getCircuitBreaker("foo");
    const b = getCircuitBreaker("foo");
    expect(a).toBe(b);
  });

  it("returns different instances for different keys", () => {
    const a = getCircuitBreaker("foo");
    const b = getCircuitBreaker("bar");
    expect(a).not.toBe(b);
  });
});
