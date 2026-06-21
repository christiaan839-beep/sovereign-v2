/**
 * Tests for the per-user write cap in src/lib/vector-memory.ts (BACKLOG H2).
 *
 * Invariant: storeMemory must bound per-user rows. When a user is at/over
 * MAX_MEMORIES_PER_USER, the oldest rows are pruned (FIFO) before the insert
 * so storage stays bounded and IVFFlat recall does not degrade. A failed
 * prune must never block the write.
 *
 * We drive the cap through the public storeMemory and detect which SQL ran by
 * inspecting the drizzle query chunks (COUNT / DELETE / INSERT).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbExecuteMock, getNimKeyMock } = vi.hoisted(() => ({
  dbExecuteMock: vi.fn(),
  getNimKeyMock: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/db", () => ({
  db: { execute: dbExecuteMock },
}));

vi.mock("@/lib/nvidia", () => ({
  getNimKey: getNimKeyMock,
}));

import { storeMemory, MAX_MEMORIES_PER_USER } from "../vector-memory";

/** Extract the static SQL text from a drizzle `sql` template object. */
function sqlText(q: unknown): string {
  try {
    const chunks =
      (q as { queryChunks?: unknown[] } | undefined)?.queryChunks ?? [];
    return chunks
      .map((c) => {
        if (typeof c === "string") return c;
        const v = (c as { value?: unknown }).value;
        if (Array.isArray(v)) return v.join("");
        if (typeof v === "string") return v;
        return "";
      })
      .join(" ");
  } catch {
    return "";
  }
}

function executedTexts(): string[] {
  return dbExecuteMock.mock.calls.map((call) => sqlText(call[0]));
}

function deleteIssued(): boolean {
  return executedTexts().some((t) => /DELETE\s+FROM\s+agent_memories/i.test(t));
}

/** Wire the mock so COUNT(*) returns `count`; everything else resolves empty. */
function wireCount(count: number) {
  dbExecuteMock.mockImplementation((q: unknown) => {
    if (/COUNT\(\*\)/i.test(sqlText(q))) {
      return Promise.resolve({ rows: [{ n: count }] });
    }
    return Promise.resolve({ rows: [] });
  });
}

beforeEach(() => {
  dbExecuteMock.mockReset();
  getNimKeyMock.mockReset();
  // No embedding key → embedText short-circuits, exercising the text-only
  // insert path without any network call.
  getNimKeyMock.mockResolvedValue(null);
});

describe("storeMemory per-user cap", () => {
  it("does NOT prune when the user is below the cap", async () => {
    wireCount(MAX_MEMORIES_PER_USER - 1);
    const ok = await storeMemory("user-1", "leads", "a memory");
    expect(ok).toBe(true);
    expect(deleteIssued()).toBe(false);
  });

  it("prunes oldest rows when the user is at the cap", async () => {
    wireCount(MAX_MEMORIES_PER_USER);
    await storeMemory("user-1", "leads", "a memory");
    expect(deleteIssued()).toBe(true);
  });

  it("prunes when the user is over the cap", async () => {
    wireCount(MAX_MEMORIES_PER_USER + 250);
    await storeMemory("user-1", "leads", "a memory");
    expect(deleteIssued()).toBe(true);
  });

  it("runs a COUNT pre-flight scoped to the user before storing", async () => {
    wireCount(0);
    await storeMemory("user-1", "leads", "a memory");
    expect(executedTexts().some((t) => /COUNT\(\*\)/i.test(t))).toBe(true);
  });

  it("still writes when the cap-enforcement COUNT throws (best-effort)", async () => {
    // Prune failure must never block the write.
    let first = true;
    dbExecuteMock.mockImplementation((q: unknown) => {
      if (first && /COUNT\(\*\)/i.test(sqlText(q))) {
        first = false;
        return Promise.reject(new Error("db down"));
      }
      return Promise.resolve({ rows: [] });
    });
    const ok = await storeMemory("user-1", "leads", "a memory");
    expect(ok).toBe(true);
  });

  it("exposes a sane cap constant", () => {
    expect(MAX_MEMORIES_PER_USER).toBeGreaterThanOrEqual(1000);
  });
});
