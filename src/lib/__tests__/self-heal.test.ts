/**
 * Unit tests for self-heal wrapper.
 *
 * We stub the `nimChat` diagnoser so tests are deterministic without
 * burning NIM tokens. The scenarios we care about:
 *   1. happy path — handler succeeds first try, no heal overhead
 *   2. retry-then-succeed — handler fails once, diagnoser proposes new
 *      input, retry succeeds, _healAttempts trail attached
 *   3. terminal error — "unauthorized" never triggers diagnosis
 *   4. retries exhausted — throws the original error enriched with trail
 *   5. invalid diagnoser proposal — schema check rejects the proposal
 *      and we stop retrying
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { withSelfHeal } from "../self-heal";

// Mock the NIM diagnoser. Each test sets the next return value.
vi.mock("../nvidia", () => ({
  nimChat: vi.fn(),
  NIM_MODELS: { flagship: "nvidia/test-flagship" },
}));

// Mock the logger so we don't pollute test output
vi.mock("../logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { nimChat } from "../nvidia";

const mockNimChat = nimChat as unknown as ReturnType<typeof vi.fn>;

describe("withSelfHeal", () => {
  beforeEach(() => {
    mockNimChat.mockReset();
  });

  it("happy path — no diagnosis when handler succeeds", async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true, value: 42 });
    const wrapped = withSelfHeal(handler, { label: "happy" });

    const result = await wrapped({ input: { q: "hello" } });

    expect(result).toEqual({ ok: true, value: 42 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockNimChat).not.toHaveBeenCalled();
  });

  it("retry-then-succeed attaches _healAttempts trail", async () => {
    const handler = vi
      .fn()
      .mockRejectedValueOnce(new Error("Model returned non-JSON"))
      .mockResolvedValueOnce({ ok: true, value: "healed" });

    mockNimChat.mockResolvedValueOnce(
      JSON.stringify({
        diagnosis: "Input was too broad",
        modified_input: { q: "specific question" },
      }),
    );

    const wrapped = withSelfHeal(handler, { label: "retry" });
    const result = await wrapped({ input: { q: "broad" } });

    expect(result.ok).toBe(true);
    expect(result.value).toBe("healed");
    expect(result._healAttempts).toHaveLength(1);
    expect(result._healAttempts?.[0].diagnosis).toBe("Input was too broad");
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("terminal error (unauthorized) short-circuits without diagnosis", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("Unauthorized"));
    const wrapped = withSelfHeal(handler, { label: "terminal" });

    await expect(wrapped({ input: {} })).rejects.toThrow("Unauthorized");
    expect(handler).toHaveBeenCalledTimes(1);
    expect(mockNimChat).not.toHaveBeenCalled();
  });

  it("rate-limit errors are treated as terminal", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("rate limit exceeded"));
    const wrapped = withSelfHeal(handler, { label: "ratelimit" });

    await expect(wrapped({ input: {} })).rejects.toThrow("rate limit");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("exhausted retries throws original error with trail", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("Transient failure"));
    mockNimChat.mockResolvedValue(
      JSON.stringify({
        diagnosis: "Trying again",
        modified_input: { q: "attempt" },
      }),
    );

    const wrapped = withSelfHeal(handler, { label: "exhaust", maxRetries: 2 });

    await expect(wrapped({ input: { q: "initial" } })).rejects.toThrow(
      "Transient failure",
    );
    expect(handler).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("schema validation rejects bad diagnoser proposals", async () => {
    const schema = z.object({ q: z.string().min(5) }).passthrough();
    const handler = vi.fn().mockRejectedValue(new Error("Bad output"));

    mockNimChat.mockResolvedValueOnce(
      JSON.stringify({
        diagnosis: "Shorter is better",
        modified_input: { q: "hi" }, // fails min(5)
      }),
    );

    const wrapped = withSelfHeal(handler, {
      label: "schema-check",
      inputSchema: schema,
    });

    await expect(wrapped({ input: { q: "initial-long" } })).rejects.toThrow("Bad output");
    // Should bail out immediately after schema rejection → only 1 call
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("unparseable diagnoser response stops retries", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("Something failed"));
    mockNimChat.mockResolvedValueOnce("not valid json at all");

    const wrapped = withSelfHeal(handler, { label: "unparseable" });

    await expect(wrapped({ input: {} })).rejects.toThrow("Something failed");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("strips code-fence wrapping from diagnoser output", async () => {
    const handler = vi
      .fn()
      .mockRejectedValueOnce(new Error("First attempt failed"))
      .mockResolvedValueOnce({ ok: true });

    mockNimChat.mockResolvedValueOnce(
      '```json\n{"diagnosis":"fence-stripped","modified_input":{"q":"fixed"}}\n```',
    );

    const wrapped = withSelfHeal(handler, { label: "fence" });
    const result = await wrapped({ input: { q: "orig" } });

    expect(result.ok).toBe(true);
    expect(result._healAttempts?.[0].diagnosis).toBe("fence-stripped");
  });
});
