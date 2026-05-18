/**
 * UpstashLogStore + cosignature helpers — tests with mocked fetch.
 *
 * Covers the wire-level behaviour against the Upstash REST API:
 *   - getUpstashConfig() requires both env vars
 *   - LRANGE called on warmup with the documented key
 *   - RPUSH called on appendAsync with the leaf hash
 *   - upstashRecordCosignature is idempotent on (witnessId, signature)
 *   - upstashGetCosignatures gracefully returns [] on Upstash error
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

interface MockResponseInit {
  ok?: boolean;
  status?: number;
  json?: () => Promise<unknown>;
}
function mockResponse(init: MockResponseInit): Response {
  const ok = init.ok ?? true;
  const status = init.status ?? (ok ? 200 : 500);
  return {
    ok,
    status,
    json: init.json ?? (async () => ({ result: 0 })),
    text: async () => "",
    headers: new Headers(),
  } as unknown as Response;
}

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
});

describe("getUpstashConfig / isPersistenceEnabled", () => {
  it("returns null when URL missing", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    const { getUpstashConfig, isPersistenceEnabled } =
      await import("@/lib/upstash-log-store");
    expect(getUpstashConfig()).toBeNull();
    expect(isPersistenceEnabled()).toBe(false);
  });

  it("returns null when TOKEN missing", async () => {
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { getUpstashConfig } = await import("@/lib/upstash-log-store");
    expect(getUpstashConfig()).toBeNull();
  });

  it("returns config when both env vars are set", async () => {
    const { getUpstashConfig } = await import("@/lib/upstash-log-store");
    const cfg = getUpstashConfig();
    expect(cfg).toEqual({
      url: "https://test.upstash.io",
      token: "test-token",
    });
  });
});

describe("UpstashLogStore — warmup + appendAsync", () => {
  it("warmup() calls LRANGE on the documented key", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        mockResponse({ json: async () => ({ result: [HASH_A] }) }),
      );
    const { UpstashLogStore } = await import("@/lib/upstash-log-store");
    const store = new UpstashLogStore("test", {
      url: "https://test.upstash.io",
      token: "test-token",
    });
    await store.warmup();
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://test.upstash.io/lrange/art-log:test:leaves/0/-1",
      expect.objectContaining({ method: "POST" }),
    );
    expect(store.count()).toBe(1);
    expect(store.get(0)).toBe(HASH_A);
  });

  it("appendAsync() calls RPUSH and refreshes the cache", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        mockResponse({ json: async () => ({ result: [] }) }),
      ) // warmup
      .mockResolvedValueOnce(
        mockResponse({ json: async () => ({ result: 1 }) }),
      ) // rpush
      .mockResolvedValueOnce(
        mockResponse({ json: async () => ({ result: [HASH_A] }) }),
      ); // post-append fetchAll
    const { UpstashLogStore } = await import("@/lib/upstash-log-store");
    const store = new UpstashLogStore("test", {
      url: "https://test.upstash.io",
      token: "test-token",
    });
    await store.warmup();
    const idx = await store.appendAsync(HASH_A);
    expect(idx).toBe(0);
    expect(store.count()).toBe(1);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      "https://test.upstash.io/rpush/art-log:test:leaves",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify([HASH_A]),
      }),
    );
  });

  it("warmup() throws when Upstash returns non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockResponse({ ok: false, status: 500 }),
    );
    const { UpstashLogStore } = await import("@/lib/upstash-log-store");
    const store = new UpstashLogStore("test", {
      url: "https://test.upstash.io",
      token: "test-token",
    });
    await expect(store.warmup()).rejects.toThrow(/LRANGE failed: HTTP 500/);
  });

  it("appendAsync rejects a malformed leaf hash", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockResponse({ json: async () => ({ result: [] }) }),
    );
    const { UpstashLogStore } = await import("@/lib/upstash-log-store");
    const store = new UpstashLogStore("t", {
      url: "https://test.upstash.io",
      token: "test-token",
    });
    await store.warmup();
    await expect(store.appendAsync("not-a-hash")).rejects.toThrow(
      /64 lowercase hex/,
    );
  });

  it("count() / get() throw when warmup hasn't run", async () => {
    const { UpstashLogStore } = await import("@/lib/upstash-log-store");
    const store = new UpstashLogStore("t", {
      url: "https://test.upstash.io",
      token: "test-token",
    });
    expect(() => store.count()).toThrow(/warmup/);
    expect(() => store.get(0)).toThrow(/warmup/);
  });
});

describe("buildUpstashLogStore", () => {
  it("returns null when Upstash isn't configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    const { buildUpstashLogStore } = await import("@/lib/upstash-log-store");
    expect(await buildUpstashLogStore("test")).toBeNull();
  });

  it("returns a warmed store when Upstash is configured + reachable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockResponse({ json: async () => ({ result: [HASH_A, HASH_B] }) }),
    );
    const { buildUpstashLogStore } = await import("@/lib/upstash-log-store");
    const store = await buildUpstashLogStore("test");
    expect(store).not.toBeNull();
    expect(store!.count()).toBe(2);
  });

  it("returns null when warmup fails (operator falls back to in-memory)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockResponse({ ok: false, status: 503 }),
    );
    const { buildUpstashLogStore } = await import("@/lib/upstash-log-store");
    expect(await buildUpstashLogStore("test")).toBeNull();
  });
});

describe("upstashRecordCosignature + upstashGetCosignatures", () => {
  it("dedups on (witnessId, signature) — re-submission is a no-op", async () => {
    const existing = JSON.stringify({
      witnessId: "EU",
      signature: "v2=AAA",
      submittedAt: "2026-01-01",
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockResponse({ json: async () => ({ result: [existing] }) }),
    );
    const { upstashRecordCosignature } =
      await import("@/lib/upstash-log-store");
    const r = await upstashRecordCosignature("canonical-text", "sthhash", {
      witnessId: "EU",
      signature: "v2=AAA",
      submittedAt: "2026-01-02",
    });
    expect(r.recorded).toBe(false);
    expect(r.firstForThisSth).toBe(false);
  });

  it("records a fresh cosignature when no dup", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        mockResponse({ json: async () => ({ result: [] }) }),
      ) // lrange existing
      .mockResolvedValueOnce(
        mockResponse({ json: async () => ({ result: 1 }) }),
      ) // set canonical
      .mockResolvedValueOnce(
        mockResponse({ json: async () => ({ result: 1 }) }),
      ); // rpush cosig
    const { upstashRecordCosignature } =
      await import("@/lib/upstash-log-store");
    const r = await upstashRecordCosignature("canonical", "hash", {
      witnessId: "US",
      signature: "v2=BBB",
      submittedAt: "2026-01-02",
    });
    expect(r.recorded).toBe(true);
    expect(r.firstForThisSth).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://test.upstash.io/rpush/art-log:cosig:hash",
      expect.any(Object),
    );
  });

  it("getCosignatures returns empty list when Upstash is unconfigured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    const { upstashGetCosignatures } = await import("@/lib/upstash-log-store");
    expect(await upstashGetCosignatures("any")).toEqual([]);
  });

  it("getCosignatures returns empty list on Upstash error (graceful)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockResponse({ ok: false, status: 503 }),
    );
    const { upstashGetCosignatures } = await import("@/lib/upstash-log-store");
    expect(await upstashGetCosignatures("any")).toEqual([]);
  });

  it("getCosignatures parses each row as JSON; skips malformed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      mockResponse({
        json: async () => ({
          result: [
            JSON.stringify({
              witnessId: "A",
              signature: "v2=X",
              submittedAt: "now",
            }),
            "not-valid-json",
            JSON.stringify({
              witnessId: "B",
              signature: "v2=Y",
              submittedAt: "later",
            }),
          ],
        }),
      }),
    );
    const { upstashGetCosignatures } = await import("@/lib/upstash-log-store");
    const list = await upstashGetCosignatures("hash");
    expect(list.length).toBe(2);
    expect(list[0].witnessId).toBe("A");
    expect(list[1].witnessId).toBe("B");
  });
});
