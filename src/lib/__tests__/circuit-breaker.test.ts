/**
 * Tests for src/lib/circuit-breaker.ts — Circuit Breaker Pattern
 *
 * Verifies state transitions: closed → open → half-open → closed/open
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock Dependencies ──

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ── Import after mocks ──

import {
  nimBreaker,
  geminiBreaker,
  claudeBreaker,
  groqBreaker as _groqBreaker,
  getCircuitStatus,
} from "@/lib/circuit-breaker";

// ── Helpers ──

/** Force the breaker into a known clean state by succeeding once */
async function resetBreaker(
  breaker: typeof nimBreaker,
  forceClosed = true,
) {
  if (forceClosed) {
    try {
      await breaker.execute(() => Promise.resolve("ok"));
    } catch {
      // ignore — just need to reset internal counters via success path
    }
  }
}

// ── Tests ──

describe("CircuitBreaker", () => {
  // Use nimBreaker for unit tests — all breakers share the same class.
  // We need a fresh breaker per test; since the module exports singletons,
  // we reset state with a successful call before each test.
  beforeEach(async () => {
    // Reset nimBreaker by calling it enough times to clear failures
    // The simplest way is to succeed — that resets failures to 0 and state to "closed"
    await resetBreaker(nimBreaker);
  });

  // ─── Closed State ───

  it("closed state allows requests through and returns the result", async () => {
    const result = await nimBreaker.execute(() => Promise.resolve("hello"));
    expect(result).toBe("hello");
  });

  it("closed state allows async functions", async () => {
    const result = await nimBreaker.execute(async () => {
      return 42;
    });
    expect(result).toBe(42);
  });

  it("closed state propagates errors but stays closed under threshold", async () => {
    // 1 failure is under the threshold of 3
    await expect(
      nimBreaker.execute(() => Promise.reject(new Error("fail-1")))
    ).rejects.toThrow("fail-1");

    const state = nimBreaker.getState();
    expect(state.state).toBe("closed");
    expect(state.failures).toBe(1);
  });

  // ─── Opens After 3 Consecutive Failures ───

  it("opens after 3 consecutive failures (failureThreshold = 3)", async () => {
    for (let i = 0; i < 3; i++) {
      await expect(
        nimBreaker.execute(() => Promise.reject(new Error(`fail-${i}`)))
      ).rejects.toThrow();
    }

    const state = nimBreaker.getState();
    expect(state.state).toBe("open");
    expect(state.failures).toBe(3);
  });

  // ─── Open State Rejects Immediately ───

  it("open state rejects immediately without calling the function", async () => {
    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      await nimBreaker.execute(() => Promise.reject(new Error("trip"))).catch(() => {});
    }
    expect(nimBreaker.getState().state).toBe("open");

    const fn = vi.fn().mockResolvedValue("should not be called");

    await expect(nimBreaker.execute(fn)).rejects.toThrow(/OPEN/);
    expect(fn).not.toHaveBeenCalled();
  });

  it("open state error message includes breaker name", async () => {
    for (let i = 0; i < 3; i++) {
      await nimBreaker.execute(() => Promise.reject(new Error("trip"))).catch(() => {});
    }

    await expect(nimBreaker.execute(() => Promise.resolve("x"))).rejects.toThrow(
      /nvidia-nim/
    );
  });

  // ─── Half-Open After Timeout ───

  it("transitions to half-open after resetTimeout elapses, closes on success", async () => {
    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      await nimBreaker.execute(() => Promise.reject(new Error("trip"))).catch(() => {});
    }
    expect(nimBreaker.getState().state).toBe("open");

    // Advance time past the 30s resetTimeout
    vi.useFakeTimers();
    vi.advanceTimersByTime(31_000);

    // Next call should go through (half-open probe)
    const result = await nimBreaker.execute(() => Promise.resolve("recovered"));
    expect(result).toBe("recovered");

    // Should be closed again after success
    expect(nimBreaker.getState().state).toBe("closed");
    expect(nimBreaker.getState().failures).toBe(0);

    vi.useRealTimers();
  });

  // ─── Half-Open Reopens on Failure ───

  it("half-open reopens on failure", async () => {
    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      await nimBreaker.execute(() => Promise.reject(new Error("trip"))).catch(() => {});
    }

    // Advance past reset timeout
    vi.useFakeTimers();
    vi.advanceTimersByTime(31_000);

    // Fail in half-open state
    await expect(
      nimBreaker.execute(() => Promise.reject(new Error("still-broken")))
    ).rejects.toThrow("still-broken");

    // Should be back to open
    expect(nimBreaker.getState().state).toBe("open");

    vi.useRealTimers();
  });

  // ─── getState() ───

  it("getState() returns correct state, failures, and name", async () => {
    const state = nimBreaker.getState();
    expect(state).toHaveProperty("state");
    expect(state).toHaveProperty("failures");
    expect(state).toHaveProperty("name");
    expect(state.name).toBe("nvidia-nim");
    expect(typeof state.failures).toBe("number");
    expect(["closed", "open", "half-open"]).toContain(state.state);
  });

  // ─── getCircuitStatus() ───

  it("getCircuitStatus() returns status for all four providers", () => {
    const status = getCircuitStatus();
    expect(status).toHaveProperty("nim");
    expect(status).toHaveProperty("gemini");
    expect(status).toHaveProperty("claude");
    expect(status).toHaveProperty("groq");
    expect(status.nim.name).toBe("nvidia-nim");
    expect(status.gemini.name).toBe("google-gemini");
    expect(status.claude.name).toBe("anthropic-claude");
    expect(status.groq.name).toBe("groq");
  });

  // ─── Provider-Specific Breakers ───

  it("each provider breaker is independent", async () => {
    // Trip gemini breaker
    for (let i = 0; i < 3; i++) {
      await geminiBreaker.execute(() => Promise.reject(new Error("g"))).catch(() => {});
    }
    expect(geminiBreaker.getState().state).toBe("open");

    // Claude breaker should still be closed (nimBreaker may have state from earlier tests)
    const claudeResult = await claudeBreaker.execute(() => Promise.resolve("ok"));
    expect(claudeResult).toBe("ok");
    expect(claudeBreaker.getState().state).toBe("closed");

    // Reset gemini for other tests
    vi.useFakeTimers();
    vi.advanceTimersByTime(31_000);
    await geminiBreaker.execute(() => Promise.resolve("reset")).catch(() => {});
    vi.useRealTimers();
  });
});
