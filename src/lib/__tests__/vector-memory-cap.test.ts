/**
 * Wave 111.x — per-user memory cap (BACKLOG H2).
 *
 * Pins the LRU-trim contract on `storeMemory`/`trimOverCap`:
 *   - Below cap: no trim happens, no DELETE executed.
 *   - At/above cap: oldest rows are deleted in a single DELETE … IN (…)
 *     subquery, batched by TRIM_BATCH to amortise cleanup.
 *   - Trim failures DO NOT block the insert — the storeMemory call
 *     still proceeds (degraded retention is preferred to lost writes).
 *
 * The DB driver (`@/db`) is mocked so we can drive the count response
 * and observe the DELETE payload. Each test calls `vi.resetModules()`
 * so the module-level `_initialized` flag in vector-memory.ts doesn't
 * leak across tests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbExecuteMock } = vi.hoisted(() => ({
  dbExecuteMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: { execute: dbExecuteMock },
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@/lib/nvidia", () => ({
  getNimKey: vi.fn().mockResolvedValue(null), // force the no-embedding path
}));

beforeEach(() => {
  dbExecuteMock.mockReset();
  delete process.env.AGENT_MEMORIES_PER_USER_CAP;
  vi.resetModules();
});

// Detect a DELETE statement in a Drizzle `sql` template invocation.
// Drizzle stores the raw template strings in `queryChunks[i].value`
// as a `TemplateStringsArray`.
function isDeleteCall(call: unknown[]): boolean {
  const arg = call[0];
  const chunks = (arg as { queryChunks?: Array<{ value?: string[] }> })
    ?.queryChunks;
  if (!Array.isArray(chunks)) return false;
  return chunks.some(
    (c) =>
      Array.isArray(c?.value) && c.value.some((s) => /DELETE FROM/i.test(s)),
  );
}

describe("vector-memory — per-user cap trim", () => {
  it("does NOT trim when current count is below the cap", async () => {
    // ensureVectorTable: CREATE EXTENSION, CREATE TABLE, ivfflat INDEX, user INDEX
    dbExecuteMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    // trimOverCap: COUNT(*) — under cap
    dbExecuteMock.mockResolvedValueOnce({ rows: [{ n: 100 }] });
    // storeMemory: INSERT (no-embedding path)
    dbExecuteMock.mockResolvedValueOnce({});

    const { storeMemory } = await import("@/lib/vector-memory");
    const ok = await storeMemory("user-1", "leads", "hello", { foo: "bar" });
    expect(ok).toBe(true);
    expect(dbExecuteMock.mock.calls.some(isDeleteCall)).toBe(false);
  });

  it("trims when current count is AT the cap (boundary)", async () => {
    dbExecuteMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    dbExecuteMock.mockResolvedValueOnce({ rows: [{ n: 10_000 }] });
    dbExecuteMock.mockResolvedValueOnce({}); // DELETE
    dbExecuteMock.mockResolvedValueOnce({}); // INSERT

    const { storeMemory } = await import("@/lib/vector-memory");
    const ok = await storeMemory("user-2", "leads", "hello");
    expect(ok).toBe(true);
    expect(dbExecuteMock.mock.calls.some(isDeleteCall)).toBe(true);
  });

  it("trims more aggressively when WELL over the cap", async () => {
    // trimOverCap can be called standalone — it skips ensureVectorTable.
    dbExecuteMock.mockResolvedValueOnce({ rows: [{ n: 10_500 }] }); // COUNT
    dbExecuteMock.mockResolvedValueOnce({}); // DELETE

    const { trimOverCap } = await import("@/lib/vector-memory");
    // count - cap + TRIM_BATCH = 500 + 50 = 550
    expect(await trimOverCap("user-3")).toBe(550);
  });

  it("trim failure does NOT block the insert", async () => {
    dbExecuteMock
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    // COUNT throws
    dbExecuteMock.mockRejectedValueOnce(new Error("transient DB error"));
    // INSERT succeeds
    dbExecuteMock.mockResolvedValueOnce({});

    const { storeMemory } = await import("@/lib/vector-memory");
    const ok = await storeMemory("user-4", "leads", "hello");
    expect(ok).toBe(true);
  });

  it("respects AGENT_MEMORIES_PER_USER_CAP env override (above the 100 floor)", async () => {
    process.env.AGENT_MEMORIES_PER_USER_CAP = "500";

    dbExecuteMock.mockResolvedValueOnce({ rows: [{ n: 600 }] });
    dbExecuteMock.mockResolvedValueOnce({}); // DELETE

    const { trimOverCap } = await import("@/lib/vector-memory");
    // 600 - 500 + 50 = 150
    expect(await trimOverCap("user-5")).toBe(150);
  });

  it("ignores nonsensical env (negative, below floor) — falls back to default", async () => {
    process.env.AGENT_MEMORIES_PER_USER_CAP = "-99";

    dbExecuteMock.mockResolvedValueOnce({ rows: [{ n: 9_999 }] });

    const { trimOverCap } = await import("@/lib/vector-memory");
    expect(await trimOverCap("user-6")).toBe(0);
  });

  it("empty userId is a no-op (defensive: never trim across all users)", async () => {
    const { trimOverCap } = await import("@/lib/vector-memory");
    expect(await trimOverCap("")).toBe(0);
    expect(dbExecuteMock).not.toHaveBeenCalled();
  });
});
