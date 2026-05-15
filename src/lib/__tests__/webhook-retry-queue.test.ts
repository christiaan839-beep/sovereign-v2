/**
 * Tests for src/lib/webhook-retry-queue.ts — Cook 121.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  _resetForTests,
  enqueue,
  listDead,
  listPending,
  nextBackoff,
  tick,
  type Deliverer,
} from "../webhook-retry-queue";

beforeEach(() => {
  _resetForTests();
});

const URL = "https://example.com/hook";
const BODY = '{"k":1}';

describe("enqueue", () => {
  it("creates a delivery scheduled for immediate attempt", () => {
    const d = enqueue({ url: URL, body: BODY, now: 1000 });
    expect(d.attempts).toBe(0);
    expect(d.nextAttemptMs).toBe(1000);
    expect(d.dead).toBe(false);
    expect(d.id.startsWith("whk_")).toBe(true);
  });

  it("listPending returns deliveries whose nextAttemptMs ≤ now", () => {
    enqueue({ url: URL, body: BODY, now: 0 });
    expect(listPending(0).length).toBe(1);
    expect(listPending(-1).length).toBe(0);
  });
});

describe("nextBackoff", () => {
  it("grows exponentially up to maxDelayMs", () => {
    const r = () => 1; // full jitter window
    const cfg = { maxAttempts: 8, baseDelayMs: 1000, maxDelayMs: 60_000 };
    const d0 = nextBackoff(0, cfg, r);
    const d1 = nextBackoff(1, cfg, r);
    const d10 = nextBackoff(10, cfg, r);
    expect(d1).toBeGreaterThanOrEqual(d0);
    expect(d10).toBeLessThanOrEqual(60_000);
  });

  it("respects the half-to-full jitter window", () => {
    const cfg = { maxAttempts: 8, baseDelayMs: 1000, maxDelayMs: 60_000 };
    const min = nextBackoff(3, cfg, () => 0); // 0.5x
    const max = nextBackoff(3, cfg, () => 1); // 1.0x
    expect(min).toBeLessThanOrEqual(max);
    expect(min).toBeGreaterThan(0);
  });
});

describe("tick — success path", () => {
  it("removes delivery on 2xx", async () => {
    enqueue({ url: URL, body: BODY, now: 0 });
    const deliverer: Deliverer = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200 });
    const report = await tick(deliverer, {}, 0);
    expect(report.delivered).toBe(1);
    expect(report.retried).toBe(0);
    expect(listPending(0).length).toBe(0);
  });
});

describe("tick — transient failure", () => {
  it("reschedules with backoff and increments attempts", async () => {
    enqueue({ url: URL, body: BODY, now: 0 });
    const deliverer: Deliverer = vi.fn().mockResolvedValue({
      ok: false,
      transient: true,
      status: 503,
      message: "503 service unavailable",
    });
    const report = await tick(deliverer, {}, 0, () => 1);
    expect(report.retried).toBe(1);
    expect(report.delivered).toBe(0);
    const after = [...listPending(Number.MAX_SAFE_INTEGER)];
    expect(after[0].attempts).toBe(1);
    expect(after[0].nextAttemptMs).toBeGreaterThan(0);
  });
});

describe("tick — permanent failure", () => {
  it("marks dead immediately on transient=false", async () => {
    enqueue({ url: URL, body: BODY, now: 0 });
    const deliverer: Deliverer = vi.fn().mockResolvedValue({
      ok: false,
      transient: false,
      status: 401,
      message: "auth failed",
    });
    const report = await tick(deliverer, {}, 0);
    expect(report.killed).toBe(1);
    expect(listDead().length).toBe(1);
  });
});

describe("tick — max attempts exhausted", () => {
  it("kills the delivery after maxAttempts transient failures", async () => {
    enqueue({ url: URL, body: BODY, now: 0 });
    const deliverer: Deliverer = vi.fn().mockResolvedValue({
      ok: false,
      transient: true,
      message: "still failing",
    });
    const cfg = { maxAttempts: 3 };
    let now = 0;
    for (let i = 0; i < 3; i++) {
      await tick(deliverer, cfg, now, () => 0);
      now += 1_000_000; // jump past backoff
    }
    expect(listDead().length).toBe(1);
  });
});

describe("tick — thrown deliverer", () => {
  it("treats throw as transient + reschedules", async () => {
    enqueue({ url: URL, body: BODY, now: 0 });
    const deliverer: Deliverer = vi
      .fn()
      .mockRejectedValue(new Error("network down"));
    const report = await tick(deliverer, {}, 0, () => 1);
    expect(report.retried).toBe(1);
    expect(listDead().length).toBe(0);
  });

  it("kills after maxAttempts throws", async () => {
    enqueue({ url: URL, body: BODY, now: 0 });
    const deliverer: Deliverer = vi
      .fn()
      .mockRejectedValue(new Error("permanent block"));
    let now = 0;
    for (let i = 0; i < 8; i++) {
      await tick(deliverer, {}, now, () => 0);
      now += 1_000_000_000;
    }
    expect(listDead().length).toBe(1);
  });
});
