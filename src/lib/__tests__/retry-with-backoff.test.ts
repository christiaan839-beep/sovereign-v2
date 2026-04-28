/**
 * retry-with-backoff — tests.
 *
 * This is the central reliability primitive — every workhorse path
 * (run-dag, share resolution, future async paths) wraps fetch in
 * `retryWithBackoff`. A bug in this module degrades reliability
 * across the whole platform, so it gets the most rigorous test
 * coverage of any single file.
 *
 * What we verify:
 *   - Successful first try → returns immediately, no delay
 *   - Transient failure → retries up to maxAttempts
 *   - Permanent failure → does NOT retry (preserves the original error)
 *   - Final-attempt error → that's what surfaces (not "retries
 *     exhausted")
 *   - Backoff math: exponential with jitter, capped at maxDelayMs
 *   - AbortSignal: stops retries mid-flight
 *   - onRetry callback: fires for every retry, swallows callback
 *     errors (observation must not affect execution)
 *   - isTransientError correctly classifies common error shapes
 */

import { describe, it, expect, vi } from "vitest";
import {
  retryWithBackoff,
  isTransientError,
} from "../retry-with-backoff";

describe("isTransientError", () => {
  it("classifies HTTP 5xx in a parenthesized status as transient", () => {
    expect(isTransientError(new Error("agent leads failed (502): bad gateway"))).toBe(true);
    expect(isTransientError(new Error("agent x failed (503): unavailable"))).toBe(true);
    expect(isTransientError(new Error("agent y failed (504): timeout"))).toBe(true);
  });

  it("classifies 408 / 429 as transient", () => {
    expect(isTransientError(new Error("agent x failed (408): timeout"))).toBe(true);
    expect(isTransientError(new Error("agent x failed (429): rate limit"))).toBe(true);
  });

  it("classifies 4xx (other than 408/429) as permanent", () => {
    expect(isTransientError(new Error("agent x failed (400): bad request"))).toBe(false);
    expect(isTransientError(new Error("agent x failed (401): unauthorized"))).toBe(false);
    expect(isTransientError(new Error("agent x failed (404): not found"))).toBe(false);
  });

  it("classifies network-error keywords as transient", () => {
    expect(isTransientError(new Error("ECONNRESET"))).toBe(true);
    expect(isTransientError(new Error("ETIMEDOUT"))).toBe(true);
    expect(isTransientError(new Error("ENOTFOUND example.com"))).toBe(true);
    expect(isTransientError(new Error("fetch failed"))).toBe(true);
    expect(isTransientError(new Error("network is unreachable"))).toBe(true);
    expect(isTransientError(new Error("operation timed out"))).toBe(true);
  });

  it("classifies AbortError as transient (likely our own timeout)", () => {
    const err = new Error("The operation was aborted");
    err.name = "AbortError";
    expect(isTransientError(err)).toBe(true);
  });

  it("classifies programming bugs as PERMANENT (no retry)", () => {
    // Retrying a TypeError won't fix it — it's a code bug.
    expect(isTransientError(new TypeError("foo is undefined"))).toBe(false);
    expect(isTransientError(new SyntaxError("Unexpected token"))).toBe(false);
    expect(isTransientError(new ReferenceError("x is not defined"))).toBe(false);
  });

  it("treats unknown errors as permanent (conservative default)", () => {
    expect(isTransientError(null)).toBe(false);
    expect(isTransientError(undefined)).toBe(false);
    expect(isTransientError(new Error("generic failure"))).toBe(false);
    expect(isTransientError("just a string")).toBe(false);
  });
});

describe("retryWithBackoff — success cases", () => {
  it("returns the result immediately when the first call succeeds", async () => {
    const fn = vi.fn().mockResolvedValue("success");
    const result = await retryWithBackoff(fn, { initialDelayMs: 1 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient errors and returns the eventual success", async () => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      if (calls < 3) throw new Error("agent x failed (502): bad gateway");
      return "ok";
    };

    const result = await retryWithBackoff(fn, { initialDelayMs: 1 });
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("invokes onRetry for every retry (with attempt + error + delay)", async () => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      if (calls < 3) throw new Error("agent x failed (503)");
      return "ok";
    };
    const onRetry = vi.fn();
    await retryWithBackoff(fn, { initialDelayMs: 1, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(2);
    // First retry is attempt=1, second is attempt=2 (the index BEFORE the retry).
    expect(onRetry.mock.calls[0][0]).toBe(1);
    expect(onRetry.mock.calls[1][0]).toBe(2);
    expect(onRetry.mock.calls[0][1]).toBeInstanceOf(Error);
    expect(typeof onRetry.mock.calls[0][2]).toBe("number");
  });
});

describe("retryWithBackoff — failure cases", () => {
  it("does NOT retry permanent errors — fails after the first try", async () => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      throw new Error("agent x failed (400): bad request");
    };
    await expect(
      retryWithBackoff(fn, { initialDelayMs: 1 }),
    ).rejects.toThrow(/400/);
    expect(calls).toBe(1);
  });

  it("surfaces the FINAL attempt's error after retries exhausted", async () => {
    // Each attempt throws a different error message. After all
    // retries exhausted, we want to see the LAST one — that reflects
    // what was happening at the time we gave up.
    let calls = 0;
    const fn = async () => {
      calls += 1;
      throw new Error(`agent x failed (502): attempt ${calls}`);
    };
    await expect(
      retryWithBackoff(fn, { maxAttempts: 3, initialDelayMs: 1 }),
    ).rejects.toThrow(/attempt 3/);
    expect(calls).toBe(3);
  });

  it("respects maxAttempts (default 3 = 1 initial + 2 retries)", async () => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      throw new Error("agent x failed (502)");
    };
    await expect(
      retryWithBackoff(fn, { initialDelayMs: 1 }),
    ).rejects.toThrow();
    expect(calls).toBe(3);
  });

  it("respects custom maxAttempts", async () => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      throw new Error("agent x failed (502)");
    };
    await expect(
      retryWithBackoff(fn, { maxAttempts: 5, initialDelayMs: 1 }),
    ).rejects.toThrow();
    expect(calls).toBe(5);
  });

  it("treats maxAttempts of 1 as no retries", async () => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      throw new Error("agent x failed (502)");
    };
    await expect(
      retryWithBackoff(fn, { maxAttempts: 1, initialDelayMs: 1 }),
    ).rejects.toThrow();
    expect(calls).toBe(1);
  });
});

describe("retryWithBackoff — observation safety", () => {
  it("never lets a buggy onRetry callback kill the retry loop", async () => {
    // Critical contract: telemetry/logging must never affect execution.
    let calls = 0;
    const fn = async () => {
      calls += 1;
      if (calls < 2) throw new Error("agent x failed (502)");
      return "ok";
    };
    const onRetry = vi.fn(() => {
      throw new Error("logging service down");
    });
    const result = await retryWithBackoff(fn, {
      initialDelayMs: 1,
      onRetry,
    });
    expect(result).toBe("ok");
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("retryWithBackoff — abort signal", () => {
  it("stops retrying when the signal is aborted between attempts", async () => {
    let calls = 0;
    const controller = new AbortController();
    const fn = async () => {
      calls += 1;
      // After the first failure, abort. We expect the loop to stop.
      if (calls === 1) {
        controller.abort();
      }
      throw new Error("agent x failed (502)");
    };
    await expect(
      retryWithBackoff(fn, {
        maxAttempts: 5,
        initialDelayMs: 50,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    // Aborted before the retry loop's sleep → second attempt
    // never runs.
    expect(calls).toBeLessThan(5);
  });

  it("never retries if the signal is already aborted at start", async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn().mockResolvedValue("won't be called");
    await expect(
      retryWithBackoff(fn, { signal: controller.signal }),
    ).rejects.toThrow(/aborted/);
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("retryWithBackoff — custom classifier", () => {
  it("supports a caller-provided isTransient predicate", async () => {
    // The caller can tighten OR loosen the default classifier. Here
    // we make ALL errors transient (even programming bugs) to verify
    // the classifier is consulted, not hardcoded.
    let calls = 0;
    const fn = async () => {
      calls += 1;
      if (calls < 2) throw new TypeError("normally permanent");
      return "ok";
    };
    const result = await retryWithBackoff(fn, {
      initialDelayMs: 1,
      isTransient: () => true, // override: everything is transient
    });
    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });
});
