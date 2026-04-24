/**
 * Tests for embedding-cache — memory-path + stats + purge.
 *
 * Upstash path is integration-tested against a staging Upstash
 * instance. Here we verify the pure in-memory behaviour that 100%
 * of non-Upstash users rely on.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getCachedEmbedding,
  getEmbeddingCacheStats,
  purgeEmbeddingCacheMemory,
  setCachedEmbedding,
} from "../embedding-cache";

const MODEL = "nvidia/llama-3.2-nv-embedqa-1b-v2";

describe("embedding-cache (memory path)", () => {
  const ORIG_UPSTASH = process.env.UPSTASH_REDIS_REST_URL;
  const ORIG_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    purgeEmbeddingCacheMemory();
  });
  afterEach(() => {
    if (ORIG_UPSTASH) process.env.UPSTASH_REDIS_REST_URL = ORIG_UPSTASH;
    else delete process.env.UPSTASH_REDIS_REST_URL;
    if (ORIG_TOKEN) process.env.UPSTASH_REDIS_REST_TOKEN = ORIG_TOKEN;
    else delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("returns null on miss", async () => {
    const r = await getCachedEmbedding("hello world", MODEL);
    expect(r).toBeNull();
  });

  it("stores and retrieves a vector", async () => {
    const vec = [0.1, 0.2, 0.3];
    await setCachedEmbedding("hello world", MODEL, vec);
    const r = await getCachedEmbedding("hello world", MODEL);
    expect(r).toEqual(vec);
  });

  it("is case-insensitive + whitespace-tolerant on the text key", async () => {
    const vec = [1, 2, 3];
    await setCachedEmbedding("Find Invoices", MODEL, vec);
    expect(await getCachedEmbedding("find invoices", MODEL)).toEqual(vec);
    expect(await getCachedEmbedding("  Find Invoices  ", MODEL)).toEqual(vec);
  });

  it("distinguishes by model (same text, different model = different entry)", async () => {
    const v1 = [1, 0];
    const v2 = [0, 1];
    await setCachedEmbedding("same text", MODEL, v1);
    await setCachedEmbedding("same text", "nvidia/other-embedder", v2);
    expect(await getCachedEmbedding("same text", MODEL)).toEqual(v1);
    expect(await getCachedEmbedding("same text", "nvidia/other-embedder")).toEqual(v2);
  });

  it("ignores empty / whitespace-only text", async () => {
    expect(await getCachedEmbedding("", MODEL)).toBeNull();
    expect(await getCachedEmbedding("   ", MODEL)).toBeNull();
    await setCachedEmbedding("", MODEL, [1]); // should no-op
    expect(await getCachedEmbedding("", MODEL)).toBeNull();
  });

  it("ignores empty-vector set calls", async () => {
    await setCachedEmbedding("anything", MODEL, []);
    expect(await getCachedEmbedding("anything", MODEL)).toBeNull();
  });

  it("tracks hits / misses / sets stats", async () => {
    const before = getEmbeddingCacheStats();
    expect(before.hits).toBe(0);
    expect(before.misses).toBe(0);

    // Miss
    await getCachedEmbedding("miss", MODEL);
    // Set
    await setCachedEmbedding("hit", MODEL, [1]);
    // Hit
    await getCachedEmbedding("hit", MODEL);
    await getCachedEmbedding("hit", MODEL);

    const after = getEmbeddingCacheStats();
    expect(after.hits).toBe(2);
    expect(after.misses).toBe(1);
    expect(after.sets).toBe(1);
    expect(after.hitRate).toBeCloseTo(2 / 3);
  });

  it("reports mode correctly without upstash", () => {
    const s = getEmbeddingCacheStats();
    expect(s.mode).toBe("memory-only");
  });

  it("purge clears entries and resets counters", async () => {
    await setCachedEmbedding("x", MODEL, [1]);
    await getCachedEmbedding("x", MODEL);
    const before = getEmbeddingCacheStats();
    expect(before.memoryEntries).toBeGreaterThan(0);

    const cleared = purgeEmbeddingCacheMemory();
    expect(cleared).toBeGreaterThan(0);

    const after = getEmbeddingCacheStats();
    expect(after.memoryEntries).toBe(0);
    expect(after.hits).toBe(0);
    expect(after.misses).toBe(0);
    expect(after.sets).toBe(0);
  });
});
