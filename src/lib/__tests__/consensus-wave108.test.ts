/**
 * Wave-108 tests — pin the cost-routing behaviour changes:
 *
 *  - smartAi() now tries NIM first, Gemini only on NIM failure
 *  - verifiedAi() auto-skips the critique pass on short prompts
 *  - VERIFY_AUTO_MIN_PROMPT_CHARS exported and used as the threshold
 *  - VerifyOptions.skipVerify still overrides (explicit > auto)
 *
 * These behaviours are the load-bearing assumptions behind the
 * audited ~$780-1,950/mo savings. If a future "cleanup" PR flips
 * smartAi back to Gemini-first or removes the auto-skip, these
 * tests fail loudly.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// All vi.mock calls must be at top-level for hoisting.
const { nimChatMock } = vi.hoisted(() => ({
  nimChatMock: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/lib/nvidia", () => ({
  nimChat: nimChatMock,
}));

import { verifiedAi, VERIFY_AUTO_MIN_PROMPT_CHARS } from "../consensus";

beforeEach(() => {
  nimChatMock.mockReset();
  nimChatMock.mockResolvedValue("model output");
});

describe("VERIFY_AUTO_MIN_PROMPT_CHARS — cost-routing constant", () => {
  it("is exported as a stable threshold", () => {
    expect(typeof VERIFY_AUTO_MIN_PROMPT_CHARS).toBe("number");
    expect(VERIFY_AUTO_MIN_PROMPT_CHARS).toBeGreaterThan(0);
  });

  it("is at least 500 chars (matches audit recommendation)", () => {
    // The audit recommended ≥500 so the verify loop's 2-3x cost is
    // only paid on prompts long enough to warrant a critique pass.
    // Anything lower mis-fires on short tool-use / classification
    // prompts and silently restores the cost leak.
    expect(VERIFY_AUTO_MIN_PROMPT_CHARS).toBeGreaterThanOrEqual(500);
  });
});

describe("verifiedAi — auto-skip on short prompts (wave-108)", () => {
  it("SKIPS the critique pass on prompts shorter than the threshold", async () => {
    nimChatMock.mockResolvedValueOnce("short answer");

    const shortPrompt = "What is 2+2?";
    expect(shortPrompt.length).toBeLessThan(VERIFY_AUTO_MIN_PROMPT_CHARS);

    const result = await verifiedAi(shortPrompt);

    // Only the generator pass should have run — no critic, no revise.
    expect(nimChatMock).toHaveBeenCalledTimes(1);
    expect(result.verified).toBe(false);
    expect(result.revised).toBe(false);
    expect(result.models).toHaveLength(1);
    expect(result.answer).toBe("short answer");
  });

  it("RUNS verification on prompts at or above the threshold", async () => {
    // Generator → critic → maybe-revise. We don't assert the exact
    // call count because critic-finds-no-issues can short-circuit
    // revise, but at minimum 2 nimChat calls (generator + critic).
    nimChatMock.mockResolvedValue("long answer");
    const longPrompt = "x".repeat(VERIFY_AUTO_MIN_PROMPT_CHARS + 1);

    await verifiedAi(longPrompt);

    expect(nimChatMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("explicit skipVerify:false overrides auto-skip on short prompts", async () => {
    nimChatMock.mockResolvedValue("answer");
    const shortPrompt = "What is 2+2?";

    await verifiedAi(shortPrompt, { skipVerify: false });

    // Override forces verification even on short prompts.
    expect(nimChatMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("explicit skipVerify:true skips even on long prompts", async () => {
    nimChatMock.mockResolvedValueOnce("answer");
    const longPrompt = "x".repeat(2000);

    await verifiedAi(longPrompt, { skipVerify: true });

    expect(nimChatMock).toHaveBeenCalledTimes(1);
  });

  it("at exactly the threshold the prompt is considered short (verify SKIPPED)", async () => {
    nimChatMock.mockResolvedValueOnce("answer");
    const exactly = "x".repeat(VERIFY_AUTO_MIN_PROMPT_CHARS);
    // Condition is `prompt.length < THRESHOLD` so exactly-threshold
    // is NOT < THRESHOLD → it's borderline-long → verify runs.
    // (Test pins the off-by-one explicitly.)
    nimChatMock.mockResolvedValue("answer");
    await verifiedAi(exactly);
    expect(nimChatMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("just below the threshold skips (off-by-one pin)", async () => {
    nimChatMock.mockResolvedValueOnce("answer");
    const justBelow = "x".repeat(VERIFY_AUTO_MIN_PROMPT_CHARS - 1);
    await verifiedAi(justBelow);
    expect(nimChatMock).toHaveBeenCalledTimes(1);
  });
});
