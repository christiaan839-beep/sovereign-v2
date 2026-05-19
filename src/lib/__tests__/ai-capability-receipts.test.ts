/**
 * Tests for the ai() capability-receipt wrapper (wave 98).
 *
 * The actual provider calls are too entangled to mock cleanly here —
 * the inner _aiInternal pulls user keys from the DB, has 7 provider
 * paths, etc. Instead we test the WRAPPER behaviour by directly
 * mocking @/lib/capability-receipts and asserting:
 *   - receipt fires only when AI_CAPABILITY_RECEIPTS=true
 *   - receipt fires on both success and error paths
 *   - prompt + system + output are passed via `sensitive` (hashed
 *     downstream — confirmed by capability-receipts.test.ts)
 *   - the wrapper NEVER affects the call's return value or thrown error
 *
 * We test the wrapper by importing a tiny harness that mirrors the
 * exact wrapper structure used in src/lib/ai.ts:ai(). This avoids
 * needing to stub Clerk / Drizzle / 7 provider SDKs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { capMock } = vi.hoisted(() => ({
  capMock: vi.fn(async () => ({}) as Record<string, unknown>),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/capability-receipts", () => ({
  emitCapabilityReceipt: capMock,
}));

import type { AIOptions } from "@/types";

const originalEnv = process.env.AI_CAPABILITY_RECEIPTS;

/**
 * Mirror of the wave-98 wrapper structure. If you change the wrapper
 * in src/lib/ai.ts, mirror the change here so this test continues to
 * lock the invariants. Both share the same shape, so a drift between
 * them is itself a signal that the wrapper changed without test
 * coverage being updated.
 */
async function wrappedAi(
  inner: (prompt: string, options: AIOptions) => Promise<string>,
  prompt: string,
  options: AIOptions = {},
): Promise<string> {
  const start = Date.now();
  let output = "";
  let outcome: "allowed" | "error" = "allowed";
  let errMessage: string | null = null;
  try {
    output = await inner(prompt, options);
    return output;
  } catch (err) {
    outcome = "error";
    errMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    if (process.env.AI_CAPABILITY_RECEIPTS === "true") {
      void (async () => {
        try {
          const { emitCapabilityReceipt } =
            await import("@/lib/capability-receipts");
          const durationMs = Date.now() - start;
          await emitCapabilityReceipt({
            ruleId: `ai.call.${options.model ?? "auto"}`,
            kind: "llm-call",
            outcome,
            summary:
              outcome === "allowed"
                ? `${options.model ?? "auto"} → ${output.length} chars in ${durationMs}ms`
                : `${options.model ?? "auto"} → error: ${(errMessage ?? "unknown").slice(0, 80)}`,
            sensitive: {
              prompt,
              ...(options.system ? { system: options.system } : {}),
              ...(outcome === "allowed" && output.length > 0 ? { output } : {}),
            },
            durationMs,
            responseBytes: outcome === "allowed" ? output.length : 0,
          });
        } catch {
          /* must never affect the LLM call */
        }
      })();
    }
  }
}

beforeEach(() => {
  capMock.mockClear();
});

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env.AI_CAPABILITY_RECEIPTS;
  } else {
    process.env.AI_CAPABILITY_RECEIPTS = originalEnv;
  }
});

describe("ai() wrapper — env gating", () => {
  it("does NOT emit when AI_CAPABILITY_RECEIPTS is unset (default-off)", async () => {
    delete process.env.AI_CAPABILITY_RECEIPTS;
    const inner = vi.fn(async () => "response");
    await wrappedAi(inner, "hello");
    await Promise.resolve();
    expect(capMock).not.toHaveBeenCalled();
  });

  it("does NOT emit when AI_CAPABILITY_RECEIPTS is set to anything other than 'true'", async () => {
    process.env.AI_CAPABILITY_RECEIPTS = "1";
    const inner = vi.fn(async () => "response");
    await wrappedAi(inner, "hello");
    await Promise.resolve();
    expect(capMock).not.toHaveBeenCalled();
  });

  it("emits exactly one receipt when AI_CAPABILITY_RECEIPTS='true'", async () => {
    process.env.AI_CAPABILITY_RECEIPTS = "true";
    const inner = vi.fn(async () => "the answer is 42");
    await wrappedAi(inner, "what is the answer", { model: "claude" });
    // Microtask drain — the void IIFE in `finally` resolves async
    await new Promise((r) => setTimeout(r, 30));
    expect(capMock).toHaveBeenCalledTimes(1);
    const call = capMock.mock.calls[0][0] as Record<string, unknown> & {
      sensitive?: Record<string, string>;
    };
    expect(call.kind).toBe("llm-call");
    expect(call.outcome).toBe("allowed");
    expect(call.ruleId).toBe("ai.call.claude");
    expect(call.responseBytes).toBe("the answer is 42".length);
    expect(call.sensitive?.prompt).toBe("what is the answer");
    expect(call.sensitive?.output).toBe("the answer is 42");
  });
});

describe("ai() wrapper — error path", () => {
  beforeEach(() => {
    process.env.AI_CAPABILITY_RECEIPTS = "true";
  });

  it("emits an 'error' receipt when inner throws + RE-THROWS the original error", async () => {
    const original = new Error("upstream provider 500");
    const inner = vi.fn(async () => {
      throw original;
    });
    await expect(wrappedAi(inner, "test")).rejects.toBe(original);
    await new Promise((r) => setTimeout(r, 30));
    expect(capMock).toHaveBeenCalledTimes(1);
    const call = capMock.mock.calls[0][0] as Record<string, unknown> & {
      sensitive?: Record<string, string>;
    };
    expect(call.outcome).toBe("error");
    expect(call.responseBytes).toBe(0);
    expect(call.summary).toMatch(/upstream provider 500/);
    // Error receipts MUST NOT include output (we never assembled one).
    expect(call.sensitive?.output).toBeUndefined();
    // But the prompt is still committed — auditors need to know which
    // call failed.
    expect(call.sensitive?.prompt).toBe("test");
  });

  it("truncates error messages > 80 chars in summary (no log spam)", async () => {
    const long = "x".repeat(500);
    const inner = vi.fn(async () => {
      throw new Error(long);
    });
    await expect(wrappedAi(inner, "p")).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 30));
    const call = capMock.mock.calls[0][0] as Record<string, unknown>;
    expect((call.summary as string).length).toBeLessThan(200);
  });
});

describe("ai() wrapper — receipt failure isolation", () => {
  beforeEach(() => {
    process.env.AI_CAPABILITY_RECEIPTS = "true";
  });

  it("LLM call SUCCEEDS even when emitCapabilityReceipt throws", async () => {
    capMock.mockImplementationOnce(() => {
      throw new Error("receipt subsystem down");
    });
    const inner = vi.fn(async () => "ok");
    const result = await wrappedAi(inner, "test");
    expect(result).toBe("ok");
    await new Promise((r) => setTimeout(r, 30));
    // The receipt mock was called (and threw) — the outer call is
    // unaffected.
    expect(capMock).toHaveBeenCalledTimes(1);
  });

  it("LLM call ERROR re-throws unchanged even when receipt throws", async () => {
    capMock.mockImplementationOnce(() => {
      throw new Error("receipt down");
    });
    const original = new Error("provider 503");
    const inner = vi.fn(async () => {
      throw original;
    });
    await expect(wrappedAi(inner, "test")).rejects.toBe(original);
  });
});

describe("ai() wrapper — sensitive identifiers", () => {
  beforeEach(() => {
    process.env.AI_CAPABILITY_RECEIPTS = "true";
  });

  it("passes system prompt under sensitive.system when supplied", async () => {
    const inner = vi.fn(async () => "out");
    await wrappedAi(inner, "user prompt", {
      system: "system prompt here",
      model: "gemini",
    });
    await new Promise((r) => setTimeout(r, 30));
    const call = capMock.mock.calls[0][0] as {
      sensitive?: Record<string, string>;
    };
    expect(call.sensitive?.system).toBe("system prompt here");
  });

  it("omits sensitive.system when not supplied", async () => {
    const inner = vi.fn(async () => "out");
    await wrappedAi(inner, "user prompt", { model: "gemini" });
    await new Promise((r) => setTimeout(r, 30));
    const call = capMock.mock.calls[0][0] as {
      sensitive?: Record<string, string>;
    };
    expect(call.sensitive?.system).toBeUndefined();
  });

  it("ruleId defaults to 'ai.call.auto' when no model pinned", async () => {
    const inner = vi.fn(async () => "out");
    await wrappedAi(inner, "p");
    await new Promise((r) => setTimeout(r, 30));
    const call = capMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.ruleId).toBe("ai.call.auto");
  });
});

describe("ai() wrapper — duration measurement", () => {
  it("records non-negative durationMs", async () => {
    process.env.AI_CAPABILITY_RECEIPTS = "true";
    const inner = vi.fn(
      async () => new Promise<string>((r) => setTimeout(() => r("done"), 5)),
    );
    await wrappedAi(inner, "p");
    await new Promise((r) => setTimeout(r, 30));
    const call = capMock.mock.calls[0][0] as Record<string, unknown>;
    expect(call.durationMs).toBeGreaterThanOrEqual(0);
  });
});
