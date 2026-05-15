/**
 * Tests for src/lib/tracing.ts — Cook 120.
 */

import { describe, it, expect } from "vitest";
import {
  buildTree,
  endSpan,
  formatTraceparent,
  newSpanId,
  newTraceId,
  parseTraceparent,
  setAttribute,
  startSpan,
  traceShapeHash,
} from "../tracing";

describe("ID generation", () => {
  it("newTraceId returns 32 hex chars (16 bytes)", () => {
    const id = newTraceId();
    expect(id).toMatch(/^[a-f0-9]{32}$/);
  });

  it("newSpanId returns 16 hex chars (8 bytes)", () => {
    expect(newSpanId()).toMatch(/^[a-f0-9]{16}$/);
  });

  it("emits unique ids across calls", () => {
    const ids = new Set([newTraceId(), newTraceId(), newTraceId()]);
    expect(ids.size).toBe(3);
  });
});

describe("traceparent parsing", () => {
  it("parses a valid W3C traceparent header", () => {
    const ctx = parseTraceparent(
      "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    );
    expect(ctx?.traceId).toBe("0af7651916cd43dd8448eb211c80319c");
    expect(ctx?.parentSpanId).toBe("b7ad6b7169203331");
    expect(ctx?.spanId).toMatch(/^[a-f0-9]{16}$/);
  });

  it("returns null on malformed input", () => {
    expect(parseTraceparent(null)).toBeNull();
    expect(parseTraceparent("")).toBeNull();
    expect(parseTraceparent("garbage")).toBeNull();
    expect(parseTraceparent("00-too-short-01")).toBeNull();
  });
});

describe("formatTraceparent", () => {
  it("round-trips through parse", () => {
    const ctx = {
      traceId: "0af7651916cd43dd8448eb211c80319c",
      spanId: "b7ad6b7169203331",
      parentSpanId: "",
    };
    const header = formatTraceparent(ctx);
    expect(header).toBe(
      "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
    );
  });
});

describe("startSpan + endSpan", () => {
  it("inherits traceId from parent", () => {
    const root = startSpan({ name: "root", kind: "agent" });
    const child = startSpan({
      parent: root,
      name: "child",
      kind: "tool",
    });
    expect(child.traceId).toBe(root.traceId);
    expect(child.parentSpanId).toBe(root.spanId);
  });

  it("generates fresh traceId for a new root", () => {
    const a = startSpan({ name: "x", kind: "agent" });
    const b = startSpan({ name: "y", kind: "agent" });
    expect(a.traceId).not.toBe(b.traceId);
  });

  it("endSpan sets endMs + status=ok on success", () => {
    const span = startSpan({ name: "x", kind: "agent", now: 1000 });
    const ended = endSpan(span, {}, 1500);
    expect(ended.endMs).toBe(1500);
    expect(ended.status).toBe("ok");
  });

  it("endSpan sets status=error + errorMessage when err supplied", () => {
    const span = startSpan({ name: "x", kind: "agent" });
    const ended = endSpan(span, { error: "boom" });
    expect(ended.status).toBe("error");
    expect(ended.errorMessage).toBe("boom");
  });
});

describe("setAttribute", () => {
  it("returns a new span with the attribute merged", () => {
    const span = startSpan({ name: "x", kind: "agent" });
    const tagged = setAttribute(span, "model", "claude");
    expect(tagged.attributes.model).toBe("claude");
    expect(span.attributes.model).toBeUndefined();
  });
});

describe("buildTree", () => {
  it("builds parent/child tree from a flat list", () => {
    const root = startSpan({ name: "root", kind: "agent" });
    const a = startSpan({ parent: root, name: "a", kind: "tool" });
    const b = startSpan({ parent: root, name: "b", kind: "tool" });
    const c = startSpan({ parent: a, name: "c", kind: "model" });
    const tree = buildTree([root, a, b, c]);
    expect(tree.length).toBe(1);
    expect(tree[0].span.spanId).toBe(root.spanId);
    expect(tree[0].children.length).toBe(2);
    const aNode = tree[0].children.find((n) => n.span.spanId === a.spanId)!;
    expect(aNode.children.length).toBe(1);
    expect(aNode.children[0].span.spanId).toBe(c.spanId);
  });

  it("orphans spans whose parent is missing", () => {
    const orphan = startSpan({
      parent: {
        traceId: newTraceId(),
        spanId: newSpanId(),
        parentSpanId: "",
      },
      name: "x",
      kind: "agent",
    });
    const tree = buildTree([orphan]);
    expect(tree.length).toBe(1);
  });
});

describe("traceShapeHash", () => {
  it("returns the same hash for identical shapes regardless of trace id", () => {
    const a = startSpan({ name: "agent.run", kind: "agent" });
    const b = startSpan({ name: "agent.run", kind: "agent" });
    expect(traceShapeHash([a])).toBe(traceShapeHash([b]));
  });

  it("returns different hashes for different shapes", () => {
    const a = startSpan({ name: "agent.run", kind: "agent" });
    const b = startSpan({ name: "tool.fetch_url", kind: "tool" });
    expect(traceShapeHash([a])).not.toBe(traceShapeHash([b]));
  });
});
