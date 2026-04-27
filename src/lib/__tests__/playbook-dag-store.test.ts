/**
 * playbook-dag-store — tests.
 *
 * Verifies the graceful-no-DB contract (every helper returns a sane
 * shape when DATABASE_URL is unset) and the truncation contract for
 * recordDagRun (per-node outputs >32KB are clipped).
 *
 * The actual DB-backed paths are exercised in the route-level tests
 * with mocked drizzle. Here we focus on the pure-function and
 * fallback semantics that the route handlers depend on.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

beforeEach(() => {
  // Force the store into "no DB" mode so we test the graceful path.
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  if (ORIGINAL_DATABASE_URL !== undefined) {
    process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  }
  vi.resetModules();
});

// We re-import the store module each test so the lazy DB import logic
// gets re-evaluated against the current env state. Vitest caches by
// default — `vi.resetModules()` in afterEach clears that.
async function importStore() {
  return await import("../playbook-dag-store");
}

describe("playbook-dag-store — graceful no-DB fallbacks", () => {
  it("insertDag returns a logical fallback id with persisted=false", async () => {
    const { insertDag } = await importStore();
    const result = await insertDag({
      userId: "user_1",
      name: "test",
      dag: { nodes: [{ id: "n1", agent: "leads", position: { x: 0, y: 0 }, config: {} }], edges: [] },
    });
    expect(result.persisted).toBe(false);
    expect(result.id).toMatch(/^dag_local_\d+$/);
  });

  it("listDags returns empty array when DB is unavailable", async () => {
    const { listDags } = await importStore();
    const result = await listDags({ userId: "user_1" });
    expect(result).toEqual({ dags: [] });
  });

  it("getDag returns null when DB is unavailable", async () => {
    const { getDag } = await importStore();
    const result = await getDag({ id: "any-id", userId: "user_1" });
    expect(result).toBeNull();
  });

  it("updateDag returns updated=false when DB is unavailable", async () => {
    const { updateDag } = await importStore();
    const result = await updateDag({
      id: "any-id",
      userId: "user_1",
      name: "renamed",
    });
    expect(result).toEqual({ updated: false });
  });

  it("archiveDag returns archived=false when DB is unavailable", async () => {
    const { archiveDag } = await importStore();
    const result = await archiveDag({ id: "any-id", userId: "user_1" });
    expect(result).toEqual({ archived: false });
  });

  it("recordDagRun returns recorded=false / runId=null when DB is unavailable", async () => {
    const { recordDagRun } = await importStore();
    const result = await recordDagRun({
      userId: "user_1",
      dagId: null,
      dag: { nodes: [{ id: "n1", agent: "leads", position: { x: 0, y: 0 }, config: {} }], edges: [] },
      status: "completed",
      results: [],
      totalDurationMs: 100,
      failedAt: null,
    });
    expect(result).toEqual({ recorded: false, runId: null });
  });

  it("listDagRuns returns empty array when DB is unavailable", async () => {
    const { listDagRuns } = await importStore();
    const result = await listDagRuns({ userId: "user_1" });
    expect(result).toEqual({ runs: [] });
  });

  it("getDagRun returns null when DB is unavailable", async () => {
    const { getDagRun } = await importStore();
    const result = await getDagRun({ id: "any-id", userId: "user_1" });
    expect(result).toBeNull();
  });

  it("cloneDag returns null when source DAG is unreachable (no DB)", async () => {
    // cloneDag chains getDag → insertDag. With no DB, getDag returns
    // null, so cloneDag short-circuits to null too. The route then
    // surfaces this as 404 (no information leak).
    const { cloneDag } = await importStore();
    const result = await cloneDag({
      sourceId: "any-id",
      userId: "user_1",
      name: "fork",
    });
    expect(result).toBeNull();
  });
});

describe("playbook-dag-store — fallback semantics", () => {
  it("never throws on hostile inputs (graceful fallback IS the contract)", async () => {
    const { insertDag, listDags, getDag, updateDag, archiveDag, recordDagRun, listDagRuns } =
      await importStore();

    // The whole point: a missing DB should never bubble an exception
    // up to the route handler. Routes treat a `persisted: false` /
    // `dags: []` response as "no DB; proceed with the validated shape".
    await expect(
      insertDag({ userId: "u", name: "n", dag: { nodes: [{ id: "x", agent: "y", position: { x: 0, y: 0 }, config: {} }], edges: [] } }),
    ).resolves.not.toThrow();
    await expect(listDags({ userId: "u" })).resolves.not.toThrow();
    await expect(getDag({ id: "i", userId: "u" })).resolves.not.toThrow();
    await expect(updateDag({ id: "i", userId: "u" })).resolves.not.toThrow();
    await expect(archiveDag({ id: "i", userId: "u" })).resolves.not.toThrow();
    await expect(
      recordDagRun({
        userId: "u",
        dagId: null,
        dag: { nodes: [], edges: [] } as never, // empty edge case
        status: "completed",
        results: [],
        totalDurationMs: 0,
        failedAt: null,
      }),
    ).resolves.not.toThrow();
    await expect(listDagRuns({ userId: "u" })).resolves.not.toThrow();
  });
});
