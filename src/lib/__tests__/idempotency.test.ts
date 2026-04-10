/**
 * Tests for src/lib/idempotency.ts — Duplicate event detection
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Isolate each test by re-importing the module so the in-memory store resets.
async function freshModule() {
  vi.resetModules();
  return await import("@/lib/idempotency");
}

describe("idempotency — in-memory fallback", () => {
  beforeEach(() => {
    // Ensure we use the in-memory path, not Redis.
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("returns false on first seen, true on second", async () => {
    const { alreadyProcessed } = await freshModule();
    const id = "evt_first_" + Math.random();

    expect(await alreadyProcessed("stripe:event", id)).toBe(false);
    expect(await alreadyProcessed("stripe:event", id)).toBe(true);
  });

  it("namespaces are isolated — same id in different namespaces is not a dupe", async () => {
    const { alreadyProcessed } = await freshModule();
    const id = "evt_shared";

    expect(await alreadyProcessed("stripe:event", id)).toBe(false);
    expect(await alreadyProcessed("paypal:event", id)).toBe(false);
  });

  it("different ids in same namespace are not dupes", async () => {
    const { alreadyProcessed } = await freshModule();

    expect(await alreadyProcessed("stripe:event", "evt_a")).toBe(false);
    expect(await alreadyProcessed("stripe:event", "evt_b")).toBe(false);
    expect(await alreadyProcessed("stripe:event", "evt_a")).toBe(true);
  });

  it("expired entries are forgotten — ttl=0 means immediate expiry", async () => {
    const { alreadyProcessed } = await freshModule();
    const id = "evt_expiring";

    // TTL of 0 seconds means the entry is already expired the next call.
    expect(await alreadyProcessed("ttl-test", id, 0)).toBe(false);
    // Small real-time wait to let Date.now() tick past the expiration.
    await new Promise((r) => setTimeout(r, 10));
    expect(await alreadyProcessed("ttl-test", id, 0)).toBe(false);
  });
});
