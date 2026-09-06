/**
 * Wave 112 — playbook DAG scheduler.
 *
 * Covers the indexing contract ({{step_N}} is 1-indexed), graph
 * construction, dependency-aware skipping, and bounded concurrency.
 */
import { describe, it, expect } from "vitest";
import {
  parseStepRefs,
  buildPlaybookDag,
  resolveStepParams,
  executeDag,
  type DagNode,
  type StepOutcome,
} from "@/lib/playbook-dag";
import { PLAYBOOKS } from "@/lib/playbooks";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
};

describe("parseStepRefs — 1-indexed authoring, 0-indexed internals", () => {
  it("maps {{step_1}} to index 0", () => {
    const { deps, warnings } = parseStepRefs({ context: "{{step_1}}" }, 1, 2);
    expect(deps).toEqual([0]);
    expect(warnings).toEqual([]);
  });

  it("collects multiple distinct references, sorted and deduped", () => {
    const { deps } = parseStepRefs(
      { prompt: "A: {{step_1}} B: {{step_2}} again {{step_1}}" },
      2,
      3,
    );
    expect(deps).toEqual([0, 1]);
  });

  it("drops a self-reference rather than deadlocking", () => {
    const { deps, warnings } = parseStepRefs({ p: "{{step_2}}" }, 1, 3);
    expect(deps).toEqual([]);
    expect(warnings[0]).toContain("refers to itself");
  });

  it("drops a forward reference", () => {
    const { deps, warnings } = parseStepRefs({ p: "{{step_3}}" }, 1, 3);
    expect(deps).toEqual([]);
    expect(warnings[0]).toContain("later step");
  });

  it("drops a reference past the last step", () => {
    const { deps, warnings } = parseStepRefs({ p: "{{step_9}}" }, 1, 3);
    expect(deps).toEqual([]);
    expect(warnings[0]).toContain("past the last step");
  });

  it("drops {{step_0}} — there is no zeroth step", () => {
    const { deps, warnings } = parseStepRefs({ p: "{{step_0}}" }, 1, 3);
    expect(deps).toEqual([]);
    expect(warnings[0]).toContain("not a valid 1-indexed reference");
  });

  it("ignores params with no references", () => {
    expect(parseStepRefs({ url: "acme.com" }, 1, 2).deps).toEqual([]);
  });
});

describe("buildPlaybookDag", () => {
  it("gives step 0 no dependencies", () => {
    const { nodes } = buildPlaybookDag([{ params: { a: "x" } }]);
    expect(nodes[0]).toEqual({ index: 0, deps: [], explicit: false });
  });

  it("falls back to the implicit previous-step edge when nothing is declared", () => {
    const { nodes } = buildPlaybookDag([
      { params: { a: "x" } },
      { params: { b: "y" } },
      { params: { c: "z" } },
    ]);
    expect(nodes.map((n) => n.deps)).toEqual([[], [0], [1]]);
    expect(nodes.every((n) => !n.explicit)).toBe(true);
  });

  it("uses declared references instead of the implicit edge", () => {
    // Step 3 (index 2) declares only step 1 (index 0) — so it must NOT
    // inherit an edge from index 1, leaving 1 and 2 free to run together.
    const { nodes } = buildPlaybookDag([
      { params: { a: "x" } },
      { params: { b: "y" } },
      { params: { c: "{{step_1}}" } },
    ]);
    expect(nodes[2]).toEqual({ index: 2, deps: [0], explicit: true });
  });

  it("reports dropped references as warnings without throwing", () => {
    const { nodes, warnings } = buildPlaybookDag([
      { params: { a: "x" } },
      { params: { b: "{{step_2}}" } },
    ]);
    expect(warnings).toHaveLength(1);
    // Falls back to the implicit edge once the bad ref is dropped.
    expect(nodes[1].deps).toEqual([0]);
  });
});

describe("resolveStepParams", () => {
  it("substitutes the referenced step's output", () => {
    const out = resolveStepParams(
      { prompt: "Competitor: {{step_1}} SEO: {{step_2}}" },
      { 0: "SCRAPE", 1: "SEO-DATA" },
    );
    expect(out.prompt).toBe("Competitor: SCRAPE SEO: SEO-DATA");
  });

  it("collapses a reference with no recorded output to an empty string", () => {
    const out = resolveStepParams({ prompt: "X: {{step_2}}" }, { 0: "A" });
    expect(out.prompt).toBe("X: ");
  });

  it("leaves non-reference params untouched", () => {
    const out = resolveStepParams({ url: "acme.com" }, { 0: "A" });
    expect(out.url).toBe("acme.com");
  });
});

describe("executeDag", () => {
  const ok = (output: string): StepOutcome => ({ status: "done", output });

  it("runs a linear chain in order and threads outputs through", () => {
    const nodes: DagNode[] = [
      { index: 0, deps: [], explicit: false },
      { index: 1, deps: [0], explicit: true },
    ];
    const seen: Record<number, Record<number, string>> = {};
    return executeDag(nodes, async (i, depOutputs) => {
      seen[i] = depOutputs;
      return ok(`out-${i}`);
    }).then((res) => {
      expect(res.succeeded).toBe(2);
      expect(seen[1]).toEqual({ 0: "out-0" });
      expect(res.outputs[1]).toBe("out-1");
    });
  });

  it("runs independent steps concurrently", async () => {
    // 0 -> {1, 2}; 1 and 2 have no edge between them.
    const nodes: DagNode[] = [
      { index: 0, deps: [], explicit: false },
      { index: 1, deps: [0], explicit: true },
      { index: 2, deps: [0], explicit: true },
    ];
    const gate = deferred();
    let inFlight = 0;

    const res = await executeDag(nodes, async (i) => {
      if (i === 0) return ok("root");
      inFlight++;
      // Both dependants must be in flight before either resolves.
      if (inFlight === 2) gate.resolve();
      await gate.promise;
      return ok(`out-${i}`);
    });

    expect(res.succeeded).toBe(3);
    expect(res.maxParallelism).toBe(2);
  });

  it("honours the concurrency ceiling", async () => {
    const nodes: DagNode[] = Array.from({ length: 6 }, (_, i) => ({
      index: i,
      deps: [],
      explicit: true,
    }));
    let inFlight = 0;
    let peak = 0;

    const res = await executeDag(
      nodes,
      async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return ok("x");
      },
      { concurrency: 2 },
    );

    expect(res.succeeded).toBe(6);
    expect(peak).toBeLessThanOrEqual(2);
    expect(res.maxParallelism).toBeLessThanOrEqual(2);
  });

  it("skips a step whose dependency failed instead of running it empty", async () => {
    const nodes: DagNode[] = [
      { index: 0, deps: [], explicit: false },
      { index: 1, deps: [0], explicit: true },
    ];
    const ran: number[] = [];
    const skips: Array<[number, string]> = [];

    const res = await executeDag(
      nodes,
      async (i) => {
        ran.push(i);
        return i === 0
          ? { status: "failed", error: "boom" }
          : ok("should not happen");
      },
      { onSkip: (i, reason) => void skips.push([i, reason]) },
    );

    expect(ran).toEqual([0]);
    expect(res.failed).toBe(1);
    expect(res.skipped).toBe(1);
    expect(skips[0][0]).toBe(1);
    // Reported 1-indexed, matching how playbooks address steps.
    expect(skips[0][1]).toContain("step 1");
  });

  it("propagates a skip transitively down the chain", async () => {
    const nodes: DagNode[] = [
      { index: 0, deps: [], explicit: false },
      { index: 1, deps: [0], explicit: true },
      { index: 2, deps: [1], explicit: true },
    ];
    const res = await executeDag(nodes, async (i) =>
      i === 0 ? { status: "failed", error: "boom" } : ok("x"),
    );
    expect(res.statuses).toEqual({ 0: "failed", 1: "skipped", 2: "skipped" });
  });

  it("still runs a branch that does not depend on the failed step", async () => {
    const nodes: DagNode[] = [
      { index: 0, deps: [], explicit: true },
      { index: 1, deps: [], explicit: true },
      { index: 2, deps: [1], explicit: true },
    ];
    const res = await executeDag(nodes, async (i) =>
      i === 0 ? { status: "failed", error: "boom" } : ok("x"),
    );
    expect(res.statuses[2]).toBe("done");
    expect(res.succeeded).toBe(2);
    expect(res.failed).toBe(1);
  });

  it("captures a throw from runStep as a failed step", async () => {
    const nodes: DagNode[] = [{ index: 0, deps: [], explicit: false }];
    const res = await executeDag(nodes, async () => {
      throw new Error("unhandled");
    });
    expect(res.failed).toBe(1);
    expect(res.statuses[0]).toBe("failed");
  });

  it("fails closed on a cycle rather than spinning forever", async () => {
    // buildPlaybookDag cannot produce this, but the scheduler must not
    // hang if a future caller hand-builds one.
    const nodes: DagNode[] = [
      { index: 0, deps: [1], explicit: true },
      { index: 1, deps: [0], explicit: true },
    ];
    const res = await executeDag(nodes, async () => ok("never"));
    expect(res.skipped).toBe(2);
    expect(res.succeeded).toBe(0);
  });

  it("handles an empty playbook", async () => {
    const res = await executeDag([], async () => ok("x"));
    expect(res).toMatchObject({ succeeded: 0, failed: 0, skipped: 0 });
  });
});

describe("shipped playbooks satisfy the 1-indexed contract", () => {
  // This is the regression guard for the wave-112 bug: under the old
  // 0-indexed reading, 33 of 37 references across 25 playbooks resolved
  // to the referencing step's own (empty) output. Under the correct
  // 1-indexed reading every shipped reference is a valid backward edge.
  it("every {{step_N}} reference points at an earlier step", () => {
    const offenders: string[] = [];

    for (const pb of PLAYBOOKS) {
      const { warnings } = buildPlaybookDag(pb.steps);
      for (const w of warnings) offenders.push(`${pb.id}: ${w}`);
    }

    expect(offenders).toEqual([]);
  });

  it("competitor-takedown's synthesis step depends on both prior steps", () => {
    const pb = PLAYBOOKS.find((p) => p.id === "competitor-takedown");
    expect(pb).toBeDefined();
    const { nodes } = buildPlaybookDag(pb!.steps);
    // "Competitor data: {{step_1}} SEO data: {{step_2}}" → indices 0 and 1.
    expect(nodes[2].deps).toEqual([0, 1]);
    expect(nodes[2].explicit).toBe(true);
  });
});
