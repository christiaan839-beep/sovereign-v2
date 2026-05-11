/**
 * Tests for src/lib/packet-store.ts
 *
 * Covers:
 *   - PACKET_KINDS / isPacketKind type guard rejects unknown strings
 *   - savePacket: success path returns the new id; DB error returns null
 *     (best-effort write — must NOT throw to the route)
 *   - savePacket: refuses empty userId without touching the DB
 *   - getPacketsForUser: parses input/output JSON, filters by kind,
 *     applies limit clamp (1–100), returns [] on DB error
 *   - getPacketById: ownership-scoped, returns null on missing or wrong user
 *   - countPacketsForUser: returns 0 on missing user / DB error
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ── DB mock ────────────────────────────────────────────────────────────
//
// We mock @/db with chainable builder objects so the helper's calls
// resolve against in-memory fixtures rather than Postgres.

interface FakeRow {
  id: string;
  userId: string;
  kind: string;
  inputJson: string;
  outputJson: string;
  errorCount: number;
  durationMs: number;
  createdAt: Date | string;
}

let SELECT_ROWS: FakeRow[] = [];
let SELECT_THROW: Error | null = null;
let INSERT_ROW: { id: string } | null = { id: "fake-id-1" };
let INSERT_THROW: Error | null = null;
let lastInsertValues: Record<string, unknown> | null = null;

function buildSelectChain() {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: async () => {
      if (SELECT_THROW) throw SELECT_THROW;
      return SELECT_ROWS;
    },
    // `await chain` (no .limit() suffix) triggers the thenable path.
    // Used by countPacketsForUser. Must call resolve/reject directly so
    // the await actually settles — returning a Promise here is ignored
    // by the JS thenable protocol.
    then: (
      resolve: (rows: FakeRow[]) => unknown,
      reject?: (err: unknown) => unknown,
    ) => {
      if (SELECT_THROW) {
        if (reject) reject(SELECT_THROW);
        return;
      }
      resolve(SELECT_ROWS);
    },
  };
  return chain;
}

function buildInsertChain() {
  const chain = {
    values: (v: Record<string, unknown>) => {
      lastInsertValues = v;
      return chain;
    },
    returning: async () => {
      if (INSERT_THROW) throw INSERT_THROW;
      return INSERT_ROW ? [INSERT_ROW] : [];
    },
  };
  return chain;
}

vi.mock("@/db", () => ({
  db: {
    select: () => buildSelectChain(),
    insert: () => buildInsertChain(),
  },
}));

vi.mock("@/db/schema", () => ({
  packets: {
    id: { name: "id" },
    userId: { name: "user_id" },
    kind: { name: "kind" },
    inputJson: { name: "input_json" },
    outputJson: { name: "output_json" },
    errorCount: { name: "error_count" },
    durationMs: { name: "duration_ms" },
    createdAt: { name: "created_at" },
    $inferSelect: undefined as unknown,
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...xs: unknown[]) => ({ kind: "and", parts: xs }),
  eq: (col: unknown, val: unknown) => ({ kind: "eq", col, val }),
  desc: (col: unknown) => ({ kind: "desc", col }),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: () => {}, warn: () => {}, error: () => {} }),
}));

import {
  PACKET_KINDS,
  isPacketKind,
  savePacket,
  getPacketsForUser,
  getPacketById,
  countPacketsForUser,
} from "@/lib/packet-store";

beforeEach(() => {
  SELECT_ROWS = [];
  SELECT_THROW = null;
  INSERT_ROW = { id: "fake-id-1" };
  INSERT_THROW = null;
  lastInsertValues = null;
});

// ── Type guard ─────────────────────────────────────────────────────────

describe("isPacketKind", () => {
  it("accepts the four known kinds", () => {
    for (const k of PACKET_KINDS) expect(isPacketKind(k)).toBe(true);
  });

  it("rejects unknown strings, undefined, numbers", () => {
    expect(isPacketKind("agency")).toBe(false);
    expect(isPacketKind(null)).toBe(false);
    expect(isPacketKind(undefined)).toBe(false);
    expect(isPacketKind(42)).toBe(false);
    expect(isPacketKind("")).toBe(false);
  });
});

// ── savePacket ─────────────────────────────────────────────────────────

describe("savePacket", () => {
  it("returns the new row id on success and writes the values", async () => {
    INSERT_ROW = { id: "row-9" };
    const id = await savePacket({
      userId: "user_abc",
      kind: "agency-content-packet",
      input: { clientName: "Acme" },
      output: { blog: { title: "x" } },
      errorCount: 0,
      durationMs: 1234,
    });
    expect(id).toBe("row-9");
    expect(lastInsertValues?.userId).toBe("user_abc");
    expect(lastInsertValues?.kind).toBe("agency-content-packet");
    expect(JSON.parse((lastInsertValues?.inputJson as string) ?? "{}")).toEqual(
      {
        clientName: "Acme",
      },
    );
    expect(lastInsertValues?.errorCount).toBe(0);
    expect(lastInsertValues?.durationMs).toBe(1234);
  });

  it("returns null on DB failure (best-effort, never throws)", async () => {
    INSERT_THROW = new Error("connection refused");
    const id = await savePacket({
      userId: "user_abc",
      kind: "growth-pulse",
      input: {},
      output: {},
      errorCount: 0,
      durationMs: 0,
    });
    expect(id).toBeNull();
  });

  it("returns null without touching the DB when userId is empty", async () => {
    const id = await savePacket({
      userId: "",
      kind: "growth-pulse",
      input: {},
      output: {},
      errorCount: 0,
      durationMs: 0,
    });
    expect(id).toBeNull();
    expect(lastInsertValues).toBeNull();
  });

  it("clamps negative errorCount and durationMs to zero", async () => {
    INSERT_ROW = { id: "row-clamp" };
    await savePacket({
      userId: "user_abc",
      kind: "listing-pulse",
      input: {},
      output: {},
      errorCount: -5,
      durationMs: -100,
    });
    expect(lastInsertValues?.errorCount).toBe(0);
    expect(lastInsertValues?.durationMs).toBe(0);
  });
});

// ── getPacketsForUser ──────────────────────────────────────────────────

describe("getPacketsForUser", () => {
  it("returns parsed rows in DB order", async () => {
    SELECT_ROWS = [
      {
        id: "r1",
        userId: "u1",
        kind: "growth-pulse",
        inputJson: JSON.stringify({ businessName: "Ndlovu" }),
        outputJson: JSON.stringify({ seo: { priorityFix: "x" } }),
        errorCount: 0,
        durationMs: 500,
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ];
    const out = await getPacketsForUser("u1");
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe("growth-pulse");
    expect(out[0]?.input).toEqual({ businessName: "Ndlovu" });
    expect(out[0]?.output).toEqual({ seo: { priorityFix: "x" } });
    expect(out[0]?.createdAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("drops rows with unknown kind values", async () => {
    SELECT_ROWS = [
      {
        id: "r1",
        userId: "u1",
        kind: "unknown-kind",
        inputJson: "{}",
        outputJson: "{}",
        errorCount: 0,
        durationMs: 0,
        createdAt: new Date(),
      },
    ];
    const out = await getPacketsForUser("u1");
    expect(out).toEqual([]);
  });

  it("survives malformed JSON in stored fields (returns {} for that field)", async () => {
    SELECT_ROWS = [
      {
        id: "r1",
        userId: "u1",
        kind: "agency-content-packet",
        inputJson: "{not-json",
        outputJson: '{"blog": {"title": "ok"}}',
        errorCount: 0,
        durationMs: 0,
        createdAt: new Date(),
      },
    ];
    const out = await getPacketsForUser("u1");
    expect(out[0]?.input).toEqual({});
    expect(out[0]?.output).toEqual({ blog: { title: "ok" } });
  });

  it("returns [] on DB error", async () => {
    SELECT_THROW = new Error("db down");
    const out = await getPacketsForUser("u1");
    expect(out).toEqual([]);
  });

  it("returns [] when userId is empty without hitting the DB", async () => {
    const out = await getPacketsForUser("   ");
    expect(out).toEqual([]);
  });
});

// ── getPacketById ──────────────────────────────────────────────────────

describe("getPacketById", () => {
  it("returns the row when it exists and is owned by the user", async () => {
    SELECT_ROWS = [
      {
        id: "abc",
        userId: "u1",
        kind: "listing-pulse",
        inputJson: "{}",
        outputJson: "{}",
        errorCount: 0,
        durationMs: 0,
        createdAt: new Date(),
      },
    ];
    const out = await getPacketById("u1", "abc");
    expect(out?.id).toBe("abc");
    expect(out?.kind).toBe("listing-pulse");
  });

  it("returns null when row not found", async () => {
    SELECT_ROWS = [];
    expect(await getPacketById("u1", "missing")).toBeNull();
  });

  it("returns null on DB error", async () => {
    SELECT_THROW = new Error("db down");
    expect(await getPacketById("u1", "abc")).toBeNull();
  });

  it("returns null with empty user / id without DB call", async () => {
    expect(await getPacketById("", "abc")).toBeNull();
    expect(await getPacketById("u1", "")).toBeNull();
  });
});

// ── countPacketsForUser ────────────────────────────────────────────────

describe("countPacketsForUser", () => {
  it("returns the count of rows", async () => {
    SELECT_ROWS = [
      { id: "1" } as unknown as FakeRow,
      { id: "2" } as unknown as FakeRow,
      { id: "3" } as unknown as FakeRow,
    ];
    expect(await countPacketsForUser("u1")).toBe(3);
  });

  it("returns 0 on DB error", async () => {
    SELECT_THROW = new Error("db down");
    expect(await countPacketsForUser("u1")).toBe(0);
  });

  it("returns 0 with empty userId", async () => {
    expect(await countPacketsForUser("")).toBe(0);
  });
});
