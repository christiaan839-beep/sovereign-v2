/**
 * appeals-store — graceful no-DB tests.
 *
 * Verifies the contract that route handlers depend on:
 *   - Every helper returns a sane shape when DATABASE_URL is unset
 *   - Nothing throws on hostile inputs
 *
 * Lives in its own file (separate from appeals.test.ts) because the
 * route-level test file mocks @/lib/appeals-store; co-locating both
 * sets of tests would have one shadowing the other.
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
  return await import("../appeals-store");
}

describe("appeals-store — graceful no-DB fallback", () => {
  it("createAppeal returns null when DB is unavailable", async () => {
    const { createAppeal } = await importStore();
    const result = await createAppeal({
      userId: "u",
      targetKind: "run",
      targetId: "abc",
      message: "Please review this run",
    });
    expect(result).toBeNull();
  });

  it("listAppeals returns empty array when DB is unavailable", async () => {
    const { listAppeals } = await importStore();
    const result = await listAppeals({ userId: "u" });
    expect(result).toEqual({ appeals: [] });
  });

  it("never throws on hostile inputs", async () => {
    const { createAppeal, listAppeals } = await importStore();
    await expect(
      createAppeal({
        userId: "u",
        targetKind: "run",
        targetId: "x",
        message: "test message",
      }),
    ).resolves.not.toThrow();
    await expect(listAppeals({ userId: "u" })).resolves.not.toThrow();
  });
});
