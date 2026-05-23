/**
 * Tests for src/lib/dag-executor.ts — Wave 115 M5.
 *
 * Pins:
 *   - linear-default behaviour matches the for-loop runner
 *   - parallel fan-out actually runs concurrently
 *   - conditional edges skip non-matching branches
 *   - failure on a required parent skips descendants
 *   - optional-step failure allows descendants to proceed
 *   - cycle detection rejects bad DAGs before execution
 *   - wall-clock timeout marks unfinished steps failed
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
  executeDag,
  normalisedDependsOn,
  validateDag,
} from "@/lib/dag-executor";

describe("normalisedDependsOn — for-loop compat default", () => {
  it("returns [] for the first step when dependsOn omitted", () => {
    expect(normalisedDependsOn({ agent: "a", params: {} }, 0)).toEqual([]);
  });

  it("returns [i - 1] for any non-zero step when dependsOn omitted", () => {
    expect(normalisedDependsOn({ agent: "a", params: {} }, 3)).toEqual([2]);
  });

  it("preserves explicit dependsOn (including empty array for fan-out roots)", () => {
    expect(
      normalisedDependsOn({ agent: "a", params: {}, dependsOn: [] }, 5),
    ).toEqual([]);
    expect(
      normalisedDependsOn({ agent: "a", params: {}, dependsOn: [0, 2] }, 4),
    ).toEqual([0, 2]);
  });
});

describe("validateDag", () => {
  it("accepts linear chains (the for-loop default shape)", () => {
    expect(() =>
      validateDag([
        { agent: "a", params: {} },
        { agent: "b", params: {} },
        { agent: "c", params: {} },
      ]),
    ).not.toThrow();
  });

  it("accepts fan-out from a root", () => {
    expect(() =>
      validateDag([
        { agent: "root", params: {}, dependsOn: [] },
        { agent: "branch1", params: {}, dependsOn: [0] },
        { agent: "branch2", params: {}, dependsOn: [0] },
        { agent: "merge", params: {}, dependsOn: [1, 2] },
      ]),
    ).not.toThrow();
  });

  it("rejects out-of-range dependsOn", () => {
    expect(() =>
      validateDag([
        { agent: "a", params: {}, dependsOn: [] },
        { agent: "b", params: {}, dependsOn: [5] },
      ]),
    ).toThrow(/out-of-range/);
  });

  it("rejects a self-loop", () => {
    expect(() =>
      validateDag([{ agent: "a", params: {}, dependsOn: [0] }]),
    ).toThrow(/depends on itself/);
  });

  it("detects a 2-step cycle", () => {
    expect(() =>
      validateDag([
        { agent: "a", params: {}, dependsOn: [1] },
        { agent: "b", params: {}, dependsOn: [0] },
      ]),
    ).toThrow(/cycle/);
  });

  it("rejects condition.ifStep out of range", () => {
    expect(() =>
      validateDag([
        { agent: "a", params: {}, dependsOn: [] },
        {
          agent: "b",
          params: {},
          dependsOn: [0],
          condition: { ifStep: 99, contains: "x" },
        },
      ]),
    ).toThrow(/out-of-range/);
  });
});

describe("executeDag — linear chain matches for-loop semantic", () => {
  it("runs 3 sequential steps in order, threading outputs via parentOutputs", async () => {
    const order: string[] = [];
    const result = await executeDag(
      [
        { agent: "a", params: {} },
        { agent: "b", params: {} },
        { agent: "c", params: {} },
      ],
      {
        runStep: async (step, i, parents) => {
          order.push(step.agent);
          // parentOutputs should contain step i-1's output if it ran.
          if (i > 0) {
            expect(parents[i - 1]).toBe(`output-${i - 1}`);
          }
          return `output-${i}`;
        },
      },
    );
    expect(order).toEqual(["a", "b", "c"]);
    expect(result.succeeded).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
  });
});

describe("executeDag — parallel fan-out actually runs concurrently", () => {
  it("two independent branches from a root finish in ~max(branch) ms, not sum(branch) ms", async () => {
    const start = Date.now();
    const result = await executeDag(
      [
        { agent: "root", params: {}, dependsOn: [] },
        { agent: "slow-a", params: {}, dependsOn: [0] },
        { agent: "slow-b", params: {}, dependsOn: [0] },
      ],
      {
        runStep: async (step) => {
          if (step.agent === "root") return "go";
          // Each branch sleeps 120ms. Sequential = 240ms. Parallel ≈ 120ms.
          await new Promise((r) => setTimeout(r, 120));
          return `${step.agent}-done`;
        },
        maxConcurrency: 4,
      },
    );
    const elapsed = Date.now() - start;
    expect(result.succeeded).toBe(3);
    // Tolerance for CI scheduler jitter — branches must be at least mostly
    // overlapping, so total time is well under the serial 240ms+root.
    expect(elapsed).toBeLessThan(220);
  });
});

describe("executeDag — conditional edges", () => {
  it("skips a step when the parent's output does NOT contain the required substring", async () => {
    const result = await executeDag(
      [
        { agent: "classify", params: {} },
        {
          agent: "send-email",
          params: {},
          dependsOn: [0],
          condition: { ifStep: 0, contains: "premium-tier" },
        },
      ],
      {
        runStep: async (step) => {
          if (step.agent === "classify") return "VERDICT: free-tier-lead";
          return "should never run";
        },
      },
    );
    expect(result.results[0].status).toBe("done");
    expect(result.results[1].status).toBe("skipped");
    expect(result.results[1].skipReason).toBe("condition-not-met");
  });

  it("executes the step when the parent's output contains the substring (case-insensitive)", async () => {
    const result = await executeDag(
      [
        { agent: "classify", params: {} },
        {
          agent: "send-email",
          params: {},
          dependsOn: [0],
          condition: { ifStep: 0, contains: "QUALIFIED" },
        },
      ],
      {
        runStep: async (step) => {
          if (step.agent === "classify") return "verdict: qualified lead";
          return "email sent";
        },
      },
    );
    expect(result.results[1].status).toBe("done");
    expect(result.results[1].output).toBe("email sent");
  });
});

describe("executeDag — failure semantics", () => {
  it("a failed required parent skips all descendants", async () => {
    const result = await executeDag(
      [
        { agent: "a", params: {} },
        { agent: "b", params: {}, dependsOn: [0] },
        { agent: "c", params: {}, dependsOn: [1] },
      ],
      {
        runStep: async (step) => {
          if (step.agent === "b") throw new Error("boom");
          return `${step.agent}-out`;
        },
      },
    );
    expect(result.results[0].status).toBe("done");
    expect(result.results[1].status).toBe("failed");
    expect(result.results[1].error).toBe("boom");
    expect(result.results[2].status).toBe("skipped");
    expect(result.results[2].skipReason).toBe("ancestor-failed");
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("an optional failed step does NOT block descendants", async () => {
    const result = await executeDag(
      [
        { agent: "a", params: {} },
        { agent: "b", params: {}, dependsOn: [0], optional: true },
        { agent: "c", params: {}, dependsOn: [1] },
      ],
      {
        runStep: async (step) => {
          if (step.agent === "b") throw new Error("optional-boom");
          if (step.agent === "c") {
            // c receives b's output as "" — verifies the fallback
            // does not crash downstream params.
            return "c-ok";
          }
          return `${step.agent}-out`;
        },
      },
    );
    expect(result.results[1].status).toBe("done");
    expect(result.results[1].output).toBe("");
    expect(result.results[2].status).toBe("done");
    expect(result.results[2].output).toBe("c-ok");
  });
});

describe("executeDag — state-change hook fires for the persistence layer", () => {
  it("emits running → done for a healthy linear chain", async () => {
    const transitions: Array<{ index: number; state: string }> = [];
    await executeDag(
      [
        { agent: "a", params: {} },
        { agent: "b", params: {} },
      ],
      {
        runStep: async (step) => `${step.agent}-out`,
        onStateChange: (index, state) => {
          transitions.push({ index, state });
        },
      },
    );
    // Order: 0 running, 0 done, 1 running, 1 done.
    expect(transitions).toEqual([
      { index: 0, state: "running" },
      { index: 0, state: "done" },
      { index: 1, state: "running" },
      { index: 1, state: "done" },
    ]);
  });

  it("emits skipped for ancestor-failed descendants without firing running first", async () => {
    const transitions: Array<{ index: number; state: string }> = [];
    await executeDag(
      [
        { agent: "a", params: {} },
        { agent: "b", params: {}, dependsOn: [0] },
      ],
      {
        runStep: async (step) => {
          if (step.agent === "a") throw new Error("nope");
          return "won't run";
        },
        onStateChange: (index, state) => {
          transitions.push({ index, state });
        },
      },
    );
    // b should go directly from pending → skipped (no `running`).
    const bTransitions = transitions.filter((t) => t.index === 1);
    expect(bTransitions).toEqual([{ index: 1, state: "skipped" }]);
  });
});

describe("executeDag — wall-clock timeout", () => {
  it("marks unfinished steps failed after totalTimeoutMs elapses", async () => {
    const result = await executeDag(
      [
        { agent: "fast", params: {} },
        // This second step will hang past the 100ms deadline.
        { agent: "hang", params: {}, dependsOn: [0] },
      ],
      {
        runStep: async (step) => {
          if (step.agent === "fast") return "fast-done";
          await new Promise((r) => setTimeout(r, 5000)); // intentionally long
          return "never";
        },
        totalTimeoutMs: 100,
      },
    );
    expect(result.results[0].status).toBe("done");
    expect(result.results[1].status).toBe("failed");
    expect(result.results[1].error).toBe("dag-wall-clock");
  });
});

describe("executeDag — parentOutputs only contains ancestors", () => {
  it("a step at depth N sees outputs of its transitive ancestors, not siblings", async () => {
    // Diamond: 0 → 1, 0 → 2, both → 3
    let seenAt3: Record<number, string> = {};
    const seenAt1: Array<number> = [];
    await executeDag(
      [
        { agent: "root", params: {}, dependsOn: [] },
        { agent: "left", params: {}, dependsOn: [0] },
        { agent: "right", params: {}, dependsOn: [0] },
        { agent: "merge", params: {}, dependsOn: [1, 2] },
      ],
      {
        runStep: async (step, i, parents) => {
          if (i === 1) {
            // left's parents should only be the root (index 0).
            // right (index 2) is a sibling, not an ancestor.
            for (const k of Object.keys(parents)) seenAt1.push(Number(k));
          }
          if (i === 3) {
            seenAt3 = parents;
          }
          return `${step.agent}-out`;
        },
      },
    );
    expect(seenAt1).toEqual([0]); // only root
    expect(Object.keys(seenAt3).sort()).toEqual(["0", "1", "2"]);
  });
});
