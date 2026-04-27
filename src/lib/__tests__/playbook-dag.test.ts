import { describe, it, expect } from "vitest";
import { topoSort, dryRun, type PlaybookDag } from "@/lib/playbook-dag";

const linear: PlaybookDag = {
  nodes: [
    { id: "a", agent: "leads", position: { x: 0, y: 0 }, config: { count: 10 } },
    { id: "b", agent: "outreach-personalizer", position: { x: 200, y: 0 }, config: {} },
  ],
  edges: [{ from: "a.leads", to: "b.target" }],
};

const branch: PlaybookDag = {
  nodes: [
    { id: "a", agent: "leads", position: { x: 0, y: 0 }, config: { count: 5 } },
    { id: "b", agent: "outreach-personalizer", position: { x: 200, y: 0 }, config: {} },
    { id: "c", agent: "abm-artillery", position: { x: 200, y: 100 }, config: {} },
  ],
  edges: [
    { from: "a.leads", to: "b.target" },
    { from: "a.leads", to: "c.target" },
  ],
};

const cyclic: PlaybookDag = {
  nodes: [
    { id: "a", agent: "leads", position: { x: 0, y: 0 }, config: {} },
    { id: "b", agent: "blog-gen", position: { x: 200, y: 0 }, config: {} },
  ],
  edges: [
    { from: "a.out", to: "b.in" },
    { from: "b.out", to: "a.in" },
  ],
};

describe("playbook-dag · topoSort", () => {
  it("returns linear order for a chain", () => {
    const r = topoSort(linear);
    expect(r.order).toEqual(["a", "b"]);
    expect(r.cycle).toBeNull();
  });

  it("orders branch correctly (a before b and c)", () => {
    const r = topoSort(branch);
    expect(r.order?.[0]).toBe("a");
    expect(r.order?.slice(1).sort()).toEqual(["b", "c"]);
  });

  it("detects cycles", () => {
    const r = topoSort(cyclic);
    expect(r.order).toBeNull();
    expect(r.cycle).not.toBeNull();
    expect(r.cycle!.sort()).toEqual(["a", "b"]);
  });

  it("handles empty DAG", () => {
    expect(topoSort({ nodes: [], edges: [] }).order).toEqual([]);
  });

  it("handles single isolated node", () => {
    const r = topoSort({
      nodes: [{ id: "solo", agent: "leads", position: { x: 0, y: 0 }, config: {} }],
      edges: [],
    });
    expect(r.order).toEqual(["solo"]);
  });
});

describe("playbook-dag · dryRun", () => {
  it("flags missing required fields", () => {
    const r = dryRun(linear, { leads: ["count"], "outreach-personalizer": ["template", "target"] });
    // node b is missing `template` (target is wired from edge).
    expect(r.missingFields).toContainEqual({
      nodeId: "b",
      field: "template",
    });
    expect(r.valid).toBe(false);
  });

  it("valid when every required field is wired", () => {
    const r = dryRun(linear, {
      leads: ["count"],
      "outreach-personalizer": ["target"],
    });
    expect(r.missingFields).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it("returns no order when DAG is cyclic", () => {
    const r = dryRun(cyclic, {});
    expect(r.executionOrder).toEqual([]);
    expect(r.cycle).not.toBeNull();
    expect(r.valid).toBe(false);
  });

  it("estimatedKtokens scales with node count", () => {
    expect(dryRun(linear, {}).estimatedKtokens).toBe(4); // 2 nodes * 2
    expect(dryRun(branch, {}).estimatedKtokens).toBe(6);
  });
});

import { resolvePlaceholders, executeDag } from "@/lib/playbook-dag";

describe("playbook-dag · resolvePlaceholders", () => {
  it("passes through literal values unchanged", () => {
    const r = resolvePlaceholders({ a: 1, b: "hello" }, {});
    expect(r).toEqual({ a: 1, b: "hello" });
  });

  it("substitutes $.<nodeId> with the full upstream output", () => {
    const r = resolvePlaceholders({ x: "$.n1" }, { n1: { foo: 42 } });
    expect(r.x).toEqual({ foo: 42 });
  });

  it("substitutes $.<nodeId>.<path>", () => {
    const r = resolvePlaceholders(
      { x: "$.n1.foo.bar" },
      { n1: { foo: { bar: "deep" } } },
    );
    expect(r.x).toBe("deep");
  });

  it("returns null when the upstream node hasn't run", () => {
    const r = resolvePlaceholders({ x: "$.n_missing" }, {});
    expect(r.x).toBeNull();
  });

  it("returns null when the path doesn't exist on the upstream output", () => {
    const r = resolvePlaceholders(
      { x: "$.n1.missing.path" },
      { n1: { other: 1 } },
    );
    expect(r.x).toBeNull();
  });
});

describe("playbook-dag · executeDag", () => {
  const linearDag = {
    nodes: [
      { id: "a", agent: "leads", position: { x: 0, y: 0 }, config: { count: 5 } },
      { id: "b", agent: "outreach", position: { x: 200, y: 0 }, config: { input: "$.a" } },
    ],
    edges: [{ from: "a.out", to: "b.input" }],
  };

  it("walks the topo order and threads outputs through placeholders", async () => {
    const calls: string[] = [];
    const runner = async (slug: string, input: Record<string, unknown>) => {
      calls.push(slug);
      if (slug === "leads") return { leads: ["a@example.com", "b@example.com"] };
      return { processed: input.input };
    };
    const r = await executeDag(linearDag, runner);
    expect(r.status).toBe("completed");
    expect(calls).toEqual(["leads", "outreach"]);
    expect(r.results).toHaveLength(2);
    const second = r.results[1];
    expect(second.status).toBe("completed");
    if (second.status === "completed") {
      expect(second.output).toEqual({ processed: { leads: ["a@example.com", "b@example.com"] } });
    }
  });

  it("stops on first failure by default", async () => {
    const runner = async (slug: string) => {
      if (slug === "leads") throw new Error("provider down");
      return { ok: true };
    };
    const r = await executeDag(linearDag, runner);
    expect(r.status).toBe("failed");
    expect(r.failedAt).toBe("a");
    expect(r.results[1].status).toBe("skipped");
  });

  it("continues with continueOnError + downstream sees null upstream", async () => {
    const runner = async (slug: string) => {
      if (slug === "leads") throw new Error("provider down");
      return { ok: true };
    };
    const r = await executeDag(linearDag, runner, { continueOnError: true });
    expect(r.status).toBe("failed");
    expect(r.results[1].status).toBe("completed");
  });

  it("returns status:failed when the DAG has a cycle (no execution attempted)", async () => {
    const runner = async () => ({ never: "called" });
    const cyclicDag = {
      nodes: [
        { id: "a", agent: "leads", position: { x: 0, y: 0 }, config: {} },
        { id: "b", agent: "blog-gen", position: { x: 0, y: 0 }, config: {} },
      ],
      edges: [
        { from: "a.out", to: "b.in" },
        { from: "b.out", to: "a.in" },
      ],
    };
    const r = await executeDag(cyclicDag, runner);
    expect(r.status).toBe("failed");
    expect(r.results).toEqual([]);
    expect(r.failedAt).toBeDefined();
  });

  // ─── Round 12: onProgress callback ─────────────────────────────
  it("calls onProgress after each node reaches a terminal state (3 nodes → 3 calls)", async () => {
    const calls: Array<{ count: number; nodeIds: string[] }> = [];
    const runner = async () => ({ ok: true });
    await executeDag(linear, runner, {
      onProgress: (results, completedCount) => {
        calls.push({
          count: completedCount,
          nodeIds: results.map((r) => r.nodeId),
        });
      },
    });
    // linear has 2 nodes; expect 2 progress calls, after each.
    expect(calls).toHaveLength(2);
    expect(calls[0].count).toBe(1);
    expect(calls[0].nodeIds).toEqual(["a"]);
    expect(calls[1].count).toBe(2);
    expect(calls[1].nodeIds).toEqual(["a", "b"]);
  });

  it("onProgress fires for skipped nodes too (so the polling client sees the final shape)", async () => {
    let calls = 0;
    const runner = async (slug: string) => {
      if (slug === "leads") throw new Error("boom");
      return {};
    };
    await executeDag(linear, runner, {
      onProgress: () => {
        calls += 1;
      },
    });
    // 1 failed + 1 skipped = 2 onProgress fires.
    expect(calls).toBe(2);
  });

  it("onProgress callback errors NEVER propagate (observation must not kill execution)", async () => {
    // The whole point of fail-open observability is that a transient
    // DB hiccup in updateRunProgress shouldn't drop the whole run.
    // We throw from onProgress and assert executeDag still returns
    // the full result.
    const runner = async () => ({ ok: true });
    const r = await executeDag(linear, runner, {
      onProgress: () => {
        throw new Error("DB down");
      },
    });
    expect(r.status).toBe("completed");
    expect(r.results).toHaveLength(2);
  });
});
