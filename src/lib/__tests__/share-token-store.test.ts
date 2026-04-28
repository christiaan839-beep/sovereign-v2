/**
 * share-token-store — graceful no-DB tests + token generation.
 *
 * The DB-backed paths are tested at route-level (mocked store);
 * here we verify:
 *   - Every helper handles "no DATABASE_URL" without throwing
 *   - Token generation produces 32-char hex strings (128 bits) and
 *     never collides across reasonable iteration counts
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

async function importStore() {
  return await import("../share-token-store");
}

describe("share-token-store — graceful no-DB fallback", () => {
  it("createShareToken returns null when DB is unavailable", async () => {
    const { createShareToken } = await importStore();
    const result = await createShareToken({ runId: "x", userId: "u" });
    expect(result).toBeNull();
  });

  it("listShareTokensForRun returns empty when DB is unavailable", async () => {
    const { listShareTokensForRun } = await importStore();
    const result = await listShareTokensForRun({
      runId: "x",
      userId: "u",
    });
    expect(result).toEqual({ shares: [] });
  });

  it("revokeShareToken returns revoked=false when DB is unavailable", async () => {
    const { revokeShareToken } = await importStore();
    const result = await revokeShareToken({ shareId: "x", userId: "u" });
    expect(result).toEqual({ revoked: false });
  });

  it("resolveShareToken returns null when DB is unavailable", async () => {
    const { resolveShareToken } = await importStore();
    const result = await resolveShareToken({ token: "abc" });
    expect(result).toBeNull();
  });

  it("never throws on hostile inputs", async () => {
    const store = await importStore();
    await expect(
      store.createShareToken({ runId: "", userId: "" }),
    ).resolves.not.toThrow();
    await expect(
      store.listShareTokensForRun({ runId: "", userId: "" }),
    ).resolves.not.toThrow();
    await expect(
      store.revokeShareToken({ shareId: "", userId: "" }),
    ).resolves.not.toThrow();
    await expect(
      store.resolveShareToken({ token: "" }),
    ).resolves.not.toThrow();
  });
});

describe("generateShareToken", () => {
  it("returns a 32-char hex string (128 bits of entropy)", async () => {
    const { generateShareToken } = await importStore();
    const token = generateShareToken();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it("does not collide across many iterations (entropy sanity check)", async () => {
    // 128 bits of entropy means collisions are astronomically
    // unlikely. 1000 tokens should produce 1000 unique values.
    const { generateShareToken } = await importStore();
    const tokens = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      tokens.add(generateShareToken());
    }
    expect(tokens.size).toBe(1000);
  });
});
