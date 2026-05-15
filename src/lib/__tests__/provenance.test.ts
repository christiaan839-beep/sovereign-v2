/**
 * Tests for src/lib/provenance.ts — Cook 92.
 *
 *   - builder rejects duplicate ids + unknown edge endpoints.
 *   - build() hash is deterministic across permutations.
 *   - rootAncestorsOf walks every transitive source.
 *   - graph is JSON-serializable.
 */

import { describe, it, expect } from "vitest";
import { ProvenanceBuilder, rootAncestorsOf } from "../provenance";

describe("ProvenanceBuilder", () => {
  it("rejects duplicate node ids", () => {
    const b = new ProvenanceBuilder().add({
      id: "a",
      kind: "input",
      label: "A",
    });
    expect(() => b.add({ id: "a", kind: "source", label: "Dup" })).toThrow(
      /duplicate/,
    );
  });

  it("rejects edge with unknown endpoints", () => {
    const b = new ProvenanceBuilder().add({
      id: "a",
      kind: "input",
      label: "A",
    });
    expect(() => b.link("a", "ghost")).toThrow(/edge.to/);
    expect(() => b.link("ghost", "a")).toThrow(/edge.from/);
  });

  it("build() emits a deterministic hash across permutations", () => {
    const a = new ProvenanceBuilder()
      .add({ id: "n1", kind: "input", label: "user" })
      .add({ id: "n2", kind: "source", label: "doc" })
      .add({ id: "n3", kind: "claim", label: "answer" })
      .link("n1", "n2", "queried")
      .link("n2", "n3", "cites")
      .build();
    const b = new ProvenanceBuilder()
      .add({ id: "n3", kind: "claim", label: "answer" })
      .add({ id: "n2", kind: "source", label: "doc" })
      .add({ id: "n1", kind: "input", label: "user" })
      .link("n2", "n3", "cites")
      .link("n1", "n2", "queried")
      .build();
    expect(a.hash).toBe(b.hash);
  });

  it("graph is JSON-serializable", () => {
    const g = new ProvenanceBuilder()
      .add({ id: "x", kind: "input", label: "x" })
      .build();
    expect(() => JSON.parse(JSON.stringify(g))).not.toThrow();
  });

  it("hash differs when meta differs", () => {
    const a = new ProvenanceBuilder()
      .add({ id: "x", kind: "input", label: "x", meta: { tier: "A" } })
      .build();
    const b = new ProvenanceBuilder()
      .add({ id: "x", kind: "input", label: "x", meta: { tier: "B" } })
      .build();
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("rootAncestorsOf", () => {
  it("returns every source the claim depends on transitively", () => {
    const g = new ProvenanceBuilder()
      .add({ id: "input1", kind: "input", label: "user query" })
      .add({ id: "src1", kind: "source", label: "doc A" })
      .add({ id: "src2", kind: "source", label: "doc B" })
      .add({ id: "model1", kind: "model-call", label: "gpt-call" })
      .add({ id: "claim1", kind: "claim", label: "answer" })
      .link("input1", "model1", "queried-via")
      .link("src1", "model1", "context")
      .link("src2", "model1", "context")
      .link("model1", "claim1", "produced")
      .build();
    const ancestors = rootAncestorsOf(g, "claim1");
    const ids = ancestors.map((n) => n.id).sort();
    expect(ids).toEqual(["input1", "src1", "src2"]);
  });

  it("returns empty when claim has no ancestors", () => {
    const g = new ProvenanceBuilder()
      .add({ id: "lonely", kind: "claim", label: "x" })
      .build();
    expect(rootAncestorsOf(g, "lonely")).toEqual([]);
  });

  it("returns empty when claim id is not in the graph", () => {
    const g = new ProvenanceBuilder()
      .add({ id: "a", kind: "input", label: "x" })
      .build();
    expect(rootAncestorsOf(g, "missing")).toEqual([]);
  });
});
