/**
 * Tests for src/lib/federation-block-set.ts.
 *
 * Locks the critical invariants:
 *   - Fail-open semantics (Redis down ≠ user blocked)
 *   - 30s per-isolate cache for the read path
 *   - Pipeline shape matches Upstash's REST contract
 *   - SHA-256 fingerprintId shape validation on writes
 *   - clearLocalCache resets cache (test utility)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import {
  writeBlockSet,
  isFederationBlocked,
  clearLocalCache,
} from "../federation-block-set";

const originalFetch = globalThis.fetch;
const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

beforeEach(() => {
  clearLocalCache();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) {
    delete process.env.UPSTASH_REDIS_REST_URL;
  } else {
    process.env.UPSTASH_REDIS_REST_URL = originalUrl;
  }
  if (originalToken === undefined) {
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  } else {
    process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  }
});

// 64-char hex fingerprintIds (real sha256 shape).
const FP_A = "a".repeat(64);
const FP_B = "b".repeat(64);
const FP_C = "c".repeat(64);

describe("writeBlockSet — Redis-unconfigured (no-op)", () => {
  it("returns ok:false + written:0 when env unset", async () => {
    const result = await writeBlockSet([FP_A, FP_B]);
    expect(result).toEqual({ written: 0, ok: false });
  });

  it("does not make any fetch calls when env unset", async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    await writeBlockSet([FP_A]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("writeBlockSet — Redis-configured", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://test-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  });

  it("issues a DEL + SADD + EXPIRE pipeline on non-empty input", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ result: 1 }, { result: 2 }, { result: 1 }]),
        {
          status: 200,
        },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await writeBlockSet([FP_A, FP_B]);
    expect(result).toEqual({ written: 2, ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://test-redis.upstash.io/pipeline");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-token",
    );
    const body = JSON.parse(init.body as string) as unknown[][];
    expect(body[0]).toEqual(["DEL", "sovereign:federation:blockset"]);
    expect(body[1][0]).toBe("SADD");
    expect(body[1][1]).toBe("sovereign:federation:blockset");
    expect(body[1].slice(2)).toEqual([FP_A, FP_B]);
    expect(body[2]).toEqual(["EXPIRE", "sovereign:federation:blockset", 86400]);
  });

  it("issues only DEL when input is empty (clears the set)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ result: 1 }]), { status: 200 }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await writeBlockSet([]);
    expect(result).toEqual({ written: 0, ok: true });

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    ) as unknown[][];
    expect(body).toHaveLength(1);
    expect(body[0]).toEqual(["DEL", "sovereign:federation:blockset"]);
  });

  it("deduplicates the input set before writing", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ result: 1 }, { result: 1 }, { result: 1 }]),
        {
          status: 200,
        },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await writeBlockSet([FP_A, FP_A, FP_A]);
    expect(result.written).toBe(1);
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    ) as unknown[][];
    expect(body[1].slice(2)).toEqual([FP_A]);
  });

  it("drops malformed fingerprintIds (non-hex / wrong length)", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ result: 1 }, { result: 1 }, { result: 1 }]),
        {
          status: 200,
        },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await writeBlockSet([
      FP_A,
      "not-a-valid-fingerprint-id",
      "short",
      "",
      "g".repeat(64), // not hex
    ]);
    expect(result.written).toBe(1);
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    ) as unknown[][];
    expect(body[1].slice(2)).toEqual([FP_A]);
  });

  it("returns ok:false on non-2xx Redis response", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("internal error", { status: 503 }),
      ) as unknown as typeof fetch;

    const result = await writeBlockSet([FP_A]);
    expect(result.ok).toBe(false);
  });

  it("returns ok:false on fetch throw (network down)", async () => {
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("ECONNREFUSED"),
      ) as unknown as typeof fetch;

    const result = await writeBlockSet([FP_A]);
    expect(result.ok).toBe(false);
  });

  it("never throws on any failure path", async () => {
    globalThis.fetch = vi.fn().mockImplementationOnce(() => {
      throw new Error("synchronous throw");
    }) as unknown as typeof fetch;

    await expect(writeBlockSet([FP_A])).resolves.toEqual({
      written: 0,
      ok: false,
    });
  });

  it("invalidates the in-process cache after a successful write", async () => {
    // First pretend an earlier read populated the cache with "matched=false".
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    const reads = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ result: 0 }]), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ result: 1 }]), { status: 200 }),
      );
    globalThis.fetch = reads as unknown as typeof fetch;

    // Stale negative now cached.
    expect(await isFederationBlocked(FP_A)).toBe(false);

    // Cron writes (pipeline returns success). This must invalidate.
    const writeMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify([{ result: 1 }, { result: 1 }, { result: 1 }]),
        {
          status: 200,
        },
      ),
    );
    globalThis.fetch = writeMock as unknown as typeof fetch;
    await writeBlockSet([FP_A]);

    // Next read goes back to Redis (cache cleared) → returns matched=true.
    globalThis.fetch = reads as unknown as typeof fetch;
    expect(await isFederationBlocked(FP_A)).toBe(true);
  });
});

describe("isFederationBlocked — fail-open semantics", () => {
  it("returns false when Redis env unset", async () => {
    expect(await isFederationBlocked(FP_A)).toBe(false);
  });

  it("returns false on Redis throw", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    globalThis.fetch = vi
      .fn()
      .mockRejectedValueOnce(
        new Error("ECONNREFUSED"),
      ) as unknown as typeof fetch;

    expect(await isFederationBlocked(FP_A)).toBe(false);
  });

  it("returns false on non-2xx Redis response", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("err", { status: 500 }),
      ) as unknown as typeof fetch;

    expect(await isFederationBlocked(FP_A)).toBe(false);
  });

  it("returns false on empty / malformed fingerprintId without hitting Redis", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://test.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "tok";
    globalThis.fetch = vi.fn() as unknown as typeof fetch;

    expect(await isFederationBlocked("")).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("isFederationBlocked — Redis lookup", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://test-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  });

  it("returns true when SISMEMBER returns 1", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ result: 1 }]), { status: 200 }),
      ) as unknown as typeof fetch;
    expect(await isFederationBlocked(FP_A)).toBe(true);
  });

  it("returns false when SISMEMBER returns 0", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ result: 0 }]), { status: 200 }),
      ) as unknown as typeof fetch;
    expect(await isFederationBlocked(FP_A)).toBe(false);
  });

  it("issues SISMEMBER with the correct key + value", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ result: 1 }]), { status: 200 }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await isFederationBlocked(FP_B);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://test-redis.upstash.io/pipeline");
    const body = JSON.parse(init.body as string) as unknown[][];
    expect(body[0]).toEqual([
      "SISMEMBER",
      "sovereign:federation:blockset",
      FP_B,
    ]);
  });
});

describe("isFederationBlocked — per-isolate cache (30s)", () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = "https://test-redis.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  });

  it("second call for the same fingerprintId does NOT hit Redis (cached true)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ result: 1 }]), { status: 200 }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(await isFederationBlocked(FP_A)).toBe(true);
    expect(await isFederationBlocked(FP_A)).toBe(true);
    expect(await isFederationBlocked(FP_A)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches negative results too (avoids per-call Redis on benign traffic)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ result: 0 }]), { status: 200 }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(await isFederationBlocked(FP_C)).toBe(false);
    expect(await isFederationBlocked(FP_C)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("different fingerprintIds get separate cache entries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ result: 1 }]), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ result: 0 }]), { status: 200 }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(await isFederationBlocked(FP_A)).toBe(true);
    expect(await isFederationBlocked(FP_B)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clearLocalCache forces the next call back to Redis", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ result: 1 }]), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ result: 0 }]), { status: 200 }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    expect(await isFederationBlocked(FP_A)).toBe(true);
    clearLocalCache();
    expect(await isFederationBlocked(FP_A)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
