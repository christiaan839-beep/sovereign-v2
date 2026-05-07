import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createRouter,
  BudgetExceededError,
  AllProvidersFailedError,
  _resetInMemorySpend,
} from "../src/index";

beforeEach(() => {
  _resetInMemorySpend();
  vi.unstubAllGlobals();
});

function mockFetchOk(text: string, inputTokens = 100, outputTokens = 50) {
  // Return a response shape that satisfies BOTH OpenAI-compatible
  // (choices[].message.content + usage.prompt_tokens) AND Anthropic
  // (content[].text + usage.input_tokens). The provider clients read
  // their own fields; the others are ignored.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        // OpenAI-compatible shape
        choices: [{ message: { content: text } }],
        usage: {
          prompt_tokens: inputTokens,
          completion_tokens: outputTokens,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        },
        // Anthropic shape
        content: [{ text }],
      }),
      text: async () => "",
    }),
  );
}

function mockFetchError(status = 500) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: async () => ({}),
      text: async () => "service unavailable",
    }),
  );
}

describe("createRouter", () => {
  it("routes to the first available provider in priority order", async () => {
    mockFetchOk("hello from cerebras", 10, 5);
    const router = createRouter({
      providers: [
        { name: "cerebras", apiKey: "test" },
        { name: "anthropic", apiKey: "test" },
      ],
      defaultPriority: "balanced",
    });
    const result = await router.complete({ prompt: "hi" });
    expect(result.text).toBe("hello from cerebras");
    expect(result.providerUsed).toBe("cerebras");
    expect(result.fallbacksTried).toEqual([]);
    expect(result.costCents).toBe(0); // free provider
  });

  it("falls through to next provider on error", async () => {
    let callCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            ok: false,
            status: 500,
            text: async () => "down",
            json: async () => ({}),
          };
        }
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: "fallback worked" } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
        };
      }),
    );
    const router = createRouter({
      providers: [
        { name: "cerebras", apiKey: "test" },
        { name: "nvidia-nim", apiKey: "test" },
      ],
    });
    const result = await router.complete({ prompt: "hi" });
    expect(result.text).toBe("fallback worked");
    expect(result.fallbacksTried).toEqual(["cerebras"]);
  });

  it("throws AllProvidersFailedError when every provider fails", async () => {
    mockFetchError(503);
    const router = createRouter({
      providers: [
        { name: "cerebras", apiKey: "test" },
        { name: "nvidia-nim", apiKey: "test" },
      ],
    });
    await expect(router.complete({ prompt: "hi" })).rejects.toThrow(
      AllProvidersFailedError,
    );
  });

  it("respects forced provider (bypasses routing)", async () => {
    mockFetchOk("forced-output", 100, 50);
    const router = createRouter({
      providers: [
        { name: "cerebras", apiKey: "test" },
        { name: "openai", apiKey: "test" },
      ],
    });
    const result = await router.complete({
      prompt: "hi",
      provider: "openai",
      model: "gpt-4o-mini",
    });
    expect(result.providerUsed).toBe("openai");
    expect(result.modelUsed).toBe("gpt-4o-mini");
  });

  it("throws BudgetExceededError when daily cap is hit (onCapReached: throw)", async () => {
    mockFetchOk("ok", 1_000_000, 0); // big paid call
    const router = createRouter({
      providers: [{ name: "anthropic", apiKey: "test" }],
      budget: {
        dailyCapCents: 100,
        onCapReached: "throw",
      },
    });

    // First call: 1M tokens at $3/M = 300 cents > 100 cap. But cap is
    // checked BEFORE the call, so first call goes through (spend was 0).
    const r1 = await router.complete({
      prompt: "x",
      userId: "u1",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    });
    expect(r1.costCents).toBe(300);

    // Second call should be blocked — spend (300) >= cap (100).
    await expect(
      router.complete({ prompt: "y", userId: "u1" }),
    ).rejects.toThrow(BudgetExceededError);
  });

  it("budget cap with silent-skip returns empty result instead of throwing", async () => {
    const router = createRouter({
      providers: [{ name: "anthropic", apiKey: "test" }],
      budget: {
        dailyCapCents: 1,
        onCapReached: "silent-skip",
        readDailySpend: () => 100, // already over cap
      },
    });
    const result = await router.complete({ prompt: "x", userId: "u_blocked" });
    expect(result.text).toBe("");
    expect(result.fallbacksTried).toEqual(["budget-cap"]);
  });

  it("budget hook fires onSpend for paid calls only", async () => {
    mockFetchOk("ok", 1_000_000, 0);
    const onSpend = vi.fn();
    const router = createRouter({
      providers: [{ name: "anthropic", apiKey: "test" }],
      budget: {
        dailyCapCents: 100_000,
        onCapReached: "throw",
        onSpend,
      },
    });
    await router.complete({
      prompt: "x",
      userId: "u_spender",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    });

    // onSpend is fired async — wait a tick.
    await new Promise((r) => setTimeout(r, 10));
    expect(onSpend).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u_spender",
        provider: "anthropic",
        costCents: 300,
      }),
    );
  });
});
