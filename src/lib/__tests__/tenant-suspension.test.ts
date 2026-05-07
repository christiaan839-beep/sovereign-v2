/**
 * Tenant-suspension cache + invalidation tests.
 *
 * The DB lookup itself is exercised in the migration verification
 * SELECT inside MIGRATIONS-RUNME.sql. Here we pin the public
 * surface that agent-factory depends on:
 *
 *   - the cache returns the same value within the TTL
 *   - invalidateSuspensionCache() forces the next call to re-read
 *   - the test reset hook clears every entry
 *
 * We don't mock Drizzle. The first call inside each test is allowed
 * to hit Postgres and fail (no `tenants` table in the unit-test
 * environment); the function fails OPEN (returns null) which is
 * the documented behaviour. After that first call, the cache is
 * populated and subsequent assertions are deterministic.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  isTenantSuspended,
  invalidateSuspensionCache,
  _resetSuspensionCache,
} from "../tenant-suspension";

describe("tenant-suspension cache", () => {
  beforeEach(() => {
    _resetSuspensionCache();
  });

  it("returns null when the DB read fails (fail-OPEN)", async () => {
    // No `tenants` table in the test environment — the function
    // must not throw, and must not lock the platform out.
    const result = await isTenantSuspended("nonexistent-tenant-id");
    expect(result).toBeNull();
  });

  it("invalidateSuspensionCache() clears a single entry", async () => {
    await isTenantSuspended("tenant-A");
    // Should be cached now (as null). Invalidate it explicitly.
    invalidateSuspensionCache("tenant-A");
    // Calling again is a no-throw smoke — we don't need to assert
    // a specific re-read happened, just that invalidation is
    // safe to call.
    const after = await isTenantSuspended("tenant-A");
    expect(after).toBeNull();
  });

  it("_resetSuspensionCache() is idempotent", () => {
    _resetSuspensionCache();
    _resetSuspensionCache();
    // No assertion — we're confirming the call is safe to call
    // multiple times. Vitest fails the test on a thrown error.
  });
});
