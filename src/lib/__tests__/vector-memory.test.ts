/**
 * Vector-memory tests — pins the BACKLOG H2 contract: every successful
 * storeMemory write is followed by a per-user retention trim, and a
 * trim failure never fails the write.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const executeMock = vi.fn();

vi.mock("@/db", () => ({
  db: {
    execute: (...args: unknown[]) => executeMock(...args),
  },
}));

vi.mock("drizzle-orm", () => ({
  sql: Object.assign((...args: unknown[]) => ({ queryChunks: args }), {
    raw: (s: string) => s,
  }),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const getNimKeyMock = vi.fn();
vi.mock("@/lib/nvidia", () => ({
  getNimKey: (...args: unknown[]) => getNimKeyMock(...args),
}));

/** First template-string segment of a mocked sql`...` call. */
function sqlTextOf(call: unknown[]): string {
  const chunk = (call[0] as { queryChunks?: unknown[] })?.queryChunks?.[0];
  return Array.isArray(chunk) ? chunk.join(" ") : String(chunk ?? "");
}

function callsMatching(pattern: RegExp): unknown[][] {
  return executeMock.mock.calls.filter((c) => pattern.test(sqlTextOf(c)));
}

async function loadModule() {
  vi.resetModules();
  return import("@/lib/vector-memory");
}

beforeEach(() => {
  executeMock.mockReset().mockResolvedValue({ rows: [] });
  getNimKeyMock.mockReset().mockResolvedValue(null); // default: no embedding
});

describe("MAX_MEMORIES_PER_USER", () => {
  it("defaults to 10,000", async () => {
    const mod = await loadModule();
    expect(mod.MAX_MEMORIES_PER_USER).toBe(10_000);
  });
});

describe("storeMemory — per-user write cap (H2)", () => {
  it("runs a retention DELETE after a text-only insert", async () => {
    const mod = await loadModule();
    const ok = await mod.storeMemory("user-1", "leads", "found 7 fintechs");
    expect(ok).toBe(true);

    const inserts = callsMatching(/INSERT INTO agent_memories/);
    const trims = callsMatching(/DELETE FROM agent_memories/);
    expect(inserts.length).toBe(1);
    expect(trims.length).toBe(1);
    // Trim must run AFTER the insert
    const insertIdx = executeMock.mock.calls.findIndex((c) =>
      /INSERT INTO agent_memories/.test(sqlTextOf(c)),
    );
    const trimIdx = executeMock.mock.calls.findIndex((c) =>
      /DELETE FROM agent_memories/.test(sqlTextOf(c)),
    );
    expect(trimIdx).toBeGreaterThan(insertIdx);
  });

  it("runs a retention DELETE after an embedded insert", async () => {
    getNimKeyMock.mockResolvedValue("nim-key");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
          { status: 200 },
        ),
      );
    try {
      const mod = await loadModule();
      const ok = await mod.storeMemory("user-2", "leads", "embedded memory");
      expect(ok).toBe(true);
      expect(callsMatching(/DELETE FROM agent_memories/).length).toBe(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("trim failure does not fail the write", async () => {
    const mod = await loadModule();
    executeMock.mockImplementation((arg: unknown) => {
      if (/DELETE FROM agent_memories/.test(sqlTextOf([arg]))) {
        return Promise.reject(new Error("trim exploded"));
      }
      return Promise.resolve({ rows: [] });
    });
    const ok = await mod.storeMemory("user-3", "leads", "still stored");
    expect(ok).toBe(true);
  });

  it("does not trim when the insert itself fails", async () => {
    const mod = await loadModule();
    // Let table-init succeed, then fail the INSERT.
    executeMock.mockImplementation((arg: unknown) => {
      const text = sqlTextOf([arg]);
      if (/INSERT INTO agent_memories/.test(text)) {
        return Promise.reject(new Error("insert failed"));
      }
      return Promise.resolve({ rows: [] });
    });
    const ok = await mod.storeMemory("user-4", "leads", "won't store");
    expect(ok).toBe(false);
    expect(callsMatching(/DELETE FROM agent_memories/).length).toBe(0);
  });

  it("passes the cap as the OFFSET parameter of the trim statement", async () => {
    const mod = await loadModule();
    await mod.storeMemory("user-5", "leads", "cap check");
    const trims = callsMatching(/DELETE FROM agent_memories/);
    expect(trims.length).toBe(1);
    // queryChunks = [stringsArray, ...values]; values include userId + cap
    const values = (
      trims[0][0] as { queryChunks: unknown[] }
    ).queryChunks.slice(1);
    expect(values).toContain("user-5");
    expect(values).toContain(mod.MAX_MEMORIES_PER_USER);
  });
});
