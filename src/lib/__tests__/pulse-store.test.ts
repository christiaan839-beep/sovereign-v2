/**
 * Tests for src/lib/pulse-store.ts — Wave 124 singleton.
 *
 * Pure-module tests, no React. Exercises subscribe/unsubscribe
 * refcount, snapshot updates on poll, first-load deduplication,
 * and error swallowing.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  subscribePulse,
  getPulseSnapshot,
  getServerPulseSnapshot,
  setPulseInterval,
  __test_only__,
} from "@/lib/pulse-store";

const ORIGINAL_FETCH = globalThis.fetch;

function mockReceipts(rows: Array<{ id: string; agentName?: string }>) {
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    json: async () => ({ count: rows.length, receipts: rows }),
  })) as unknown as typeof fetch;
}

function mockFetchFails() {
  globalThis.fetch = vi.fn(async () => {
    throw new Error("network");
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  __test_only__.reset();
});

afterEach(() => {
  __test_only__.reset();
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("getServerPulseSnapshot", () => {
  it("returns the EMPTY snapshot (pulseToken=0, all nulls)", () => {
    const s = getServerPulseSnapshot();
    expect(s.pulseToken).toBe(0);
    expect(s.latestId).toBeNull();
    expect(s.latestAgent).toBeNull();
    expect(s.latestAt).toBeNull();
  });
});

describe("subscribePulse — refcount-managed singleton", () => {
  it("refCount increments on subscribe and decrements on unsubscribe", () => {
    expect(__test_only__.getRefCount()).toBe(0);
    const unsub1 = subscribePulse(() => {});
    expect(__test_only__.getRefCount()).toBe(1);
    const unsub2 = subscribePulse(() => {});
    expect(__test_only__.getRefCount()).toBe(2);
    unsub1();
    expect(__test_only__.getRefCount()).toBe(1);
    unsub2();
    expect(__test_only__.getRefCount()).toBe(0);
  });

  it("a notify call reaches all subscribers", () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    subscribePulse(cb1);
    subscribePulse(cb2);
    __test_only__.setSnapshot({
      pulseToken: 1,
      latestId: "abc",
      latestAgent: "audit",
      latestAt: "2026-05-22T00:00:00Z",
    });
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("unsubscribed callbacks do NOT receive notifications", () => {
    const cb = vi.fn();
    const unsub = subscribePulse(cb);
    unsub();
    __test_only__.setSnapshot({
      pulseToken: 5,
      latestId: "x",
      latestAgent: null,
      latestAt: null,
    });
    expect(cb).not.toHaveBeenCalled();
  });
});

describe("setPulseInterval — only honored before first subscribe", () => {
  it("setting interval pre-subscribe takes effect", () => {
    setPulseInterval(5000);
    expect(__test_only__.getActiveIntervalMs()).toBe(5000);
  });

  it("setting interval AFTER a subscriber attaches is a no-op", () => {
    setPulseInterval(5000);
    subscribePulse(() => {});
    setPulseInterval(99_999);
    expect(__test_only__.getActiveIntervalMs()).toBe(5000);
  });
});

describe("pollOnce — fetches recent-public, updates snapshot on new ID", () => {
  it("first poll seeds latestId but does NOT bump pulseToken", async () => {
    mockReceipts([{ id: "first", agentName: "audit" }]);
    await __test_only__.pollOnce();
    const s = getPulseSnapshot();
    expect(s.latestId).toBe("first");
    expect(s.latestAgent).toBe("audit");
    expect(s.pulseToken).toBe(0); // first-load skip
  });

  it("second poll with same ID does not change anything", async () => {
    mockReceipts([{ id: "first", agentName: "audit" }]);
    await __test_only__.pollOnce();
    await __test_only__.pollOnce();
    const s = getPulseSnapshot();
    expect(s.pulseToken).toBe(0);
    expect(s.latestId).toBe("first");
  });

  it("a new ID at the head DOES bump pulseToken", async () => {
    mockReceipts([{ id: "first" }]);
    await __test_only__.pollOnce();
    expect(getPulseSnapshot().pulseToken).toBe(0);

    mockReceipts([{ id: "second", agentName: "leads" }]);
    await __test_only__.pollOnce();
    const s = getPulseSnapshot();
    expect(s.latestId).toBe("second");
    expect(s.latestAgent).toBe("leads");
    expect(s.pulseToken).toBe(1);
  });

  it("multiple new IDs across multiple polls keep incrementing pulseToken", async () => {
    mockReceipts([{ id: "a" }]);
    await __test_only__.pollOnce();
    mockReceipts([{ id: "b" }]);
    await __test_only__.pollOnce();
    mockReceipts([{ id: "c" }]);
    await __test_only__.pollOnce();
    expect(getPulseSnapshot().pulseToken).toBe(2); // first skipped, +1, +1
  });

  it("fetch error is swallowed — snapshot unchanged", async () => {
    mockReceipts([{ id: "alive" }]);
    await __test_only__.pollOnce();
    const before = getPulseSnapshot();

    mockFetchFails();
    await __test_only__.pollOnce();
    const after = getPulseSnapshot();
    // Same reference is allowed; same content is required.
    expect(after.pulseToken).toBe(before.pulseToken);
    expect(after.latestId).toBe(before.latestId);
  });

  it("empty receipts array does not crash and does not change snapshot", async () => {
    mockReceipts([]);
    await __test_only__.pollOnce();
    const s = getPulseSnapshot();
    expect(s.pulseToken).toBe(0);
    expect(s.latestId).toBeNull();
  });

  it("subscribers fire when poll lands a new ID", async () => {
    const cb = vi.fn();
    subscribePulse(cb);
    mockReceipts([{ id: "first" }]);
    await __test_only__.pollOnce();
    // first-load: snapshot updated → emit fires once
    expect(cb).toHaveBeenCalledTimes(1);

    mockReceipts([{ id: "second" }]);
    await __test_only__.pollOnce();
    expect(cb).toHaveBeenCalledTimes(2);
  });
});
