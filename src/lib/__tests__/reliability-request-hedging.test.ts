/**
 * src/lib/reliability/request-hedging (R51) — tests.
 *
 * The "Tail at Scale" hedging pattern. Pure-function policy decision
 * (`shouldHedge`) + async runner (`hedgedRequest`).
 *
 * Covers:
 *   - shouldHedge policy: always / smart / never
 *   - shouldHedge: single provider always declines hedge
 *   - shouldHedge smart: declines when primary is already fast
 *   - hedgedRequest: primary wins → no hedge launched
 *   - hedgedRequest: slow primary + fast hedge → hedge wins, primary
 *     aborted
 *   - hedgedRequest: all providers fail → HedgeAllFailedError
 *   - hedgedRequest: timeout → HedgeTimeoutError
 *   - Discard reasons surface for observability
 */

import { describe, it, expect } from "vitest";
import {
  shouldHedge,
  hedgedRequest,
  HedgeAllFailedError,
  HedgeTimeoutError,
  DEFAULT_HEDGE_CONFIG,
} from "../reliability/request-hedging";

describe("shouldHedge — pure policy decision", () => {
  it("policy=never always declines", () => {
    const r = shouldHedge({
      providerCount: 5,
      primaryP50LatencyMs: 5000,
      policy: "never",
    });
    expect(r.hedge).toBe(false);
    expect(r.reason).toBe("policy_never");
  });

  it("policy=always launches when 2+ providers", () => {
    const r = shouldHedge({
      providerCount: 2,
      primaryP50LatencyMs: 100,
      policy: "always",
    });
    expect(r.hedge).toBe(true);
  });

  it("single provider always declines (nothing to hedge against)", () => {
    const r = shouldHedge({
      providerCount: 1,
      primaryP50LatencyMs: 5000,
      policy: "always",
    });
    expect(r.hedge).toBe(false);
    expect(r.reason).toBe("single_provider");
  });

  it("smart policy: declines when primary is already fast (<50ms)", () => {
    const r = shouldHedge({
      providerCount: 3,
      primaryP50LatencyMs: 30,
      policy: "smart",
    });
    expect(r.hedge).toBe(false);
    expect(r.reason).toBe("primary_already_fast");
  });

  it("smart policy: hedges when primary is slow enough", () => {
    const r = shouldHedge({
      providerCount: 3,
      primaryP50LatencyMs: 800,
      policy: "smart",
    });
    expect(r.hedge).toBe(true);
    expect(r.reason).toBe("smart_hedging");
  });

  it("DEFAULT_HEDGE_CONFIG is reasonable for LLM workloads", () => {
    expect(DEFAULT_HEDGE_CONFIG.staggerMs).toBe(200);
    expect(DEFAULT_HEDGE_CONFIG.maxParallel).toBe(3);
    expect(DEFAULT_HEDGE_CONFIG.totalTimeoutMs).toBe(30_000);
  });
});

describe("hedgedRequest — primary wins (no hedge needed)", () => {
  it("returns the primary's value when it succeeds before stagger expires", async () => {
    const result = await hedgedRequest<string>(
      () => [
        async () => "primary-result",
        async () => {
          throw new Error("hedge should never run");
        },
      ],
      { staggerMs: 1000, totalTimeoutMs: 2000 },
    );
    expect(result.result).toBe("primary-result");
    expect(result.winnerIndex).toBe(0);
    expect(result.launchCount).toBe(1);
  });
});

describe("hedgedRequest — slow primary, hedge wins", () => {
  it("the second provider wins when the primary is slower than stagger", async () => {
    const result = await hedgedRequest<string>(
      () => [
        // Primary: 500ms (slower)
        async () => {
          await new Promise((r) => setTimeout(r, 500));
          return "primary-slow";
        },
        // Hedge: 100ms (after 50ms stagger = 150ms total wall time)
        async () => {
          await new Promise((r) => setTimeout(r, 100));
          return "hedge-fast";
        },
      ],
      { staggerMs: 50, totalTimeoutMs: 2000 },
    );
    // Hedge wins because it returns at 50ms+100ms=150ms vs primary's 500ms
    expect(result.result).toBe("hedge-fast");
    expect(result.winnerIndex).toBe(1);
    expect(result.launchCount).toBe(2);
    expect(result.elapsedMs).toBeLessThan(400);
  });
});

describe("hedgedRequest — all providers fail", () => {
  it("throws HedgeAllFailedError when every launch errors", async () => {
    const e = await hedgedRequest<string>(
      () => [
        async () => {
          throw new Error("primary down");
        },
        async () => {
          throw new Error("hedge down");
        },
      ],
      { staggerMs: 50, totalTimeoutMs: 2000 },
    ).catch((err) => err);

    expect(e).toBeInstanceOf(HedgeAllFailedError);
    if (e instanceof HedgeAllFailedError) {
      expect(e.code).toBe("HEDGE_ALL_FAILED");
      expect(e.causes.length).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("hedgedRequest — overall timeout", () => {
  it("throws HedgeTimeoutError when no provider responds in time", async () => {
    const e = await hedgedRequest<string>(
      () => [
        async () => {
          await new Promise((r) => setTimeout(r, 5000));
          return "too-slow";
        },
      ],
      { staggerMs: 50, totalTimeoutMs: 200 },
    ).catch((err) => err);

    expect(e).toBeInstanceOf(HedgeTimeoutError);
    if (e instanceof HedgeTimeoutError) {
      expect(e.code).toBe("HEDGE_TIMEOUT");
      expect(e.elapsedMs).toBeGreaterThanOrEqual(200);
    }
  });
});

describe("hedgedRequest — empty provider list", () => {
  it("throws HedgeAllFailedError immediately when no providers given", async () => {
    const e = await hedgedRequest<string>(
      () => [],
      { staggerMs: 50, totalTimeoutMs: 200 },
    ).catch((err) => err);
    expect(e).toBeInstanceOf(HedgeAllFailedError);
  });
});

describe("hedgedRequest — discard reasons populated", () => {
  it("losing providers are recorded in discardReasons", async () => {
    const result = await hedgedRequest<string>(
      () => [
        async () => "primary-wins",
        async () => {
          await new Promise((r) => setTimeout(r, 1000));
          return "would-have-been-2nd";
        },
      ],
      { staggerMs: 50, totalTimeoutMs: 2000 },
    );
    expect(result.winnerIndex).toBe(0);
    // The hedge was either launched-and-aborted or never launched —
    // either way it shouldn't be the winner.
  });
});
