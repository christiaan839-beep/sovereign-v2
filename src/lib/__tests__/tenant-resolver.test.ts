/**
 * Tests for src/lib/tenant-resolver.ts — userId → tenantId resolution.
 *
 * The cache is the multi-tenant isolation boundary. A stale read returning
 * the wrong tenantId means data leaks between organizations. A miss that
 * falls through to "undefined" means tenant-scoped queries silently return
 * the global view.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockDbResult = vi.fn();
let dbCallCount = 0;

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: async () => {
            dbCallCount++;
            return mockDbResult();
          },
        }),
      }),
    })),
  },
}));

async function loadModule() {
  vi.resetModules();
  dbCallCount = 0;
  return await import("@/lib/tenant-resolver");
}

beforeEach(() => {
  vi.clearAllMocks();
  dbCallCount = 0;
});

describe("resolveTenantId — basic resolution", () => {
  it("returns undefined for empty userId without hitting DB", async () => {
    const { resolveTenantId } = await loadModule();
    const result = await resolveTenantId("");
    expect(result).toBeUndefined();
    expect(dbCallCount).toBe(0);
  });

  it("resolves a real userId to its tenantId", async () => {
    mockDbResult.mockResolvedValue([{ id: "tenant-uuid-abc" }]);
    const { resolveTenantId } = await loadModule();

    expect(await resolveTenantId("user_xyz")).toBe("tenant-uuid-abc");
    expect(dbCallCount).toBe(1);
  });

  it("returns undefined when the user has no tenant row (brand-new signup)", async () => {
    mockDbResult.mockResolvedValue([]);
    const { resolveTenantId } = await loadModule();

    expect(await resolveTenantId("user_new")).toBeUndefined();
  });

  it("returns undefined when the DB throws — never blocks the request", async () => {
    mockDbResult.mockRejectedValue(new Error("Neon down"));
    const { resolveTenantId } = await loadModule();

    expect(await resolveTenantId("user_during_outage")).toBeUndefined();
  });
});

describe("resolveTenantId — cache hit/miss", () => {
  it("second call hits the cache (no DB roundtrip)", async () => {
    mockDbResult.mockResolvedValue([{ id: "tenant-cached" }]);
    const { resolveTenantId } = await loadModule();

    expect(await resolveTenantId("user_cache_test")).toBe("tenant-cached");
    expect(await resolveTenantId("user_cache_test")).toBe("tenant-cached");
    // Only one DB call across two resolutions
    expect(dbCallCount).toBe(1);
  });

  it("different users do NOT cross-contaminate (isolation boundary)", async () => {
    const { resolveTenantId } = await loadModule();

    mockDbResult.mockResolvedValueOnce([{ id: "tenant-A" }]);
    expect(await resolveTenantId("user_A")).toBe("tenant-A");

    mockDbResult.mockResolvedValueOnce([{ id: "tenant-B" }]);
    expect(await resolveTenantId("user_B")).toBe("tenant-B");

    // Cache hits — should NOT swap
    expect(await resolveTenantId("user_A")).toBe("tenant-A");
    expect(await resolveTenantId("user_B")).toBe("tenant-B");
  });

  it("invalidateTenantCache forces a fresh DB lookup", async () => {
    const { resolveTenantId, invalidateTenantCache } = await loadModule();

    mockDbResult.mockResolvedValueOnce([{ id: "tenant-original" }]);
    expect(await resolveTenantId("user_to_invalidate")).toBe("tenant-original");
    expect(dbCallCount).toBe(1);

    invalidateTenantCache("user_to_invalidate");

    mockDbResult.mockResolvedValueOnce([{ id: "tenant-after-change" }]);
    expect(await resolveTenantId("user_to_invalidate")).toBe(
      "tenant-after-change",
    );
    expect(dbCallCount).toBe(2);
  });
});

describe("resolveTenantId — TTL behavior", () => {
  it("expired cache entries fall through to a fresh DB lookup", async () => {
    const { resolveTenantId } = await loadModule();

    // Freeze "now" so we can advance past the 5-min TTL.
    const realNow = Date.now;
    const t0 = 1_000_000_000_000;
    Date.now = () => t0;

    try {
      mockDbResult.mockResolvedValueOnce([{ id: "tenant-fresh" }]);
      expect(await resolveTenantId("user_ttl")).toBe("tenant-fresh");
      expect(dbCallCount).toBe(1);

      // Cache hit at t0+1m — no DB mock needed since it never gets called.
      Date.now = () => t0 + 60 * 1000;
      expect(await resolveTenantId("user_ttl")).toBe("tenant-fresh");
      expect(dbCallCount).toBe(1); // no new DB hit

      // Past TTL at t0+6m — cache expired, DB called fresh.
      Date.now = () => t0 + 6 * 60 * 1000;
      mockDbResult.mockResolvedValueOnce([{ id: "tenant-fresh-2" }]);
      expect(await resolveTenantId("user_ttl")).toBe("tenant-fresh-2");
      expect(dbCallCount).toBe(2); // fresh DB hit
    } finally {
      Date.now = realNow;
    }
  });
});
