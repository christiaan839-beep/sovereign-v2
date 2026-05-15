/**
 * Tests for src/lib/db-pool.ts — Cook 114.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createGuard } from "../db-pool";

describe("createGuard — config", () => {
  it("rejects non-positive maxConcurrent", () => {
    expect(() =>
      createGuard({ maxConcurrent: 0, queueTimeoutMs: 1000 }),
    ).toThrow();
    expect(() =>
      createGuard({ maxConcurrent: -1, queueTimeoutMs: 1000 }),
    ).toThrow();
  });

  it("rejects non-positive queueTimeoutMs", () => {
    expect(() =>
      createGuard({ maxConcurrent: 1, queueTimeoutMs: 0 }),
    ).toThrow();
  });
});

describe("guard — concurrency limit", () => {
  it("runs up to maxConcurrent in parallel, queues excess", async () => {
    const { guard, stats } = createGuard({
      maxConcurrent: 2,
      queueTimeoutMs: 5_000,
    });
    let peakInflight = 0;
    const fn = async () => {
      const s = stats();
      peakInflight = Math.max(peakInflight, s.inflight);
      await new Promise((r) => setTimeout(r, 20));
      return "ok";
    };
    const results = await Promise.all([
      guard(fn),
      guard(fn),
      guard(fn),
      guard(fn),
    ]);
    expect(results).toEqual(["ok", "ok", "ok", "ok"]);
    expect(peakInflight).toBeLessThanOrEqual(2);
    expect(stats().totalCompleted).toBe(4);
  });

  it("propagates the fn's resolved value", async () => {
    const { guard } = createGuard({
      maxConcurrent: 1,
      queueTimeoutMs: 5_000,
    });
    expect(await guard(async () => 42)).toBe(42);
  });

  it("propagates the fn's rejection", async () => {
    const { guard } = createGuard({
      maxConcurrent: 1,
      queueTimeoutMs: 5_000,
    });
    await expect(
      guard(async () => {
        throw new Error("query failed");
      }),
    ).rejects.toThrow("query failed");
  });
});

describe("guard — queue timeout", () => {
  it("rejects a queued task after queueTimeoutMs", async () => {
    const { guard } = createGuard({
      maxConcurrent: 1,
      queueTimeoutMs: 50,
    });
    // Hold the only slot.
    const hold = guard(() => new Promise((r) => setTimeout(r, 500)));
    // Second task should time out in the queue.
    await expect(guard(async () => "x")).rejects.toThrow(/timeout/);
    await hold;
  });
});

describe("guard — drain", () => {
  it("starts next queued task as inflight completes", async () => {
    const { guard, stats } = createGuard({
      maxConcurrent: 1,
      queueTimeoutMs: 5_000,
    });
    let completed = 0;
    await Promise.all([
      guard(async () => {
        await new Promise((r) => setTimeout(r, 10));
        completed++;
        return "a";
      }),
      guard(async () => {
        completed++;
        return "b";
      }),
    ]);
    expect(completed).toBe(2);
    expect(stats().queued).toBe(0);
    expect(stats().inflight).toBe(0);
  });
});

describe("guard — stats", () => {
  it("counts totalAccepted, totalCompleted, totalTimedOut", async () => {
    const { guard, stats } = createGuard({
      maxConcurrent: 1,
      queueTimeoutMs: 30,
    });
    const hold = guard(() => new Promise((r) => setTimeout(r, 500)));
    await expect(guard(async () => "x")).rejects.toThrow(/timeout/);
    expect(stats().totalTimedOut).toBe(1);
    await hold;
    expect(stats().totalCompleted).toBeGreaterThanOrEqual(1);
  });
});
