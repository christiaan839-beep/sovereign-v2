/**
 * Tests for src/lib/event-bus-fanout.ts — Wave 33.
 *
 * Hermetic — globalThis.fetch is stubbed. Verifies:
 *   - isFanoutEnabled reflects env config
 *   - enqueueRemote no-ops when Upstash is unset
 *   - enqueueRemote POSTs to /rpush/<channel> with the right shape
 *   - drainRemote LRANGEs, parses, and re-publishes to the local bus
 *   - drainRemote SKIPS events that originated from this instance
 *   - publishWithFanout returns the local event synchronously
 *   - HTTP failure on either side is fail-soft (no throws)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  _resetBusForTests,
  subscribe as _subscribe,
  type SovereignEvent,
} from "@/lib/event-bus";

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  _resetBusForTests();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  vi.resetModules();
  globalThis.fetch = ORIGINAL_FETCH;
});

describe("isFanoutEnabled", () => {
  it("returns false when UPSTASH env is unset", async () => {
    const { isFanoutEnabled } = await import("@/lib/event-bus-fanout");
    expect(isFanoutEnabled()).toBe(false);
  });

  it("returns true when both URL and token are set", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
    const { isFanoutEnabled } = await import("@/lib/event-bus-fanout");
    expect(isFanoutEnabled()).toBe(true);
  });
});

describe("enqueueRemote", () => {
  it("no-ops when Upstash is unset (reason='not-configured')", async () => {
    const { enqueueRemote } = await import("@/lib/event-bus-fanout");
    const evt: SovereignEvent = {
      id: "evt_1",
      type: "agent.run.sealed",
      tenantId: "*",
      emittedAt: new Date().toISOString(),
      data: {},
    };
    const r = await enqueueRemote(evt);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("not-configured");
  });

  it("POSTs to /rpush/sovereign:events:v1 with a serialized event body", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    const fetchSpy = vi.fn(async (url: string) => {
      // /rpush call. The /ltrim follow-up runs fire-and-forget; we
      // accept either URL here so the test doesn't race the trim.
      void url;
      return new Response("ok", { status: 200 });
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { enqueueRemote } = await import("@/lib/event-bus-fanout");
    const evt: SovereignEvent = {
      id: "evt_42",
      type: "agent.token.issued",
      tenantId: "tenant_a",
      emittedAt: new Date().toISOString(),
      data: { tokenId: "tok_1" },
    };
    const r = await enqueueRemote(evt);
    expect(r.ok).toBe(true);
    // First call should target /rpush/<channel>.
    const firstCallUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(firstCallUrl).toContain("/rpush/sovereign:events:v1");
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)[0]).toContain("agent.token.issued");
  });

  it("returns ok=false on a non-2xx response from Upstash", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    globalThis.fetch = vi.fn(
      async () => new Response("err", { status: 500 }),
    ) as unknown as typeof fetch;
    const { enqueueRemote } = await import("@/lib/event-bus-fanout");
    const r = await enqueueRemote({
      id: "evt_1",
      type: "agent.run.sealed",
      tenantId: "*",
      emittedAt: "2026-05-16T00:00:00.000Z",
      data: {},
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("http-500");
  });

  it("returns ok=false on a network error (no throw)", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const { enqueueRemote } = await import("@/lib/event-bus-fanout");
    const r = await enqueueRemote({
      id: "evt_1",
      type: "agent.run.sealed",
      tenantId: "*",
      emittedAt: "2026-05-16T00:00:00.000Z",
      data: {},
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("network");
  });
});

describe("drainRemote", () => {
  it("returns delivered=0 when Upstash is unset", async () => {
    const { drainRemote } = await import("@/lib/event-bus-fanout");
    const r = await drainRemote();
    expect(r.delivered).toBe(0);
  });

  it("LRANGEs the channel, parses events, re-publishes to local bus", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";

    const remoteEvent: SovereignEvent = {
      id: "evt_remote_1",
      type: "agent.run.sealed",
      tenantId: "*",
      emittedAt: "2026-05-16T00:00:00.000Z",
      data: { from: "peer-instance" },
    };

    globalThis.fetch = vi.fn(async (url: string) => {
      if (typeof url === "string" && url.includes("/lrange/")) {
        return new Response(
          JSON.stringify({ result: [JSON.stringify(remoteEvent)] }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;

    // Import the fanout module FIRST so the bus instance it captures
    // is the same one we subscribe against. vi.resetModules() in
    // beforeEach gave the test its own fresh module cache; we must
    // re-import event-bus from the SAME fresh cache.
    const fanout = await import("@/lib/event-bus-fanout");
    const bus = await import("@/lib/event-bus");
    const seen: SovereignEvent[] = [];
    bus.subscribe("*", (e) => seen.push(e));

    const r = await fanout.drainRemote();
    expect(r.delivered).toBe(1);
    expect(seen).toHaveLength(1);
    expect(seen[0]!.type).toBe("agent.run.sealed");
  });

  it("SKIPS events that originated from this instance (no echo loop)", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";

    // Need the origin id from the fanout module — fresh import.
    const fanout = await import("@/lib/event-bus-fanout");
    const myOrigin = fanout._ORIGIN_ID_FOR_TESTS;

    const ownEvent = {
      id: "evt_own_1",
      type: "agent.run.sealed",
      tenantId: "*",
      emittedAt: "2026-05-16T00:00:00.000Z",
      data: { from: "self" },
      _o: myOrigin,
    };

    globalThis.fetch = vi.fn(async (url: string) => {
      if (typeof url === "string" && url.includes("/lrange/")) {
        return new Response(
          JSON.stringify({ result: [JSON.stringify(ownEvent)] }),
          { status: 200 },
        );
      }
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;

    const bus = await import("@/lib/event-bus");
    const seen: SovereignEvent[] = [];
    bus.subscribe("*", (e) => seen.push(e));

    const r = await fanout.drainRemote();
    // Event was retrieved but not re-published to local bus.
    expect(r.delivered).toBe(0);
    expect(seen).toHaveLength(0);
  });
});

describe("publishWithFanout", () => {
  it("returns the local event synchronously regardless of fanout state", async () => {
    // Subscribe to the SAME bus instance the fanout module captured.
    const fanout = await import("@/lib/event-bus-fanout");
    const bus = await import("@/lib/event-bus");
    const seen: SovereignEvent[] = [];
    bus.subscribe("*", (e) => seen.push(e));

    const evt = fanout.publishWithFanout("agent.run.sealed", "*", { x: 1 });
    expect(evt.type).toBe("agent.run.sealed");
    expect(seen).toHaveLength(1);
    expect(seen[0]!.id).toBe(evt.id);
  });

  it("also enqueues to Upstash when configured (fire-and-forget)", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    const fetchSpy = vi.fn(async () => new Response("ok", { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const { publishWithFanout } = await import("@/lib/event-bus-fanout");
    publishWithFanout("agent.run.sealed", "*", { x: 1 });

    // Allow the microtask queue to drain so the fire-and-forget RPUSH
    // has a chance to hit fetch before we assert.
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchSpy).toHaveBeenCalled();
    const firstUrl = fetchSpy.mock.calls[0]![0] as string;
    expect(firstUrl).toMatch(/\/rpush\//);
  });
});

describe("startRemotePoller", () => {
  it("returns a no-op unsubscribe when fanout is disabled", async () => {
    const { startRemotePoller } = await import("@/lib/event-bus-fanout");
    const off = startRemotePoller();
    expect(typeof off).toBe("function");
    off(); // should not throw
  });
});
