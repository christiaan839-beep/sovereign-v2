/**
 * Tests for src/lib/orchestration.ts — Cook 37 multi-agent workflows.
 *
 * Contracts under test:
 *
 *   - agent step: runs the runner, writes saveAs into ctx.vars,
 *     captures duration + outcome.
 *   - seq: runs in order, stops on first error.
 *   - parallel: runs concurrently (latency contract), surfaces the
 *     first error in the children list.
 *   - branch: dispatches by predicate; missing arm = structured error.
 *   - Receipt: WorkflowResult is fully JSON-serializable.
 *   - The full result tree mirrors the execution tree (children preserved).
 */

import { describe, it, expect, vi } from "vitest";
import {
  agent,
  branch,
  parallel,
  runWorkflow,
  seq,
  type AgentRunner,
  type WorkflowContext,
} from "../orchestration";

const CTX = (overrides: Partial<WorkflowContext> = {}): WorkflowContext => ({
  userId: "user-1",
  tenantId: "tenant-1",
  runId: "run-abc",
  vars: {},
  ...overrides,
});

const echoRunner: AgentRunner = async (slug, input) => ({
  slug,
  receivedInput: input,
});

describe("runWorkflow — single agent step", () => {
  it("runs the runner and writes saveAs into vars", async () => {
    const step = agent({
      id: "step-1",
      agent: "echo",
      buildInput: (c) => ({ greet: c.userId }),
      saveAs: "echoed",
    });
    const ctx = CTX();
    const result = await runWorkflow(step, ctx, echoRunner);

    expect(result.outcome).toBe("ok");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].id).toBe("step-1");
    expect(result.steps[0].outcome.kind).toBe("ok");
    expect(result.vars.echoed).toEqual({
      slug: "echo",
      receivedInput: { greet: "user-1" },
    });
    expect(typeof result.steps[0].durationMs).toBe("number");
  });

  it("returns a structured error when the runner throws", async () => {
    const failing: AgentRunner = async () => {
      throw new Error("agent down");
    };
    const step = agent({
      id: "fails",
      agent: "broken",
      buildInput: () => ({}),
    });
    const result = await runWorkflow(step, CTX(), failing);
    expect(result.outcome).toBe("error");
    expect(result.steps[0].outcome.kind).toBe("error");
    if (result.steps[0].outcome.kind === "error") {
      expect(result.steps[0].outcome.message).toContain("agent down");
    }
  });
});

describe("runWorkflow — seq", () => {
  it("runs children in order and preserves their results", async () => {
    const calls: string[] = [];
    const recorder: AgentRunner = async (slug) => {
      calls.push(slug);
      return { ok: slug };
    };
    const root = seq("pipeline", [
      agent({ id: "a", agent: "a", buildInput: () => ({}) }),
      agent({ id: "b", agent: "b", buildInput: () => ({}) }),
      agent({ id: "c", agent: "c", buildInput: () => ({}) }),
    ]);
    const result = await runWorkflow(root, CTX(), recorder);
    expect(calls).toEqual(["a", "b", "c"]);
    expect(result.outcome).toBe("ok");
    expect(result.steps[0].children).toHaveLength(3);
  });

  it("stops the seq on first failure and propagates the error", async () => {
    const calls: string[] = [];
    const recorder: AgentRunner = async (slug) => {
      calls.push(slug);
      if (slug === "b") throw new Error("middle failed");
      return { ok: slug };
    };
    const root = seq("pipeline", [
      agent({ id: "a", agent: "a", buildInput: () => ({}) }),
      agent({ id: "b", agent: "b", buildInput: () => ({}) }),
      agent({ id: "c", agent: "c", buildInput: () => ({}) }),
    ]);
    const result = await runWorkflow(root, CTX(), recorder);
    expect(calls).toEqual(["a", "b"]); // c never runs
    expect(result.outcome).toBe("error");
    expect(result.steps[0].children).toHaveLength(2);
  });
});

describe("runWorkflow — parallel", () => {
  it("runs children concurrently (latency contract)", async () => {
    const slowRunner: AgentRunner = async (slug) => {
      await new Promise((r) => setTimeout(r, 40));
      return { slug };
    };
    const root = parallel("fanout", [
      agent({ id: "1", agent: "a", buildInput: () => ({}) }),
      agent({ id: "2", agent: "b", buildInput: () => ({}) }),
      agent({ id: "3", agent: "c", buildInput: () => ({}) }),
    ]);
    const start = Date.now();
    const result = await runWorkflow(root, CTX(), slowRunner);
    const elapsed = Date.now() - start;
    expect(result.outcome).toBe("ok");
    expect(result.steps[0].children).toHaveLength(3);
    // 3x 40ms sequential ≈ 120ms+; concurrent ≈ 40ms+.
    expect(elapsed).toBeLessThan(110);
  });

  it("surfaces the first error in children but still records every result", async () => {
    const runner: AgentRunner = async (slug) => {
      if (slug === "boom") throw new Error("noooo");
      return { ok: slug };
    };
    const root = parallel("fanout", [
      agent({ id: "1", agent: "ok1", buildInput: () => ({}) }),
      agent({ id: "2", agent: "boom", buildInput: () => ({}) }),
      agent({ id: "3", agent: "ok2", buildInput: () => ({}) }),
    ]);
    const result = await runWorkflow(root, CTX(), runner);
    expect(result.outcome).toBe("error");
    expect(result.steps[0].children).toHaveLength(3);
    const okChildren = result.steps[0].children!.filter(
      (c) => c.outcome.kind === "ok",
    );
    expect(okChildren).toHaveLength(2);
  });
});

describe("runWorkflow — branch", () => {
  it("dispatches to the arm chosen by the predicate", async () => {
    const runner: AgentRunner = async (slug) => ({ ran: slug });
    const root = branch(
      "router",
      (c) => (c.vars.score === "hot" ? "fast" : "slow"),
      {
        fast: agent({ id: "fast", agent: "fast-path", buildInput: () => ({}) }),
        slow: agent({ id: "slow", agent: "slow-path", buildInput: () => ({}) }),
      },
    );
    const hot = await runWorkflow(
      root,
      CTX({ vars: { score: "hot" } }),
      runner,
    );
    expect(hot.steps[0].children).toHaveLength(1);
    expect(
      (hot.steps[0].children![0].outcome as { kind: "ok"; value: unknown })
        .value,
    ).toEqual({
      ran: "fast-path",
    });

    const cold = await runWorkflow(
      root,
      CTX({ vars: { score: "cold" } }),
      runner,
    );
    expect(
      (cold.steps[0].children![0].outcome as { kind: "ok"; value: unknown })
        .value,
    ).toEqual({
      ran: "slow-path",
    });
  });

  it("emits a structured error when the predicate picks a missing arm", async () => {
    const root = branch("router", () => "ghost", {
      fast: agent({ id: "fast", agent: "fast", buildInput: () => ({}) }),
    });
    const result = await runWorkflow(root, CTX(), echoRunner);
    expect(result.outcome).toBe("error");
    expect(result.steps[0].outcome.kind).toBe("error");
    if (result.steps[0].outcome.kind === "error") {
      expect(result.steps[0].outcome.message).toContain("ghost");
    }
  });
});

describe("runWorkflow — composed workflows", () => {
  it("lead-qualifier → if hot, tier1-support; if warm, sourcing-sprint", async () => {
    const calls: string[] = [];
    const runner: AgentRunner = async (slug, input, ctx) => {
      calls.push(slug);
      if (slug === "lead-qualifier") {
        ctx.vars.tier = "hot";
        return { tier: "hot" };
      }
      return { slug, input };
    };

    const wf = seq("lead-pipeline", [
      agent({
        id: "qualify",
        agent: "lead-qualifier",
        buildInput: (c) => ({ leadId: c.vars.leadId }),
        saveAs: "qualified",
      }),
      branch("route", (c) => (c.vars.tier === "hot" ? "support" : "sourcing"), {
        support: agent({
          id: "tier1",
          agent: "tier1-support",
          buildInput: () => ({}),
        }),
        sourcing: agent({
          id: "sprint",
          agent: "sourcing-sprint",
          buildInput: () => ({}),
        }),
      }),
    ]);

    const result = await runWorkflow(
      wf,
      CTX({ vars: { leadId: "L-42" } }),
      runner,
    );
    expect(result.outcome).toBe("ok");
    expect(calls).toEqual(["lead-qualifier", "tier1-support"]);
    expect(result.vars.qualified).toEqual({ tier: "hot" });
  });
});

describe("runWorkflow — receipt-friendliness", () => {
  it("returns a fully JSON-serializable result tree", async () => {
    const wf = seq("root", [
      agent({ id: "a", agent: "a", buildInput: () => ({}) }),
      parallel("p", [
        agent({ id: "p1", agent: "p1", buildInput: () => ({}) }),
        agent({ id: "p2", agent: "p2", buildInput: () => ({}) }),
      ]),
    ]);
    const result = await runWorkflow(wf, CTX(), echoRunner);
    expect(() => JSON.parse(JSON.stringify(result))).not.toThrow();
  });

  it("records durationMs for every step", async () => {
    const slow: AgentRunner = async () => {
      await new Promise((r) => setTimeout(r, 10));
      return {};
    };
    const wf = agent({ id: "x", agent: "x", buildInput: () => ({}) });
    const result = await runWorkflow(wf, CTX(), slow);
    expect(result.steps[0].durationMs).toBeGreaterThanOrEqual(10);
  });

  it("passes the same ctx instance into the runner (predicates can read mutations)", async () => {
    const runner = vi.fn().mockResolvedValue({ ok: true });
    const wf = agent({ id: "x", agent: "x", buildInput: () => ({}) });
    const ctx = CTX();
    await runWorkflow(wf, ctx, runner);
    expect(runner).toHaveBeenCalledWith("x", {}, ctx);
  });
});
