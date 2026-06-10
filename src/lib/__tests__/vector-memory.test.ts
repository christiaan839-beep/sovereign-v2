/**
 * Tests for src/lib/vector-memory.ts — BACKLOG H2 (per-user write cap)
 * + invariant #7 (anon-namespace refusal at the primitive level).
 *
 * The Drizzle db is mocked at `execute`; queries are classified by
 * inspecting the serialized sql`` template. getNimKey is mocked to
 * null so storeMemory takes the no-embedding insert path and never
 * touches the network.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const executeCalls: Array<{ kind: string; text: string }> = [];
let countResult = 0;
let countThrows = false;

function classify(text: string): string {
  if (text.includes("CREATE EXTENSION")) return "create-extension";
  if (text.includes("CREATE TABLE")) return "create-table";
  if (text.includes("CREATE INDEX")) return "create-index";
  if (text.includes("count(*)")) return "count";
  if (text.includes("DELETE FROM agent_memories")) return "delete";
  if (text.includes("INSERT INTO agent_memories")) return "insert";
  if (text.includes("SELECT")) return "select";
  return "other";
}

vi.mock("@/db", () => ({
  db: {
    execute: vi.fn(async (query: unknown) => {
      const text = JSON.stringify(query);
      const kind = classify(text);
      executeCalls.push({ kind, text });
      if (kind === "count") {
        if (countThrows) throw new Error("count blew up");
        return { rows: [{ n: countResult }] };
      }
      return { rows: [] };
    }),
  },
}));

vi.mock("@/lib/nvidia", () => ({
  getNimKey: vi.fn(async () => null),
}));

import { storeMemory, searchMemory } from "@/lib/vector-memory";

beforeEach(() => {
  executeCalls.length = 0;
  countResult = 0;
  countThrows = false;
  vi.unstubAllEnvs();
});

const kinds = () => executeCalls.map((c) => c.kind);
const nonSetupKinds = () => kinds().filter((k) => !k.startsWith("create-"));

describe("invariant #7 — anon refusal at the primitive", () => {
  it("storeMemory refuses anon and empty userId without touching the DB", async () => {
    expect(await storeMemory("anon", "agent", "content")).toBe(false);
    expect(await storeMemory("", "agent", "content")).toBe(false);
    expect(executeCalls).toHaveLength(0);
  });

  it("searchMemory refuses anon and empty userId without touching the DB", async () => {
    expect(await searchMemory("anon", "query")).toEqual([]);
    expect(await searchMemory("", "query")).toEqual([]);
    expect(executeCalls).toHaveLength(0);
  });
});

describe("H2 — per-user write cap", () => {
  it("under the cap: counts then inserts, never deletes", async () => {
    countResult = 42;
    expect(await storeMemory("user_1", "agent", "hello")).toBe(true);
    expect(nonSetupKinds()).toEqual(["count", "insert"]);
  });

  it("at the cap: prunes exactly one slot before inserting", async () => {
    countResult = 10_000;
    expect(await storeMemory("user_1", "agent", "hello")).toBe(true);
    expect(nonSetupKinds()).toEqual(["count", "delete", "insert"]);
    const del = executeCalls.find((c) => c.kind === "delete");
    // LIMIT param = count - cap + 1 = 1
    expect(del?.text).toContain("1");
  });

  it("over the cap (concurrent-writer drift): prunes the overshoot too", async () => {
    countResult = 10_050;
    expect(await storeMemory("user_1", "agent", "hello")).toBe(true);
    expect(nonSetupKinds()).toEqual(["count", "delete", "insert"]);
    const del = executeCalls.find((c) => c.kind === "delete");
    // LIMIT param = 10050 - 10000 + 1 = 51
    expect(del?.text).toContain("51");
  });

  it("fail-open: a count error never blocks the write", async () => {
    countThrows = true;
    expect(await storeMemory("user_1", "agent", "hello")).toBe(true);
    expect(nonSetupKinds()).toEqual(["count", "insert"]);
  });

  it("MEMORY_MAX_ROWS_PER_USER env override lowers the cap", async () => {
    vi.stubEnv("MEMORY_MAX_ROWS_PER_USER", "100");
    countResult = 100;
    expect(await storeMemory("user_1", "agent", "hello")).toBe(true);
    expect(nonSetupKinds()).toEqual(["count", "delete", "insert"]);
  });

  it("nonsense env override falls back to the 10K default", async () => {
    vi.stubEnv("MEMORY_MAX_ROWS_PER_USER", "banana");
    countResult = 9_999;
    expect(await storeMemory("user_1", "agent", "hello")).toBe(true);
    expect(nonSetupKinds()).toEqual(["count", "insert"]);
  });

  it("sub-floor env override (<100) is rejected, default applies", async () => {
    vi.stubEnv("MEMORY_MAX_ROWS_PER_USER", "5");
    countResult = 50;
    expect(await storeMemory("user_1", "agent", "hello")).toBe(true);
    expect(nonSetupKinds()).toEqual(["count", "insert"]);
  });
});
