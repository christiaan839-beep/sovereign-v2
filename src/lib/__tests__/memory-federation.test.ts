/**
 * Tests for src/lib/memory-federation.ts — Wave 140.
 *
 * Pure-function tests on `planConsolidation` and `heuristicSummarise`.
 * DB-backed `federatedSearch` + `consolidateMemories` are smoke-tested
 * via the empty/anon paths since they need a live pgvector setup.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  planConsolidation,
  heuristicSummarise,
  federatedSearch,
  consolidateMemories,
} from "@/lib/memory-federation";

describe("planConsolidation", () => {
  function mk(
    id: string,
    agentName: string,
    content: string,
    metadata: Record<string, unknown> = {},
    createdAt = new Date().toISOString(),
  ) {
    return { id, agentName, content, metadata, createdAt };
  }

  it("returns empty groups when nothing reaches minPer", () => {
    const r = planConsolidation(
      [mk("1", "audit", "a"), mk("2", "audit", "b")],
      {
        minPerCluster: 4,
      },
    );
    expect(r.groups).toEqual([]);
    expect(r.totalCandidates).toBe(0);
  });

  it("groups by (agentName, metadata.kind)", () => {
    const r = planConsolidation(
      [
        mk("1", "audit", "a1", { kind: "X" }),
        mk("2", "audit", "a2", { kind: "X" }),
        mk("3", "audit", "a3", { kind: "X" }),
        mk("4", "audit", "a4", { kind: "X" }),
        mk("5", "audit", "b1", { kind: "Y" }),
        mk("6", "audit", "b2", { kind: "Y" }),
      ],
      { minPerCluster: 4 },
    );
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].ids).toEqual(["1", "2", "3", "4"]);
  });

  it("respects maxPerCluster cap", () => {
    const rows = [];
    for (let i = 0; i < 30; i++) {
      rows.push(mk(`id-${i}`, "audit", `c${i}`, { kind: "K" }));
    }
    const r = planConsolidation(rows, { minPerCluster: 4, maxPerCluster: 8 });
    expect(r.groups[0].ids).toHaveLength(8);
  });

  it("tracks oldest + newest dates per cluster", () => {
    const r = planConsolidation(
      [
        mk("1", "audit", "a", { kind: "X" }, "2026-01-01T00:00:00.000Z"),
        mk("2", "audit", "b", { kind: "X" }, "2026-01-10T00:00:00.000Z"),
        mk("3", "audit", "c", { kind: "X" }, "2026-01-05T00:00:00.000Z"),
        mk("4", "audit", "d", { kind: "X" }, "2026-01-08T00:00:00.000Z"),
      ],
      { minPerCluster: 4 },
    );
    expect(r.groups[0].oldestAt).toBe("2026-01-01T00:00:00.000Z");
    expect(r.groups[0].newestAt).toBe("2026-01-10T00:00:00.000Z");
  });

  it("falls back to agentName when no metadata.kind", () => {
    const r = planConsolidation(
      [
        mk("1", "audit", "a"),
        mk("2", "audit", "b"),
        mk("3", "audit", "c"),
        mk("4", "audit", "d"),
        mk("5", "blog-gen", "e"),
        mk("6", "blog-gen", "f"),
        mk("7", "blog-gen", "g"),
        mk("8", "blog-gen", "h"),
      ],
      { minPerCluster: 4 },
    );
    expect(r.groups).toHaveLength(2);
    const names = r.groups.map((g) => g.agentName).sort();
    expect(names).toEqual(["audit", "blog-gen"]);
  });

  it("combines content with separator", () => {
    const r = planConsolidation(
      [
        mk("1", "audit", "alpha"),
        mk("2", "audit", "beta"),
        mk("3", "audit", "gamma"),
        mk("4", "audit", "delta"),
      ],
      { minPerCluster: 4 },
    );
    expect(r.groups[0].combined).toBe("alpha · beta · gamma · delta");
  });
});

describe("heuristicSummarise", () => {
  it("returns input when ≤3 sentences", () => {
    expect(heuristicSummarise("Alpha words here are good")).toBe(
      "Alpha words here are good",
    );
  });

  it("keeps first sentence + diverse subsequent ones", () => {
    const combined =
      "Alpha cost optimization on vLLM endpoints is meaningful · " +
      "Alpha cost optimization on vLLM endpoints is meaningful again · " +
      "Beta retrieval pipeline ranks differently with diversity · " +
      "Gamma client onboarding requires welcome email sequence · " +
      "Delta blog content suggests four pillar topics monthly";
    const result = heuristicSummarise(combined);
    expect(result.split(" · ").length).toBeLessThanOrEqual(3);
    expect(result).toMatch(/Alpha/);
  });

  it("returns empty string for trivial input", () => {
    expect(heuristicSummarise("short")).toBe("");
  });

  it("never returns more than 3 sentences", () => {
    const combined = Array.from(
      { length: 10 },
      (_, i) =>
        `Sentence number ${i} with distinct words like alpha${i} beta${i} gamma${i}`,
    ).join(" · ");
    const result = heuristicSummarise(combined);
    expect(result.split(" · ").length).toBeLessThanOrEqual(3);
  });
});

describe("federatedSearch — guard paths", () => {
  it("returns [] for anon userId", async () => {
    expect(await federatedSearch("anon", "q", ["audit"])).toEqual([]);
  });

  it("returns [] for empty userId", async () => {
    expect(await federatedSearch("", "q", ["audit"])).toEqual([]);
  });

  it("returns [] for empty query", async () => {
    expect(await federatedSearch("u", "  ", ["audit"])).toEqual([]);
  });

  it("returns [] for empty allowlist", async () => {
    expect(await federatedSearch("u", "q", [])).toEqual([]);
  });

  it("returns [] when no agents pass type filter", async () => {
    expect(
      await federatedSearch("u", "q", [
        null as unknown as string,
        42 as unknown as string,
      ]),
    ).toEqual([]);
  });
});

describe("consolidateMemories — guard paths", () => {
  it("returns empty for anon user", async () => {
    const r = await consolidateMemories({ userId: "anon" });
    expect(r).toEqual({ clustersProcessed: 0, rowsRemoved: 0, rowsAdded: 0 });
  });

  it("returns empty for missing userId", async () => {
    const r = await consolidateMemories({ userId: "" });
    expect(r).toEqual({ clustersProcessed: 0, rowsRemoved: 0, rowsAdded: 0 });
  });
});
