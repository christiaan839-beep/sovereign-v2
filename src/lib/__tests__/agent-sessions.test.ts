/**
 * Tests for src/lib/agent-sessions.ts — Wave 126.
 *
 * Mocks the drizzle `db` module via vi.hoisted so the factory closure
 * has access to a singleton in-memory fake row that survives across
 * tests. Pins user-scoping, JSON encoding, step LRU semantics, and
 * the missing-table fail-soft path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

interface FakeRow {
  id: string;
  userId: string;
  agentName: string;
  status: string;
  state: string;
  steps: string;
  stepCount: number;
  createdAt: Date;
  lastTouchedAt: Date;
  expiresAt: Date | null;
}

const harness = vi.hoisted(() => {
  const s: {
    row: FakeRow | null;
    inserts: number;
    updates: number;
    throwNext: boolean;
  } = {
    row: null,
    inserts: 0,
    updates: 0,
    throwNext: false,
  };
  return {
    s,
    setRow(r: FakeRow | null) {
      s.row = r;
    },
    reset() {
      s.row = null;
      s.inserts = 0;
      s.updates = 0;
      s.throwNext = false;
    },
  };
});

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: (vals: Record<string, unknown>) => ({
        returning: async () => {
          if (harness.s.throwNext) {
            harness.s.throwNext = false;
            const err = new Error('relation "agent_sessions" does not exist');
            (err as { code?: string }).code = "42P01";
            throw err;
          }
          harness.s.inserts++;
          harness.s.row = {
            id: "sess_id",
            userId: (vals.userId as string) ?? "user_123",
            agentName: (vals.agentName as string) ?? "lead-blitz",
            status: (vals.status as string) ?? "active",
            state: (vals.state as string) ?? "{}",
            steps: "[]",
            stepCount: 0,
            createdAt: new Date(),
            lastTouchedAt: new Date(),
            expiresAt: (vals.expiresAt as Date | null) ?? null,
          };
          return [harness.s.row];
        },
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (harness.s.row ? [harness.s.row] : []),
          orderBy: () => ({
            limit: async () => (harness.s.row ? [harness.s.row] : []),
          }),
        }),
      }),
    }),
    update: () => ({
      set: (patch: Record<string, unknown>) => ({
        where: async () => {
          harness.s.updates++;
          if (harness.s.row) {
            for (const [k, v] of Object.entries(patch)) {
              (harness.s.row as unknown as Record<string, unknown>)[k] = v;
            }
          }
        },
      }),
    }),
  },
}));

vi.mock("@/db/schema", () => ({
  agentSessions: {
    id: "id",
    userId: "userId",
    agentName: "agentName",
    status: "status",
    state: "state",
    steps: "steps",
    stepCount: "stepCount",
    createdAt: "createdAt",
    lastTouchedAt: "lastTouchedAt",
    expiresAt: "expiresAt",
    $inferSelect: undefined as never,
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ __op: "eq", a, b })),
  and: vi.fn((...c: unknown[]) => ({ __op: "and", c })),
  or: vi.fn((...c: unknown[]) => ({ __op: "or", c })),
  gt: vi.fn((a: unknown, b: unknown) => ({ __op: "gt", a, b })),
  isNull: vi.fn((a: unknown) => ({ __op: "isNull", a })),
  desc: vi.fn((a: unknown) => ({ __op: "desc", a })),
}));

import {
  createSession,
  getSession,
  appendStep,
  updateState,
  endSession,
  listOpenSessions,
} from "@/lib/agent-sessions";

function freshRow(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    id: "s1",
    userId: "u1",
    agentName: "x",
    status: "active",
    state: "{}",
    steps: "[]",
    stepCount: 0,
    createdAt: new Date(),
    lastTouchedAt: new Date(),
    expiresAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  harness.reset();
});

describe("createSession", () => {
  it("returns null for anon userId", async () => {
    expect(await createSession("anon", "lead-blitz")).toBeNull();
  });

  it("returns null for empty userId", async () => {
    expect(await createSession("", "lead-blitz")).toBeNull();
  });

  it("creates a session with sensible defaults", async () => {
    const sess = await createSession("user_123", "lead-blitz");
    expect(sess).not.toBeNull();
    expect(sess?.agentName).toBe("lead-blitz");
    expect(sess?.status).toBe("active");
    expect(sess?.stepCount).toBe(0);
    expect(sess?.state).toEqual({});
    expect(harness.s.inserts).toBe(1);
  });

  it("accepts initialState", async () => {
    const sess = await createSession("user_123", "a", {
      initialState: { hello: "world", n: 42 },
    });
    expect(sess?.state).toEqual({ hello: "world", n: 42 });
  });

  it("returns null gracefully when table is missing (42P01)", async () => {
    harness.s.throwNext = true;
    expect(await createSession("user_123", "lead-blitz")).toBeNull();
  });

  it("rejects oversize initialState (>64 KB)", async () => {
    const big = { blob: "x".repeat(70_000) };
    expect(
      await createSession("user_123", "x", { initialState: big }),
    ).toBeNull();
  });

  it("honors ttlMinutes by setting expiresAt", async () => {
    const before = Date.now();
    await createSession("user_123", "x", { ttlMinutes: 10 });
    const expires = harness.s.row?.expiresAt;
    expect(expires).toBeInstanceOf(Date);
    if (expires instanceof Date) {
      const drift = expires.getTime() - before - 10 * 60_000;
      expect(Math.abs(drift)).toBeLessThan(2_000);
    }
  });
});

describe("getSession", () => {
  it("returns null for empty sessionId or userId", async () => {
    expect(await getSession("", "u")).toBeNull();
    expect(await getSession("s", "")).toBeNull();
  });

  it("returns the parsed session row", async () => {
    harness.setRow(
      freshRow({
        state: '{"foo":1}',
        steps: '[{"index":0,"label":"start","at":"2026-05-22T00:00:00Z"}]',
        stepCount: 1,
      }),
    );
    const sess = await getSession("s1", "u1");
    expect(sess?.state).toEqual({ foo: 1 });
    expect(sess?.steps.length).toBe(1);
    expect(sess?.steps[0].label).toBe("start");
  });

  it("gracefully handles a malformed state JSON blob", async () => {
    harness.setRow(freshRow({ state: "not-json" }));
    const sess = await getSession("s1", "u1");
    expect(sess?.state).toEqual({});
  });
});

describe("appendStep", () => {
  beforeEach(() => {
    harness.setRow(freshRow());
  });

  it("appends a step and increments stepCount", async () => {
    const ok = await appendStep("s1", "u1", { label: "tool:fetch" });
    expect(ok).toBe(true);
    const updated = JSON.parse(harness.s.row!.steps);
    expect(updated.length).toBe(1);
    expect(updated[0].label).toBe("tool:fetch");
    expect(updated[0].index).toBe(0);
    expect(harness.s.row!.stepCount).toBe(1);
  });

  it("LRU-caps the step list at 50 entries", async () => {
    harness.setRow(
      freshRow({
        steps: JSON.stringify(
          Array.from({ length: 55 }, (_, i) => ({
            index: i,
            label: `s${i}`,
            at: "2026-05-22T00:00:00Z",
          })),
        ),
        stepCount: 55,
      }),
    );
    const ok = await appendStep("s1", "u1", { label: "newest" });
    expect(ok).toBe(true);
    const updated = JSON.parse(harness.s.row!.steps);
    expect(updated.length).toBe(50);
    expect(updated[updated.length - 1].label).toBe("newest");
  });

  it("returns false if session is missing", async () => {
    harness.setRow(null);
    expect(await appendStep("missing", "u1", { label: "x" })).toBe(false);
  });
});

describe("updateState", () => {
  it("applies the patcher and writes back", async () => {
    harness.setRow(freshRow({ state: '{"a":1}' }));
    const ok = await updateState("s1", "u1", (prev) => ({ ...prev, b: 2 }));
    expect(ok).toBe(true);
    expect(JSON.parse(harness.s.row!.state)).toEqual({ a: 1, b: 2 });
  });
});

describe("endSession", () => {
  beforeEach(() => {
    harness.setRow(freshRow());
  });

  it("marks status terminal", async () => {
    expect(await endSession("s1", "u1", "done")).toBe(true);
    expect(harness.s.row!.status).toBe("done");
  });

  it("accepts failed / abandoned too", async () => {
    expect(await endSession("s1", "u1", "failed")).toBe(true);
    expect(harness.s.row!.status).toBe("failed");
    expect(await endSession("s1", "u1", "abandoned")).toBe(true);
    expect(harness.s.row!.status).toBe("abandoned");
  });
});

describe("listOpenSessions", () => {
  it("returns rows when present", async () => {
    harness.setRow(freshRow());
    const rows = await listOpenSessions("u1");
    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe("s1");
  });

  it("returns empty when userId is missing", async () => {
    expect(await listOpenSessions("")).toEqual([]);
  });
});
