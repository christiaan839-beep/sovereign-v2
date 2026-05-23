/**
 * Tests for src/lib/agent-activity-bus.ts — Wave 152.
 *
 * Pure-state tests over the in-process ring buffer + subscriber
 * iterators. No HTTP, no DB. _resetActivityBus is called in
 * beforeEach so each test starts clean.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  publishTick,
  subscribeTicks,
  getRecentTicks,
  getActivityStats,
  _resetActivityBus,
  type ActivityTick,
} from "@/lib/agent-activity-bus";

function mkTick(over: Partial<ActivityTick> = {}): ActivityTick {
  return {
    id: over.id ?? `t-${Math.random().toString(36).slice(2, 10)}`,
    agentName: over.agentName ?? "audit",
    modelUsed: over.modelUsed ?? "nim",
    userId: over.userId ?? "u_1",
    status: over.status ?? "auto-approved",
    durationMs: over.durationMs ?? 800,
    at: over.at ?? new Date().toISOString(),
    banditPick: over.banditPick,
  };
}

beforeEach(() => {
  _resetActivityBus();
});

describe("publishTick + getRecentTicks", () => {
  it("starts empty", () => {
    expect(getRecentTicks()).toEqual([]);
    expect(getActivityStats().total).toBe(0);
  });

  it("buffers ticks in publish order", () => {
    publishTick(mkTick({ id: "1" }));
    publishTick(mkTick({ id: "2" }));
    publishTick(mkTick({ id: "3" }));
    const ticks = getRecentTicks();
    expect(ticks.map((t) => t.id)).toEqual(["1", "2", "3"]);
  });

  it("caps ring buffer at 200 (drops oldest)", () => {
    for (let i = 0; i < 250; i++) {
      publishTick(mkTick({ id: `i-${i}` }));
    }
    const ticks = getRecentTicks(200);
    expect(ticks.length).toBe(200);
    expect(ticks[0].id).toBe("i-50");
    expect(ticks[199].id).toBe("i-249");
  });

  it("respects limit param", () => {
    for (let i = 0; i < 10; i++) publishTick(mkTick({ id: `i-${i}` }));
    expect(getRecentTicks(3).length).toBe(3);
    expect(getRecentTicks(3)[2].id).toBe("i-9");
  });

  it("counts per status in stats", () => {
    publishTick(mkTick({ status: "auto-approved" }));
    publishTick(mkTick({ status: "auto-approved" }));
    publishTick(mkTick({ status: "blocked" }));
    publishTick(mkTick({ status: "needs-approval" }));
    const s = getActivityStats();
    expect(s.total).toBe(4);
    expect(s.approved).toBe(2);
    expect(s.blocked).toBe(1);
    expect(s.needsApproval).toBe(1);
  });
});

describe("subscribeTicks — replay + live", () => {
  it("replays the last N matching ticks on subscription", async () => {
    for (let i = 0; i < 10; i++) publishTick(mkTick({ id: `i-${i}` }));
    const stream = subscribeTicks({ replay: 4 });
    const received: ActivityTick[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await (stream as AsyncIterable<ActivityTick>)
        [Symbol.asyncIterator]()
        .next();
      if (r.done) break;
      received.push(r.value);
    }
    expect(received.map((t) => t.id)).toEqual(["i-6", "i-7", "i-8", "i-9"]);
    stream.close();
  });

  it("replay=0 yields no historical ticks", async () => {
    publishTick(mkTick({ id: "old" }));
    const stream = subscribeTicks({ replay: 0 });
    const it = (stream as AsyncIterable<ActivityTick>)[Symbol.asyncIterator]();
    // Schedule a publish then a close so the iterator resolves
    setTimeout(() => publishTick(mkTick({ id: "live" })), 5);
    const r = await it.next();
    expect(r.done).toBe(false);
    expect(r.value.id).toBe("live");
    stream.close();
  });

  it("delivers live ticks after the replay drains", async () => {
    publishTick(mkTick({ id: "h-1" }));
    const stream = subscribeTicks({ replay: 32 });
    const it = (stream as AsyncIterable<ActivityTick>)[Symbol.asyncIterator]();
    const first = await it.next();
    expect(first.value.id).toBe("h-1");

    setTimeout(() => publishTick(mkTick({ id: "live-1" })), 5);
    const second = await it.next();
    expect(second.value.id).toBe("live-1");
    stream.close();
  });

  it("agentFilter excludes non-matching ticks (replay + live)", async () => {
    publishTick(mkTick({ id: "ocr-1", agentName: "ocr" }));
    publishTick(mkTick({ id: "audit-1", agentName: "audit" }));
    const stream = subscribeTicks({ agentFilter: "audit", replay: 32 });
    const it = (stream as AsyncIterable<ActivityTick>)[Symbol.asyncIterator]();
    const replayed = await it.next();
    expect(replayed.value.agentName).toBe("audit");
    setTimeout(() => {
      publishTick(mkTick({ id: "noise", agentName: "ocr" }));
      publishTick(mkTick({ id: "audit-2", agentName: "audit" }));
    }, 5);
    const live = await it.next();
    expect(live.value.id).toBe("audit-2");
    stream.close();
  });

  it("close() ends the iterator with done=true", async () => {
    const stream = subscribeTicks({ replay: 0 });
    const it = (stream as AsyncIterable<ActivityTick>)[Symbol.asyncIterator]();
    stream.close();
    const r = await it.next();
    expect(r.done).toBe(true);
  });

  it("AbortSignal closes the iterator without leaks", async () => {
    const ctrl = new AbortController();
    const stream = subscribeTicks({ signal: ctrl.signal, replay: 0 });
    expect(getActivityStats().subscriberCount).toBe(1);
    ctrl.abort();
    // Give the abort handler a tick to run
    await new Promise((r) => setTimeout(r, 5));
    expect(getActivityStats().subscriberCount).toBe(0);
    const r = await (stream as AsyncIterable<ActivityTick>)
      [Symbol.asyncIterator]()
      .next();
    expect(r.done).toBe(true);
  });

  it("caps subscriber queue at 64 (drops oldest unread)", async () => {
    const stream = subscribeTicks({ replay: 0 });
    for (let i = 0; i < 100; i++) {
      publishTick(mkTick({ id: `q-${i}` }));
    }
    const it = (stream as AsyncIterable<ActivityTick>)[Symbol.asyncIterator]();
    const collected: string[] = [];
    for (let i = 0; i < 64; i++) {
      const r = await it.next();
      if (r.done) break;
      collected.push(r.value.id);
    }
    expect(collected.length).toBe(64);
    // Oldest dropped — should start at q-36 (100-64)
    expect(collected[0]).toBe("q-36");
    expect(collected[63]).toBe("q-99");
    stream.close();
  });

  it("supports multiple concurrent subscribers", async () => {
    const a = subscribeTicks({ replay: 0 });
    const b = subscribeTicks({ replay: 0 });
    expect(getActivityStats().subscriberCount).toBe(2);
    publishTick(mkTick({ id: "shared" }));
    const aIt = (a as AsyncIterable<ActivityTick>)[Symbol.asyncIterator]();
    const bIt = (b as AsyncIterable<ActivityTick>)[Symbol.asyncIterator]();
    const aR = await aIt.next();
    const bR = await bIt.next();
    expect(aR.value.id).toBe("shared");
    expect(bR.value.id).toBe("shared");
    a.close();
    b.close();
  });

  it("publishTick never throws even if a subscriber notify is missing", () => {
    const stream = subscribeTicks({ replay: 0 });
    expect(() => publishTick(mkTick())).not.toThrow();
    stream.close();
  });
});
