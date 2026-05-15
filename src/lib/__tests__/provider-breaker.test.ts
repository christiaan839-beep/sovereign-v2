/**
 * Tests for src/lib/provider-breaker.ts — Cook 104.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  _resetForTests,
  callWithBreaker,
  getStatus,
} from "../provider-breaker";

beforeEach(() => {
  _resetForTests();
});

describe("callWithBreaker — closed state", () => {
  it("returns ok on a successful call", async () => {
    const r = await callWithBreaker("p1", async () => "value");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe("value");
    expect(getStatus("p1").state).toBe("closed");
  });

  it("returns thrown outcome when the call throws", async () => {
    const r = await callWithBreaker("p1", async () => {
      throw new Error("boom");
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("thrown");
      expect(r.message).toContain("boom");
    }
  });
});

describe("callWithBreaker — opens after threshold", () => {
  it("opens after N consecutive failures", async () => {
    const fail = () =>
      callWithBreaker("p2", async () => {
        throw new Error("nope");
      });
    for (let i = 0; i < 5; i++) {
      await fail();
    }
    const status = getStatus("p2");
    expect(status.state).toBe("open");
    expect(status.consecutiveFailures).toBe(5);
  });

  it("short-circuits with 'open' once tripped", async () => {
    // Trip the breaker.
    for (let i = 0; i < 5; i++) {
      await callWithBreaker("p3", async () => {
        throw new Error("nope");
      });
    }
    // Next call should short-circuit.
    const handler = vi.fn();
    const r = await callWithBreaker("p3", async () => {
      handler();
      return "x";
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("open");
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("callWithBreaker — half-open recovery", () => {
  it("transitions OPEN → HALF-OPEN → CLOSED on probe success", async () => {
    // Trip.
    for (let i = 0; i < 5; i++) {
      await callWithBreaker("p4", async () => {
        throw new Error("x");
      });
    }
    expect(getStatus("p4").state).toBe("open");
    // After cooldown, the next call should probe (half-open).
    const now = Date.now() + 60_000;
    const probe = await callWithBreaker("p4", async () => "ok", {
      now: () => now,
    });
    expect(probe.ok).toBe(true);
    // 1 success in half-open closes the breaker (default).
    expect(getStatus("p4").state).toBe("closed");
  });

  it("re-opens on probe failure", async () => {
    for (let i = 0; i < 5; i++) {
      await callWithBreaker("p5", async () => {
        throw new Error("x");
      });
    }
    const now = Date.now() + 60_000;
    await callWithBreaker(
      "p5",
      async () => {
        throw new Error("still bad");
      },
      { now: () => now },
    );
    expect(getStatus("p5").state).toBe("open");
  });
});
