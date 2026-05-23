/**
 * Wave-151 super-agent tool executor tests.
 *
 * super-agent is now a multi-step claudeToolUse orchestrator. The
 * actual Claude call needs the Anthropic SDK + a key, so we test
 * the TOOL EXECUTOR in isolation — the same shape Claude would
 * invoke through claudeToolUse.
 *
 * Each tool's contract is pinned:
 *   - search_past_plans  → memory recall + anon guard
 *   - call_agent         → outboundFetch + MAX_STEPS cap + failure path
 *   - verify_progress    → verifiedAi pass-through
 *   - run_code           → sandbox wrap with JSON envelope
 *   - store_plan_outcome → memory write + anon guard
 *   - finalize_summary   → mutates ctx.report + array coercion
 *
 * The executor MUST NOT throw — Claude reads error strings from the
 * tool result and decides how to recover.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { searchMemoryMock, storeMemoryMock, verifiedAiMock, outboundFetchMock } =
  vi.hoisted(() => ({
    searchMemoryMock: vi.fn(),
    storeMemoryMock: vi.fn(),
    verifiedAiMock: vi.fn(),
    outboundFetchMock: vi.fn(),
  }));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));
vi.mock("@/lib/vector-memory", () => ({
  searchMemory: searchMemoryMock,
  storeMemory: storeMemoryMock,
}));
vi.mock("@/lib/consensus", () => ({
  verifiedAi: verifiedAiMock,
}));
vi.mock("@/lib/ai", () => ({
  smartAi: vi.fn(),
  claudeToolUse: vi.fn(),
}));
vi.mock("@/lib/outbound-fetch", () => ({
  outboundFetchAsResponse: outboundFetchMock,
}));
vi.mock("@/lib/base-url", () => ({
  getBaseUrl: () => "https://sovereign.test",
}));
vi.mock("@/lib/run-code", () => ({
  runCode: (code: string) => {
    if (code === "throw new Error('boom')") {
      throw new Error("boom");
    }
    if (code === "2 + 2") {
      return { success: true, result: 4, stdout: "", durationMs: 1 };
    }
    return { success: true, result: undefined, stdout: "", durationMs: 1 };
  },
  RUN_CODE_TOOL_DEF: {
    name: "run_code",
    description: "test",
    input_schema: { type: "object", properties: {}, required: [] },
  },
}));
vi.mock("@/lib/agent-factory", () => ({
  createAgentRoute: (config: unknown) => config,
}));

import {
  buildToolExecutor,
  type SuperAgentContext,
} from "@/app/api/_agents/super-agent/route";

function freshCtx(over: Partial<SuperAgentContext> = {}): SuperAgentContext {
  return {
    userId: "user-test",
    goal: "Launch the Q3 campaign",
    callLog: [],
    trace: [],
    report: null,
    ...over,
  };
}

beforeEach(() => {
  searchMemoryMock.mockReset();
  storeMemoryMock.mockReset();
  verifiedAiMock.mockReset();
  outboundFetchMock.mockReset();
});

describe("search_past_plans", () => {
  it("returns no-matches sentinel when memory is empty", async () => {
    searchMemoryMock.mockResolvedValue([]);
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("search_past_plans", { query: "Q3 campaign" });
    expect(out).toMatch(/no prior plans match/i);
  });

  it("formats matches with similarity + truncated content", async () => {
    searchMemoryMock.mockResolvedValue([
      {
        content: "Past plan: leads → blog-gen → seo-dominator".repeat(20),
        agentName: "super-agent",
        similarity: 0.92,
        createdAt: new Date().toISOString(),
      },
      {
        content: "Different past plan B",
        agentName: "super-agent",
        similarity: 0.71,
        createdAt: new Date().toISOString(),
      },
    ]);
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("search_past_plans", { query: "Q3" });
    expect(out).toMatch(/<past_plan/);
    expect(out).toMatch(/rank="1"/);
    expect(out).toMatch(/similarity="0.920"/);
  });

  it("returns memory-disabled sentinel for anon userId", async () => {
    const exec = buildToolExecutor(freshCtx({ userId: "anon" }));
    const out = await exec("search_past_plans", { query: "x" });
    expect(out).toMatch(/Memory disabled for anonymous/);
    expect(searchMemoryMock).not.toHaveBeenCalled();
  });

  it("returns ERROR when query is missing", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("search_past_plans", {});
    expect(out).toMatch(/^ERROR/);
  });
});

describe("call_agent", () => {
  it("calls the agent endpoint and returns success JSON", async () => {
    outboundFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: "ok" }),
    });
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("call_agent", {
      agent: "leads",
      params: { niche: "saas", location: "us" },
      reason: "Surface ICP leads first",
    });
    const parsed = JSON.parse(out);
    expect(parsed.status).toBe("success");
    expect(parsed.agent).toBe("leads");
    expect(parsed.step).toBe(1);
    expect(ctx.callLog).toHaveLength(1);
    expect(ctx.callLog[0].status).toBe("success");
  });

  it("returns failure JSON on non-2xx but does not throw", async () => {
    outboundFetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: "service down" }),
    });
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("call_agent", {
      agent: "blog-gen",
      params: { topic: "x" },
      reason: "y",
    });
    const parsed = JSON.parse(out);
    expect(parsed.status).toBe("failed");
    expect(parsed.error).toMatch(/service down|HTTP 503/);
    expect(parsed.hint).toMatch(/different agent|finalize_summary/);
    expect(ctx.callLog[0].status).toBe("failed");
  });

  it("rejects unknown agent slug without making a call", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("call_agent", {
      agent: "fake-agent",
      params: {},
      reason: "test",
    });
    expect(out).toMatch(/^ERROR.*agent must be one of/);
    expect(outboundFetchMock).not.toHaveBeenCalled();
    expect(ctx.callLog).toHaveLength(0);
  });

  it("caps at MAX_STEPS (5) call_agent invocations", async () => {
    outboundFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: "ok" }),
    });
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    for (let i = 0; i < 5; i++) {
      await exec("call_agent", {
        agent: "leads",
        params: { niche: `i-${i}` },
        reason: `step ${i}`,
      });
    }
    expect(ctx.callLog).toHaveLength(5);
    const out = await exec("call_agent", {
      agent: "leads",
      params: {},
      reason: "6th",
    });
    expect(out).toMatch(/max 5 .* exceeded/);
    expect(ctx.callLog).toHaveLength(5);
  });

  it("captures thrown outboundFetch as a failure result", async () => {
    outboundFetchMock.mockRejectedValue(new Error("network drop"));
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("call_agent", {
      agent: "deep-think",
      params: { problem: "x" },
      reason: "y",
    });
    const parsed = JSON.parse(out);
    expect(parsed.status).toBe("failed");
    expect(parsed.error).toMatch(/network drop/);
    expect(ctx.callLog[0].status).toBe("failed");
  });
});

describe("verify_progress", () => {
  it("returns the verifiedAi result envelope", async () => {
    verifiedAiMock.mockResolvedValue({
      answer: "Looks correct.",
      verified: true,
      confidence: 0.88,
      critique: "Minor gap on step 2",
      models: ["nim", "claude"],
    });
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("verify_progress", {
      checkpoint_text: "Goal so far covered by leads + blog-gen",
    });
    const parsed = JSON.parse(out);
    expect(parsed.verified).toBe(true);
    expect(parsed.confidence).toBe(0.88);
    expect(parsed.critique).toMatch(/gap/);
  });

  it("returns ERROR when checkpoint_text is missing", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("verify_progress", {});
    expect(out).toMatch(/^ERROR/);
  });

  it("returns degraded sentinel when verifiedAi throws", async () => {
    verifiedAiMock.mockRejectedValue(new Error("no consensus models"));
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("verify_progress", { checkpoint_text: "x" });
    expect(out).toMatch(/unavailable/);
  });
});

describe("run_code", () => {
  it("returns JSON envelope on success", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("run_code", { code: "2 + 2" });
    const parsed = JSON.parse(out);
    expect(parsed.success).toBe(true);
    expect(parsed.result).toBe(4);
  });

  it("returns ERROR when code is missing", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("run_code", {});
    expect(out).toMatch(/^ERROR/);
  });

  it("captures runCode throws without aborting the loop", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("run_code", { code: "throw new Error('boom')" });
    expect(out).toMatch(/run_code threw/);
  });
});

describe("store_plan_outcome", () => {
  it("writes via storeMemory and returns 'stored'", async () => {
    storeMemoryMock.mockResolvedValue(true);
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("store_plan_outcome", {
      outcome: "Leads agent surfaced 14 ICP fits",
      chain: "leads, blog-gen",
    });
    expect(out).toBe("stored");
    expect(storeMemoryMock).toHaveBeenCalledWith(
      "user-test",
      "super-agent",
      "[leads, blog-gen] Leads agent surfaced 14 ICP fits",
      { kind: "super-agent-outcome", chain: "leads, blog-gen" },
    );
  });

  it("returns 'store skipped' when storeMemory returns false", async () => {
    storeMemoryMock.mockResolvedValue(false);
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("store_plan_outcome", { outcome: "x" });
    expect(out).toMatch(/store skipped/);
  });

  it("returns memory-disabled sentinel for anon userId", async () => {
    const exec = buildToolExecutor(freshCtx({ userId: "anon" }));
    const out = await exec("store_plan_outcome", { outcome: "x" });
    expect(out).toMatch(/Memory disabled/);
  });

  it("returns ERROR when outcome is missing", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("store_plan_outcome", {});
    expect(out).toMatch(/^ERROR/);
  });
});

describe("finalize_summary", () => {
  it("mutates ctx.report with the structured shape", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("finalize_summary", {
      summary: "Goal achieved via 3 specialist agents.",
      execution_plan: [
        { step: 1, agent: "leads", reason: "surface ICP" },
        { step: 2, agent: "blog-gen", reason: "produce assets" },
        { step: 3, agent: "seo-dominator", reason: "rank them" },
      ],
      key_findings: ["14 ICP fits", "3 weak SEO competitors"],
      risks: ["Rank momentum slow → invest more in backlinks"],
      next_actions: ["Schedule blog posts weekly"],
      confidence: "high",
      data_grounded: true,
    });
    expect(out).toMatch(/Summary finalized/);
    expect(ctx.report).not.toBeNull();
    expect(ctx.report?.confidence).toBe("high");
    expect(ctx.report?.execution_plan).toHaveLength(3);
    expect(ctx.report?.key_findings).toHaveLength(2);
    expect(ctx.report?.data_grounded).toBe(true);
  });

  it("caps execution_plan at MAX_STEPS (5)", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const huge = Array.from({ length: 20 }, (_, i) => ({
      step: i + 1,
      agent: "leads",
      reason: `step ${i + 1}`,
    }));
    await exec("finalize_summary", {
      summary: "x",
      execution_plan: huge,
      key_findings: [],
      risks: [],
      next_actions: [],
      confidence: "low",
      data_grounded: false,
    });
    expect(ctx.report?.execution_plan).toHaveLength(5);
  });

  it("defaults confidence to medium on invalid value", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    await exec("finalize_summary", {
      summary: "x",
      execution_plan: [],
      key_findings: [],
      risks: [],
      next_actions: [],
      confidence: "extremely-very-high",
      data_grounded: false,
    });
    expect(ctx.report?.confidence).toBe("medium");
  });

  it("coerces non-array fields to empty arrays", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    await exec("finalize_summary", {
      summary: "x",
      execution_plan: "not an array",
      key_findings: 42,
      risks: null,
      next_actions: { bad: true },
      confidence: "low",
      data_grounded: false,
    });
    expect(ctx.report?.execution_plan).toEqual([]);
    expect(ctx.report?.key_findings).toEqual([]);
    expect(ctx.report?.risks).toEqual([]);
    expect(ctx.report?.next_actions).toEqual([]);
  });
});

describe("trace + cap behaviour", () => {
  it("records each tool call in ctx.trace", async () => {
    storeMemoryMock.mockResolvedValue(true);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    await exec("store_plan_outcome", { outcome: "a" });
    await exec("store_plan_outcome", { outcome: "b" });
    expect(ctx.trace).toHaveLength(2);
  });

  it("caps trace at 50 entries (Wave 114 L4 invariant)", async () => {
    storeMemoryMock.mockResolvedValue(true);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    for (let i = 0; i < 80; i++) {
      await exec("store_plan_outcome", { outcome: `o-${i}` });
    }
    expect(ctx.trace.length).toBe(50);
  });

  it("returns sentinel for unknown tool and records the trace", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("nonexistent_tool", { x: 1 });
    expect(out).toMatch(/unknown tool/);
    expect(ctx.trace[0].tool).toBe("nonexistent_tool");
  });

  it("trace output strings are capped at 400 chars", async () => {
    outboundFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: "x".repeat(5000) }),
    });
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    await exec("call_agent", {
      agent: "leads",
      params: {},
      reason: "y",
    });
    expect(ctx.trace[0].output.length).toBeLessThanOrEqual(400);
  });
});
