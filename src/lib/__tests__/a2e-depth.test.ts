/**
 * a2e-depth — tests.
 *
 * Verifies:
 *   - Pure-function getA2eMaxDepth respects env, falls back, clamps to ceiling
 *   - withA2eDepthCheck increments + decrements correctly
 *   - Depth exceeded throws A2eDepthExceededError BEFORE invoking fn
 *   - Hard ceiling cannot be exceeded by env config (defence-in-depth)
 *   - Concurrent calls maintain independent depth (ALS or fallback)
 *   - currentA2eDepth returns 0 outside of any enter()
 *
 * The DB-backed integration is out of scope (no DB needed).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  withA2eDepthCheck,
  currentA2eDepth,
  getA2eMaxDepth,
  A2eDepthExceededError,
  A2E_HARD_CEILING,
  A2E_DEFAULT_LIMIT,
} from "../a2e-depth";
// Force the Node-side ALS install for tests.
import "../a2e-depth-node";

const ORIGINAL = process.env.SOVEREIGN_A2E_MAX_DEPTH;

beforeEach(() => {
  delete process.env.SOVEREIGN_A2E_MAX_DEPTH;
});

afterEach(() => {
  if (ORIGINAL !== undefined) {
    process.env.SOVEREIGN_A2E_MAX_DEPTH = ORIGINAL;
  }
  vi.restoreAllMocks();
});

describe("a2e-depth — getA2eMaxDepth", () => {
  it("returns the default when env is unset", () => {
    expect(getA2eMaxDepth()).toBe(A2E_DEFAULT_LIMIT);
  });

  it("respects env when within range", () => {
    process.env.SOVEREIGN_A2E_MAX_DEPTH = "3";
    expect(getA2eMaxDepth()).toBe(3);
  });

  it("CLAMPS to A2E_HARD_CEILING — env can't exceed (defence-in-depth)", () => {
    process.env.SOVEREIGN_A2E_MAX_DEPTH = "999";
    expect(getA2eMaxDepth()).toBe(A2E_HARD_CEILING);
  });

  it("falls back to default for non-numeric env", () => {
    process.env.SOVEREIGN_A2E_MAX_DEPTH = "not-a-number";
    expect(getA2eMaxDepth()).toBe(A2E_DEFAULT_LIMIT);
  });

  it("falls back to default for negative or zero env", () => {
    process.env.SOVEREIGN_A2E_MAX_DEPTH = "0";
    expect(getA2eMaxDepth()).toBe(A2E_DEFAULT_LIMIT);
    process.env.SOVEREIGN_A2E_MAX_DEPTH = "-1";
    expect(getA2eMaxDepth()).toBe(A2E_DEFAULT_LIMIT);
  });
});

describe("a2e-depth — withA2eDepthCheck depth increment", () => {
  it("returns the result of fn unchanged", async () => {
    const result = await withA2eDepthCheck("agent-x", async () => 42);
    expect(result).toBe(42);
  });

  it("inside enter(), depth is 1", async () => {
    let observed = -1;
    await withA2eDepthCheck("agent-x", async () => {
      observed = currentA2eDepth();
    });
    expect(observed).toBe(1);
  });

  it("nested enter()s see incremented depth", async () => {
    const observations: number[] = [];
    await withA2eDepthCheck("outer", async () => {
      observations.push(currentA2eDepth());
      await withA2eDepthCheck("middle", async () => {
        observations.push(currentA2eDepth());
        await withA2eDepthCheck("inner", async () => {
          observations.push(currentA2eDepth());
        });
      });
    });
    expect(observations).toEqual([1, 2, 3]);
  });

  it("depth restores to 0 after enter() resolves", async () => {
    expect(currentA2eDepth()).toBe(0);
    await withA2eDepthCheck("agent-x", async () => 1);
    // Edge fallback uses a per-instance counter that decrements in
    // finally{}; ALS-backed implementation re-shadows. Either way,
    // outside of enter(), depth is back to 0.
    expect(currentA2eDepth()).toBe(0);
  });

  it("depth restores to 0 after enter() THROWS", async () => {
    expect(currentA2eDepth()).toBe(0);
    await expect(
      withA2eDepthCheck("agent-x", async () => {
        throw new Error("inner failure");
      }),
    ).rejects.toThrow("inner failure");
    expect(currentA2eDepth()).toBe(0);
  });
});

describe("a2e-depth — limit enforcement", () => {
  it("throws A2eDepthExceededError BEFORE invoking fn when limit reached", async () => {
    process.env.SOVEREIGN_A2E_MAX_DEPTH = "2";
    const fn = vi.fn(async () => "should-not-run");
    let caught: unknown;
    try {
      await withA2eDepthCheck("a", () =>
        withA2eDepthCheck("b", () =>
          withA2eDepthCheck("c", async () => {
            await fn();
            return "leaf";
          }),
        ),
      );
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(A2eDepthExceededError);
    expect((caught as A2eDepthExceededError).agentName).toBe("c");
    expect((caught as A2eDepthExceededError).limit).toBe(2);
    expect(fn).not.toHaveBeenCalled();
  });

  it("hard ceiling: env=99 still caps recursion at A2E_HARD_CEILING", async () => {
    process.env.SOVEREIGN_A2E_MAX_DEPTH = "99";
    expect(getA2eMaxDepth()).toBe(A2E_HARD_CEILING);
  });

  it("error includes the agent name + depth context", async () => {
    process.env.SOVEREIGN_A2E_MAX_DEPTH = "1";
    let caught: A2eDepthExceededError | null = null;
    try {
      await withA2eDepthCheck("outer", () =>
        withA2eDepthCheck("inner", async () => "x"),
      );
    } catch (e) {
      caught = e as A2eDepthExceededError;
    }
    expect(caught).not.toBeNull();
    expect(caught?.agentName).toBe("inner");
    expect(caught?.limit).toBe(1);
    expect(caught?.message).toContain("inner");
    expect(caught?.message).toContain("1");
  });
});

describe("a2e-depth — concurrent calls are independent", () => {
  it("two concurrent enter()s do NOT share depth (ALS isolation)", async () => {
    process.env.SOVEREIGN_A2E_MAX_DEPTH = "2";
    // Run two parallel chains, each goes 2 levels deep. Neither should
    // see the OTHER's depth — ALS provides per-async-context isolation.
    const observations: Array<{ chain: string; depth: number }> = [];
    await Promise.all([
      withA2eDepthCheck("chainA-outer", () =>
        withA2eDepthCheck("chainA-inner", async () => {
          observations.push({ chain: "A", depth: currentA2eDepth() });
        }),
      ),
      withA2eDepthCheck("chainB-outer", () =>
        withA2eDepthCheck("chainB-inner", async () => {
          observations.push({ chain: "B", depth: currentA2eDepth() });
        }),
      ),
    ]);
    expect(observations).toHaveLength(2);
    expect(observations.every((o) => o.depth === 2)).toBe(true);
  });
});
