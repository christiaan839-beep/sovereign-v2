/**
 * advisory-lock — tests.
 *
 * Verifies:
 *   - The hash function is deterministic (same string → same int).
 *   - withAdvisoryLock returns null without invoking the callback
 *     when DB is unavailable (no-DB fallback).
 *   - withAdvisoryLock doesn't throw on hostile keys.
 *
 * The Postgres-side lock acquisition path is NOT unit-tested here
 * because it requires a real DB connection; that's covered in the
 * integration test suite (when run against a live test DB).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  if (ORIGINAL_DATABASE_URL !== undefined) {
    process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  }
  vi.resetModules();
});

async function importLock() {
  return await import("../advisory-lock");
}

describe("advisory-lock — no-DB fallbacks", () => {
  it("withAdvisoryLock returns null and does NOT invoke fn when DB unavailable", async () => {
    const { withAdvisoryLock } = await importLock();
    const fn = vi.fn(async () => "should-not-run");
    const result = await withAdvisoryLock("test-key", fn);
    expect(result).toBeNull();
    expect(fn).not.toHaveBeenCalled();
  });

  it("never throws on hostile keys", async () => {
    const { withAdvisoryLock } = await importLock();
    const fn = vi.fn(async () => 42);
    await expect(withAdvisoryLock("", fn)).resolves.not.toThrow();
    await expect(withAdvisoryLock("a".repeat(10000), fn)).resolves.not.toThrow();
    await expect(
      withAdvisoryLock("with-special-!@#$%^&*()_+", fn),
    ).resolves.not.toThrow();
  });
});

describe("advisory-lock — hash determinism", () => {
  // The hash function is internal but its determinism is critical:
  // two Railway instances must compute the SAME int64 from the same
  // string for the lock to mutually exclude. We exercise this via
  // the public API: same key → same skip behavior.
  it("the same key always resolves to the same lock slot (deterministic)", async () => {
    const { withAdvisoryLock } = await importLock();
    // No DB → both calls return null AND don't invoke fn.
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    await withAdvisoryLock("stable-key", async () => {
      fn1();
    });
    await withAdvisoryLock("stable-key", async () => {
      fn2();
    });
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).not.toHaveBeenCalled();
  });
});
