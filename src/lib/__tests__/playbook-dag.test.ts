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
