/**
 * agent-trace — tests.
 *
 * Verifies:
 *   - currentTrace returns null outside of withTrace
 *   - withTrace creates a fresh context per call
 *   - addSpan no-ops gracefully outside a trace
 *   - withSpan creates a span with correct parent + duration
 *   - Nested spans chain parent/child correctly
 *   - traceTotalCostCents sums across spans
 *   - traceFirstError finds the first error
 *   - Span cap (MAX_SPANS_PER_TRACE) drops further spans + emits warning span
 *   - withTrace returns trace on both success AND error paths
 *   - Concurrent traces are isolated (ALS).
 *
 * The full DB persist path is integration-tested separately —
 * here we test only the in-memory ALS-backed lib.
 */

import { describe, it, expect } from "vitest";
import {
  withTrace,
  withSpan,
  addSpan,
  currentTrace,
  traceTotalCostCents,
  traceFirstError,
  MAX_SPANS_PER_TRACE,
} from "../agent-trace";
// Force the Node-side ALS install for tests.
import "../agent-trace-node";

describe("agent-trace — context lifecycle", () => {
  it("currentTrace is null outside of withTrace", () => {
    expect(currentTrace()).toBeNull();
  });

  it("withTrace creates a context that is current inside fn", async () => {
    const captured: { ctx: ReturnType<typeof currentTrace> } = { ctx: null };
    await withTrace("test-agent", async () => {
      captured.ctx = currentTrace();
      return 1;
    });
    expect(captured.ctx).not.toBeNull();
    expect(captured.ctx?.rootAgentName).toBe("test-agent");
  });

  it("currentTrace is null again after withTrace returns", async () => {
    await withTrace("a", async () => 1);
    expect(currentTrace()).toBeNull();
  });

  it("withTrace returns the trace on success", async () => {
    const out = await withTrace("a", async () => "result");
    expect("result" in out).toBe(true);
    if ("result" in out) {
      expect(out.result).toBe("result");
      expect(out.trace.rootAgentName).toBe("a");
    }
  });

  it("withTrace returns the trace on error (NEVER throws)", async () => {
    const out = await withTrace("a", async () => {
      throw new Error("boom");
    });
    expect("error" in out).toBe(true);
    if ("error" in out) {
      expect(String(out.error)).toContain("boom");
      expect(out.trace.rootAgentName).toBe("a");
    }
  });
});

describe("agent-trace — addSpan", () => {
  it("no-ops when no active trace", () => {
    const id = addSpan({
      kind: "model_call",
      name: "outside",
      durationMs: 10,
    });
    expect(id).toBeNull();
  });

  it("appends to the active trace", async () => {
    const out = await withTrace("a", async () => {
      addSpan({ kind: "model_call", name: "nim", durationMs: 100, costCents: 2 });
      addSpan({ kind: "tool_call", name: "tavily", durationMs: 200 });
      return 1;
    });
    if ("trace" in out && out.trace) {
      expect(out.trace.spans).toHaveLength(2);
      expect(out.trace.spans[0].name).toBe("nim");
      expect(out.trace.spans[1].name).toBe("tavily");
    }
  });
});

describe("agent-trace — withSpan parent/child", () => {
  it("nested spans chain parent → child", async () => {
    const out = await withTrace("a", async () => {
      await withSpan({ kind: "agent_call", name: "outer" }, async () => {
        await withSpan({ kind: "tool_call", name: "inner" }, async () => 1);
      });
      return 1;
    });
    if ("trace" in out) {
      const outer = out.trace.spans.find((s) => s.name === "outer");
      const inner = out.trace.spans.find((s) => s.name === "inner");
      expect(outer).toBeDefined();
      expect(inner).toBeDefined();
      expect(inner!.parentId).toBe(outer!.id);
    }
  });

  it("span duration is captured", async () => {
    const out = await withTrace("a", async () => {
      await withSpan({ kind: "model_call", name: "x" }, async () => {
        await new Promise((r) => setTimeout(r, 5));
      });
      return 1;
    });
    if ("trace" in out) {
      const span = out.trace.spans[0];
      expect(span.durationMs).toBeGreaterThanOrEqual(5);
    }
  });

  it("withSpan captures errors as span.error and re-throws", async () => {
    const out = await withTrace("a", async () => {
      try {
        await withSpan({ kind: "tool_call", name: "broken" }, async () => {
          throw new Error("bad tool");
        });
      } catch {
        // expected
      }
      return 1;
    });
    if ("trace" in out) {
      const span = out.trace.spans.find((s) => s.name === "broken");
      expect(span?.error).toContain("bad tool");
    }
  });
});

describe("agent-trace — helpers", () => {
  it("traceTotalCostCents sums spans", async () => {
    const out = await withTrace("a", async () => {
      addSpan({ kind: "model_call", name: "m1", durationMs: 1, costCents: 3 });
      addSpan({ kind: "model_call", name: "m2", durationMs: 1, costCents: 7 });
      addSpan({ kind: "tool_call", name: "t1", durationMs: 1 }); // 0 cost
      return 1;
    });
    if ("trace" in out) {
      expect(traceTotalCostCents(out.trace)).toBe(10);
    }
  });

  it("traceFirstError returns the first error or null", async () => {
    const noErr = await withTrace("a", async () => {
      addSpan({ kind: "model_call", name: "m1", durationMs: 1 });
      return 1;
    });
    if ("trace" in noErr) {
      expect(traceFirstError(noErr.trace)).toBeNull();
    }

    const withErr = await withTrace("a", async () => {
      addSpan({ kind: "model_call", name: "m1", durationMs: 1, error: "first" });
      addSpan({ kind: "model_call", name: "m2", durationMs: 1, error: "second" });
      return 1;
    });
    if ("trace" in withErr) {
      expect(traceFirstError(withErr.trace)).toBe("first");
    }
  });
});

describe("agent-trace — span cap", () => {
  it("drops spans past MAX_SPANS_PER_TRACE and emits a single warning", async () => {
    const out = await withTrace("a", async () => {
      for (let i = 0; i < MAX_SPANS_PER_TRACE + 50; i++) {
        addSpan({ kind: "decision", name: `s${i}`, durationMs: 0 });
      }
      return 1;
    });
    if ("trace" in out) {
      // Up to MAX_SPANS_PER_TRACE real spans + 1 truncation warning = MAX_SPANS_PER_TRACE + 1
      expect(out.trace.spans.length).toBeLessThanOrEqual(MAX_SPANS_PER_TRACE + 1);
      const warning = out.trace.spans.find((s) => s.name === "[trace truncated]");
      expect(warning).toBeDefined();
    }
  });
});

describe("agent-trace — concurrent traces are isolated (ALS)", () => {
  it("two parallel withTrace calls do NOT share spans", async () => {
    const [a, b] = await Promise.all([
      withTrace("agent-a", async () => {
        addSpan({ kind: "model_call", name: "a-only", durationMs: 1 });
        return "a";
      }),
      withTrace("agent-b", async () => {
        addSpan({ kind: "model_call", name: "b-only", durationMs: 1 });
        return "b";
      }),
    ]);
    if ("trace" in a && "trace" in b) {
      expect(a.trace.spans.map((s) => s.name)).toEqual(["a-only"]);
      expect(b.trace.spans.map((s) => s.name)).toEqual(["b-only"]);
      // Trace IDs are unique
      expect(a.trace.traceId).not.toBe(b.trace.traceId);
    }
  });
});
