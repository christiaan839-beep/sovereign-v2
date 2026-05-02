/**
 * Tests for src/lib/tenant-resolver.ts
 *
 * Multi-tenant boundary helper. Verifies:
 *  - Resolves Clerk userId → tenant UUID
 *  - In-memory cache hits avoid the DB after first call
 *  - invalidateTenantCache forces re-fetch
 *  - DB error returns undefined (does not throw)
 *  - Empty userId is rejected without DB call
 *  - Failed and empty lookups are NOT cached (so they retry)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = { id: string }[] | Error;

async function loadWithDb(rows: Row[]) {
  vi.resetModules();
  const calls: number[] = [];

  vi.doMock("@/db", () => {
    const remaining = [...rows];
    return {
      db: {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => {
                calls.push(1);
                const next = remaining.shift();
                if (next === undefined) {
                  return Promise.reject(new Error("queue exhausted"));
                }
                return next instanceof Error
                  ? Promise.reject(next)
                  : Promise.resolve(next);
              },
            }),
          }),
        }),
      },
    };
  });

  const mod = await import("@/lib/tenant-resolver");
  return { ...mod, dbCallCount: () => calls.length };
}

describe("resolveTenantId", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns the tenant UUID for a known user", async () => {
    const { resolveTenantId } = await loadWithDb([[{ id: "tenant_abc" }]]);
    expect(await resolveTenantId("user_clerk_1")).toBe("tenant_abc");
  });

  it("returns undefined for a user with no tenant row", async () => {
    const { resolveTenantId } = await loadWithDb([[]]);
    expect(await resolveTenantId("user_orphan")).toBeUndefined();
  });

  it("returns undefined for empty userId without hitting DB", async () => {
    const { resolveTenantId, dbCallCount } = await loadWithDb([]);
    expect(await resolveTenantId("")).toBeUndefined();
    expect(dbCallCount()).toBe(0);
  });

  it("caches the result so subsequent calls skip the DB", async () => {
    const { resolveTenantId, dbCallCount } = await loadWithDb([
      [{ id: "tenant_xyz" }],
    ]);
    expect(await resolveTenantId("user_cached")).toBe("tenant_xyz");
    expect(await resolveTenantId("user_cached")).toBe("tenant_xyz");
    expect(await resolveTenantId("user_cached")).toBe("tenant_xyz");
    expect(dbCallCount()).toBe(1);
  });

  it("isolates cache entries per user (no cross-tenant leakage)", async () => {
    const { resolveTenantId, dbCallCount } = await loadWithDb([
      [{ id: "tenant_alpha" }],
      [{ id: "tenant_beta" }],
    ]);
    expect(await resolveTenantId("user_a")).toBe("tenant_alpha");
    expect(await resolveTenantId("user_b")).toBe("tenant_beta");
    expect(await resolveTenantId("user_a")).toBe("tenant_alpha"); // cached
    expect(await resolveTenantId("user_b")).toBe("tenant_beta"); // cached
    expect(dbCallCount()).toBe(2); // never confused the two
  });

  it("invalidateTenantCache forces a fresh DB lookup", async () => {
    const { resolveTenantId, invalidateTenantCache, dbCallCount } =
      await loadWithDb([[{ id: "tenant_v1" }], [{ id: "tenant_v2" }]]);
    expect(await resolveTenantId("user_invalidate")).toBe("tenant_v1");
    invalidateTenantCache("user_invalidate");
    expect(await resolveTenantId("user_invalidate")).toBe("tenant_v2");
    expect(dbCallCount()).toBe(2);
  });

  it("returns undefined when the DB throws (does not crash)", async () => {
    const { resolveTenantId } = await loadWithDb([
      new Error("connection refused"),
    ]);
    expect(await resolveTenantId("user_db_down")).toBeUndefined();
  });

  it("does not cache failed lookups (retries on next call)", async () => {
    const { resolveTenantId, dbCallCount } = await loadWithDb([
      new Error("transient"),
      [{ id: "tenant_recovered" }],
    ]);
    expect(await resolveTenantId("user_retry")).toBeUndefined();
    expect(await resolveTenantId("user_retry")).toBe("tenant_recovered");
    expect(dbCallCount()).toBe(2);
  });

  it("does not cache empty lookups (orphan retries until tenant exists)", async () => {
    const { resolveTenantId, dbCallCount } = await loadWithDb([
      [],
      [{ id: "tenant_now_exists" }],
    ]);
    expect(await resolveTenantId("user_orphan_then_resolved")).toBeUndefined();
    expect(await resolveTenantId("user_orphan_then_resolved")).toBe(
      "tenant_now_exists",
    );
    expect(dbCallCount()).toBe(2);
  });
});
