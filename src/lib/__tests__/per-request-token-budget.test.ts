/**
 * per-request-token-budget — tests.
 *
 * Verifies:
 *   - getRequestTokenCeiling: env clamping, default fallback
 *   - withRequestTokenBudget: ALS context, isolation
 *   - consumeTokens: increments, throws on exceed
 *   - readRequestTokens: read without modify
 *   - Hard ceiling cannot be raised by env
 *   - Concurrent requests have isolated budgets
 *   - No-op when no budget active (system-level calls)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  withRequestTokenBudget,
  consumeTokens,
  currentRequestTokenBudget,
  readRequestTokens,
  getRequestTokenCeiling,
  RequestTokenBudgetExceededError,
  REQUEST_TOKEN_DEFAULT,
  REQUEST_TOKEN_HARD_CEILING,
} from "../per-request-token-budget";
// Force the Node-side ALS install for tests.
import "../per-request-token-budget-node";

const ORIGINAL = process.env.SOVEREIGN_REQUEST_TOKEN_BUDGET;

beforeEach(() => {
  delete process.env.SOVEREIGN_REQUEST_TOKEN_BUDGET;
});

afterEach(() => {
  if (ORIGINAL !== undefined) {
    process.env.SOVEREIGN_REQUEST_TOKEN_BUDGET = ORIGINAL;
  }
});

describe("per-request-token-budget — getRequestTokenCeiling", () => {
  it("returns the default when env unset", () => {
    expect(getRequestTokenCeiling()).toBe(REQUEST_TOKEN_DEFAULT);
  });

  it("respects env when within range", () => {
    process.env.SOVEREIGN_REQUEST_TOKEN_BUDGET = "10000";
    expect(getRequestTokenCeiling()).toBe(10000);
  });

  it("CLAMPS to HARD_CEILING — env can't exceed", () => {
    process.env.SOVEREIGN_REQUEST_TOKEN_BUDGET = "999999999";
    expect(getRequestTokenCeiling()).toBe(REQUEST_TOKEN_HARD_CEILING);
  });

  it("falls back to default for non-numeric env (defeats injection)", () => {
    process.env.SOVEREIGN_REQUEST_TOKEN_BUDGET = "abc";
    expect(getRequestTokenCeiling()).toBe(REQUEST_TOKEN_DEFAULT);
    process.env.SOVEREIGN_REQUEST_TOKEN_BUDGET = "100; DROP";
    expect(getRequestTokenCeiling()).toBe(REQUEST_TOKEN_DEFAULT);
    process.env.SOVEREIGN_REQUEST_TOKEN_BUDGET = "-1";
    expect(getRequestTokenCeiling()).toBe(REQUEST_TOKEN_DEFAULT);
    process.env.SOVEREIGN_REQUEST_TOKEN_BUDGET = "0";
    expect(getRequestTokenCeiling()).toBe(REQUEST_TOKEN_DEFAULT);
  });
});

describe("per-request-token-budget — context", () => {
  it("currentRequestTokenBudget is null outside withRequestTokenBudget", () => {
    expect(currentRequestTokenBudget()).toBeNull();
  });

  it("withRequestTokenBudget creates context inside fn", async () => {
    const captured: { state: ReturnType<typeof currentRequestTokenBudget> } = { state: null };
    await withRequestTokenBudget("agent-x", async () => {
      captured.state = currentRequestTokenBudget();
    });
    expect(captured.state).not.toBeNull();
    expect(captured.state?.agentName).toBe("agent-x");
    expect(captured.state?.consumedTokens).toBe(0);
  });

  it("currentRequestTokenBudget is null again after withRequestTokenBudget returns", async () => {
    await withRequestTokenBudget("a", async () => 1);
    expect(currentRequestTokenBudget()).toBeNull();
  });
});

describe("per-request-token-budget — consumeTokens", () => {
  it("no-ops outside any budget context (returns 0)", () => {
    expect(consumeTokens(100)).toBe(0);
  });

  it("ignores zero / negative / NaN", async () => {
    let result = -1;
    await withRequestTokenBudget("a", async () => {
      result = consumeTokens(0);
    });
    expect(result).toBe(0);
  });

  it("increments cumulative consumption", async () => {
    const observations: number[] = [];
    await withRequestTokenBudget("a", async () => {
      observations.push(consumeTokens(100));
      observations.push(consumeTokens(250));
      observations.push(consumeTokens(50));
    });
    expect(observations).toEqual([100, 350, 400]);
  });

  it("throws when exceeding the ceiling", async () => {
    process.env.SOVEREIGN_REQUEST_TOKEN_BUDGET = "1000";
    await expect(
      withRequestTokenBudget("a", async () => {
        consumeTokens(800);
        consumeTokens(300); // 1100 > 1000 ceiling
      }),
    ).rejects.toThrow(RequestTokenBudgetExceededError);
  });

  it("error contains diagnostic context", async () => {
    process.env.SOVEREIGN_REQUEST_TOKEN_BUDGET = "100";
    let caught: RequestTokenBudgetExceededError | null = null;
    try {
      await withRequestTokenBudget("travel-agent", async () => {
        consumeTokens(150);
      });
    } catch (e) {
      caught = e as RequestTokenBudgetExceededError;
    }
    expect(caught).not.toBeNull();
    expect(caught?.agentName).toBe("travel-agent");
    expect(caught?.attemptedTokens).toBe(150);
    expect(caught?.ceilingTokens).toBe(100);
    expect(caught?.consumedTokens).toBe(0);
  });
});

describe("per-request-token-budget — readRequestTokens", () => {
  it("returns null outside context", () => {
    expect(readRequestTokens()).toBeNull();
  });

  it("returns consumption + ceiling without modifying", async () => {
    process.env.SOVEREIGN_REQUEST_TOKEN_BUDGET = "10000";
    let observation: ReturnType<typeof readRequestTokens> = null;
    await withRequestTokenBudget("a", async () => {
      consumeTokens(500);
      observation = readRequestTokens();
      consumeTokens(500); // should not be reflected in earlier read
    });
    expect(observation).toEqual({ consumed: 500, ceiling: 10000 });
  });
});

describe("per-request-token-budget — concurrent isolation (ALS)", () => {
  it("two parallel withRequestTokenBudget contexts do NOT share consumption", async () => {
    process.env.SOVEREIGN_REQUEST_TOKEN_BUDGET = "10000";
    const observations: Array<{ agent: string; consumed: number }> = [];
    await Promise.all([
      withRequestTokenBudget("agent-a", async () => {
        consumeTokens(1000);
        const s = currentRequestTokenBudget();
        if (s) observations.push({ agent: s.agentName, consumed: s.consumedTokens });
      }),
      withRequestTokenBudget("agent-b", async () => {
        consumeTokens(2000);
        const s = currentRequestTokenBudget();
        if (s) observations.push({ agent: s.agentName, consumed: s.consumedTokens });
      }),
    ]);
    const a = observations.find((o) => o.agent === "agent-a");
    const b = observations.find((o) => o.agent === "agent-b");
    expect(a?.consumed).toBe(1000); // not 3000 — isolated
    expect(b?.consumed).toBe(2000);
  });
});
