/**
 * run-cost-actual — tests.
 *
 * Verifies the kind classification (actual/estimated/mixed) and the
 * cents arithmetic. The math doesn't have to match exact provider
 * rates — what matters is:
 *   - "actual" only when EVERY scoring node had _meta.tokenBudget
 *   - "estimated" only when NONE did
 *   - "mixed" when some did, some didn't
 *   - Skipped nodes don't count toward either bucket
 *   - Total is monotonic in inputs (no double-counting)
 */

import { describe, it, expect } from "vitest";
import { computeRunCostBreakdown } from "../run-cost-actual";
import type { NodeRunResult, PlaybookDag } from "../playbook-dag";

const fakeDag: PlaybookDag = {
  nodes: [
    { id: "n1", agent: "leads", position: { x: 0, y: 0 }, config: {} },
    { id: "n2", agent: "consensus", position: { x: 100, y: 0 }, config: {} },
  ],
  edges: [],
};

function withMeta(pctUsed: number, model = "claude-sonnet"): unknown {
  return {
    success: true,
    _meta: {
      tokenBudget: {
        pctUsed,
        softWarning: false,
        limit: 10_000,
        model,
        plan: "growth",
      },
    },
  };
}

describe("computeRunCostBreakdown — kind classification", () => {
  it("returns 'actual' when every completed node has tokenBudget meta", () => {
    const results: NodeRunResult[] = [
      { nodeId: "n1", agent: "leads", status: "completed", output: withMeta(20), durationMs: 100 },
      { nodeId: "n2", agent: "consensus", status: "completed", output: withMeta(30), durationMs: 200 },
    ];
    const r = computeRunCostBreakdown({ results, dagSnapshot: fakeDag });
    expect(r.kind).toBe("actual");
    expect(r.actualNodeCount).toBe(2);
    expect(r.estimatedNodeCount).toBe(0);
    expect(r.totalCents).toBeGreaterThan(0);
  });

  it("returns 'estimated' when no node has tokenBudget meta", () => {
    const results: NodeRunResult[] = [
      // Plain output with no _meta — falls through to band-based estimate.
      { nodeId: "n1", agent: "leads", status: "completed", output: { plain: true }, durationMs: 100 },
      { nodeId: "n2", agent: "consensus", status: "completed", output: { plain: true }, durationMs: 200 },
    ];
    const r = computeRunCostBreakdown({ results, dagSnapshot: fakeDag });
    expect(r.kind).toBe("estimated");
    expect(r.actualNodeCount).toBe(0);
    expect(r.estimatedNodeCount).toBe(2);
  });

  it("returns 'mixed' when some nodes have meta and some don't", () => {
    const results: NodeRunResult[] = [
      { nodeId: "n1", agent: "leads", status: "completed", output: withMeta(20), durationMs: 100 },
      { nodeId: "n2", agent: "consensus", status: "completed", output: { plain: true }, durationMs: 200 },
    ];
    const r = computeRunCostBreakdown({ results, dagSnapshot: fakeDag });
    expect(r.kind).toBe("mixed");
    expect(r.actualNodeCount).toBe(1);
    expect(r.estimatedNodeCount).toBe(1);
  });

  it("does not count skipped nodes toward either bucket", () => {
    const results: NodeRunResult[] = [
      { nodeId: "n1", agent: "leads", status: "completed", output: withMeta(20), durationMs: 100 },
      { nodeId: "n2", agent: "consensus", status: "skipped", durationMs: 0 },
    ];
    const r = computeRunCostBreakdown({ results, dagSnapshot: fakeDag });
    expect(r.kind).toBe("actual");
    expect(r.skippedNodeCount).toBe(1);
    expect(r.actualNodeCount).toBe(1);
    expect(r.estimatedNodeCount).toBe(0);
  });
});

describe("computeRunCostBreakdown — cents arithmetic", () => {
  it("zero-token usage returns zero cents (no spurious charge)", () => {
    const results: NodeRunResult[] = [
      { nodeId: "n1", agent: "leads", status: "completed", output: withMeta(0), durationMs: 50 },
    ];
    const r = computeRunCostBreakdown({ results, dagSnapshot: fakeDag });
    expect(r.totalCents).toBe(0);
    expect(r.kind).toBe("actual");
  });

  it("monotonically increases with token usage", () => {
    const small = computeRunCostBreakdown({
      results: [
        { nodeId: "n1", agent: "leads", status: "completed", output: withMeta(10), durationMs: 50 },
      ],
      dagSnapshot: fakeDag,
    });
    const large = computeRunCostBreakdown({
      results: [
        { nodeId: "n1", agent: "leads", status: "completed", output: withMeta(90), durationMs: 50 },
      ],
      dagSnapshot: fakeDag,
    });
    expect(large.totalCents).toBeGreaterThanOrEqual(small.totalCents);
  });

  it("never throws on hostile inputs", () => {
    expect(() =>
      computeRunCostBreakdown({
        results: [],
        dagSnapshot: { nodes: [], edges: [] },
      }),
    ).not.toThrow();

    // Output that throws when Object.keys'd — Symbol case
    const wackyOutput: unknown = { _meta: { tokenBudget: "garbage" } };
    expect(() =>
      computeRunCostBreakdown({
        results: [
          {
            nodeId: "n1",
            agent: "leads",
            status: "completed",
            output: wackyOutput,
            durationMs: 50,
          },
        ],
        dagSnapshot: fakeDag,
      }),
    ).not.toThrow();
  });
});

describe("computeRunCostBreakdown — perNode shape", () => {
  it("tags each row with the right source", () => {
    const results: NodeRunResult[] = [
      { nodeId: "a", agent: "x", status: "completed", output: withMeta(50), durationMs: 100 },
      { nodeId: "b", agent: "y", status: "completed", output: { plain: true }, durationMs: 100 },
      { nodeId: "c", agent: "z", status: "skipped", durationMs: 0 },
    ];
    const r = computeRunCostBreakdown({
      results,
      dagSnapshot: {
        nodes: [
          { id: "a", agent: "x", position: { x: 0, y: 0 }, config: {} },
          { id: "b", agent: "y", position: { x: 0, y: 0 }, config: {} },
          { id: "c", agent: "z", position: { x: 0, y: 0 }, config: {} },
        ],
        edges: [],
      },
    });
    expect(r.perNode[0].source).toBe("actual");
    expect(r.perNode[1].source).toBe("estimated");
    expect(r.perNode[2].source).toBe("skipped");
    expect(r.perNode[2].cents).toBeNull();
  });
});
