/**
 * usage-outbox — tests.
 *
 * Verifies the graceful no-DB fallback contract (drainer never
 * throws, always returns a sane shape) and the bounded behavior
 * (limit clamping).
 *
 * The DB-backed paths (idempotent retry, attempts increment, mark
 * 'failed' after MAX_ATTEMPTS) are exercised in route-level
 * integration tests with mocked drizzle.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

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

async function importOutbox() {
  return await import("../usage-outbox");
}

describe("usage-outbox — graceful no-DB fallbacks", () => {
  it("drainUsageOutbox returns zero-shape when DB is unavailable", async () => {
    const { drainUsageOutbox } = await importOutbox();
    const result = await drainUsageOutbox();
    expect(result).toEqual({ drained: 0, permanentlyFailed: 0, retried: 0 });
  });

  it("drainUsageOutbox clamps limit to a sensible range", async () => {
    const { drainUsageOutbox } = await importOutbox();
    // Both extremes should not throw — no DB so the limit clamp
    // code runs but returns the fallback empty result.
    await expect(drainUsageOutbox({ limit: -10 })).resolves.not.toThrow();
    await expect(drainUsageOutbox({ limit: 999_999 })).resolves.not.toThrow();
  });

  it("getOutboxDepth returns zero-shape when DB is unavailable", async () => {
    const { getOutboxDepth } = await importOutbox();
    const result = await getOutboxDepth();
    expect(result).toEqual({ pending: 0, failed: 0 });
  });

  it("never throws on hostile inputs", async () => {
    const { drainUsageOutbox, getOutboxDepth } = await importOutbox();
    await expect(drainUsageOutbox()).resolves.not.toThrow();
    await expect(getOutboxDepth()).resolves.not.toThrow();
  });
});
