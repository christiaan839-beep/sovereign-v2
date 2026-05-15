/**
 * Tests for src/lib/workflow-builder.ts — Cook 66.
 *
 *   - validate: no-start / multiple-starts / no-end / cycle / dangling-edge
 *     / orphan-node / agent-missing-slug / branch-missing-predicate
 *     / branch-missing-arm
 *   - compile: returns runnable WorkflowStep for a linear graph + branch.
 */

import { describe, it, expect } from "vitest";
import { validate, compile, type WorkflowGraph } from "../workflow-builder";

function linearGraph(): WorkflowGraph {
  return {
    nodes: [
      { id: "n-start", kind: "start", label: "Start" },
      { id: "n-a", kind: "agent", label: "A", agentSlug: "lead-blitz" },
      { id: "n-b", kind: "agent", label: "B", agentSlug: "content" },
      { id: "n-end", kind: "end", label: "End" },
    ],
    edges: [
      { id: "e1", from: "n-start", to: "n-a" },
      { id: "e2", from: "n-a", to: "n-b" },
      { id: "e3", from: "n-b", to: "n-end" },
    ],
  };
}

describe("validate — happy path", () => {
  it("accepts a clean linear graph", () => {
    const v = validate(linearGraph());
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
  });
});

describe("validate — structural errors", () => {
  it("reports no-start when start node missing", () => {
    const g = linearGraph();
    g.nodes = g.nodes.filter((n) => n.kind !== "start");
    const v = validate(g);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.code === "no-start")).toBe(true);
  });

  it("reports multiple-starts when more than one start node", () => {
    const g = linearGraph();
    g.nodes.push({ id: "n-start2", kind: "start", label: "Start 2" });
    const v = validate(g);
    expect(v.errors.some((e) => e.code === "multiple-starts")).toBe(true);
  });

  it("warns about no-end when no end node present", () => {
    const g = linearGraph();
    g.nodes = g.nodes.filter((n) => n.kind !== "end");
    const v = validate(g);
    expect(v.warnings.some((w) => w.code === "no-end")).toBe(true);
  });

  it("reports dangling-edge when edge references a missing node", () => {
    const g = linearGraph();
    g.edges.push({ id: "dangle", from: "n-a", to: "ghost" });
    const v = validate(g);
    expect(v.errors.some((e) => e.code === "dangling-edge")).toBe(true);
  });

  it("reports cycle-detected on a back edge", () => {
    const g = linearGraph();
    g.edges.push({ id: "back", from: "n-b", to: "n-a" });
    const v = validate(g);
    expect(v.errors.some((e) => e.code === "cycle-detected")).toBe(true);
  });

  it("warns about orphan-node", () => {
    const g = linearGraph();
    g.nodes.push({
      id: "n-orphan",
      kind: "agent",
      label: "Orphan",
      agentSlug: "x",
    });
    const v = validate(g);
    expect(v.warnings.some((w) => w.code === "orphan-node")).toBe(true);
  });

  it("reports agent-missing-slug", () => {
    const g = linearGraph();
    g.nodes[1] = { ...g.nodes[1], agentSlug: undefined };
    const v = validate(g);
    expect(v.errors.some((e) => e.code === "agent-missing-slug")).toBe(true);
  });

  it("reports branch-missing-predicate", () => {
    const g: WorkflowGraph = {
      nodes: [
        { id: "start", kind: "start", label: "S" },
        { id: "br", kind: "branch", label: "B" }, // no predicate
        { id: "end", kind: "end", label: "E" },
      ],
      edges: [
        { id: "e1", from: "start", to: "br" },
        { id: "e2", from: "br", to: "end", armLabel: "default" },
      ],
    };
    const v = validate(g);
    expect(v.errors.some((e) => e.code === "branch-missing-predicate")).toBe(
      true,
    );
  });

  it("reports branch-missing-arm on an unlabeled edge out of a branch", () => {
    const g: WorkflowGraph = {
      nodes: [
        { id: "start", kind: "start", label: "S" },
        { id: "br", kind: "branch", label: "B", predicate: "tier" },
        { id: "end", kind: "end", label: "E" },
      ],
      edges: [
        { id: "e1", from: "start", to: "br" },
        { id: "e2", from: "br", to: "end" }, // missing armLabel
      ],
    };
    const v = validate(g);
    expect(v.errors.some((e) => e.code === "branch-missing-arm")).toBe(true);
  });
});

describe("compile", () => {
  it("returns ok=false when validation fails", () => {
    const g = linearGraph();
    g.edges.push({ id: "back", from: "n-b", to: "n-a" });
    const result = compile(g);
    expect(result.ok).toBe(false);
  });

  it("compiles a linear graph into a nested seq tree", () => {
    const result = compile(linearGraph());
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Outer step is a seq containing the first agent + tail seq.
      expect(result.root.kind).toBe("seq");
    }
  });

  it("compiles a branch graph into a branch step", () => {
    const g: WorkflowGraph = {
      nodes: [
        { id: "start", kind: "start", label: "S" },
        { id: "br", kind: "branch", label: "B", predicate: "tier" },
        {
          id: "hot",
          kind: "agent",
          label: "Hot",
          agentSlug: "tier1-support",
        },
        {
          id: "warm",
          kind: "agent",
          label: "Warm",
          agentSlug: "sourcing-sprint",
        },
        { id: "end", kind: "end", label: "End" },
      ],
      edges: [
        { id: "e1", from: "start", to: "br" },
        { id: "e2", from: "br", to: "hot", armLabel: "hot" },
        { id: "e3", from: "br", to: "warm", armLabel: "warm" },
        { id: "e4", from: "hot", to: "end" },
        { id: "e5", from: "warm", to: "end" },
      ],
    };
    const result = compile(g);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.root.kind).toBe("branch");
    }
  });
});
