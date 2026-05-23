/**
 * Wave-134 deep-think tool executor tests.
 *
 * deep-think is now a multi-step claudeToolUse orchestrator. The
 * actual Claude call needs the Anthropic SDK + an API key, so we
 * exercise the TOOL EXECUTOR in isolation — the same shape Claude
 * would invoke through claudeToolUse.
 *
 * Each test pins one tool's contract:
 *   - search_past_reasoning → vector-memory search + result formatting
 *   - decompose_problem     → ai() pipe-through with graceful errors
 *   - research_subproblem   → research_ai pipe-through with graceful errors
 *   - run_sub_reasoning     → Gemini Deep Think call with fallback
 *   - store_insight         → vector-memory write
 *   - finalize_solution     → mutates ctx.report + degraded shape
 *
 * The executor MUST NOT throw — Claude reads the error string from
 * the tool result and decides how to recover. A thrown executor
 * would abort the entire claudeToolUse loop.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  searchMemoryMock,
  storeMemoryMock,
  researchAiMock,
  aiMock,
  outboundFetchMock,
  budgetCheckpointMock,
} = vi.hoisted(() => ({
  searchMemoryMock: vi.fn(),
  storeMemoryMock: vi.fn(),
  researchAiMock: vi.fn(),
  aiMock: vi.fn(),
  outboundFetchMock: vi.fn(),
  budgetCheckpointMock: vi.fn(),
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
vi.mock("@/lib/ai", () => ({
  research_ai: researchAiMock,
  ai: aiMock,
  claudeToolUse: vi.fn(),
}));
vi.mock("@/lib/outbound-fetch", () => ({
  outboundFetchAsResponse: outboundFetchMock,
}));
vi.mock("@/lib/run-code", () => ({
  runCode: (code, opts) => {
    if (code === "throw new Error('boom')") {
      throw new Error("boom");
    }
    if (code === "2 + 2") {
      return {
        success: true,
        result: 4,
        stdout: "",
        durationMs: 1,
      };
    }
    return {
      success: true,
      result: undefined,
      stdout: "",
      durationMs: opts?.timeoutMs ?? 5,
    };
  },
  RUN_CODE_TOOL_DEF: {
    name: "run_code",
    description: "test",
    input_schema: { type: "object", properties: {}, required: [] },
  },
}));
vi.mock("@/lib/execution-budget", () => ({
  checkpoint: budgetCheckpointMock,
}));
vi.mock("@/lib/consensus", () => ({
  verifiedAi: vi.fn(),
}));
vi.mock("@/lib/agent-factory", () => ({
  createAgentRoute: (config: unknown) => config,
}));

import {
  buildToolExecutor,
  type DeepThinkContext,
} from "@/app/api/_agents/deep-think/route";

function freshCtx(): DeepThinkContext {
  return {
    userId: "user-test",
    problem: "How do we cut inference cost by 5×?",
    context: "",
    thinkingBudget: 4096,
    report: null,
    trace: [],
  };
}

beforeEach(() => {
  searchMemoryMock.mockReset();
  storeMemoryMock.mockReset();
  researchAiMock.mockReset();
  aiMock.mockReset();
  outboundFetchMock.mockReset();
  budgetCheckpointMock.mockReset();
  // Default Gemini key so the run_sub_reasoning tool takes the
  // Gemini path; individual tests override per case.
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = "gemini-test-key";
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GEMINI_API_KEY;
});

describe("search_past_reasoning", () => {
  it("returns the no-matches sentinel when memory is empty", async () => {
    searchMemoryMock.mockResolvedValue([]);
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("search_past_reasoning", { query: "cost cut" });
    expect(out).toMatch(/no prior reasoning matches/i);
  });

  it("formats matches with similarity + truncated content", async () => {
    searchMemoryMock.mockResolvedValue([
      {
        content: "Past insight A".repeat(60),
        agentName: "deep-think",
        similarity: 0.91,
        createdAt: new Date().toISOString(),
      },
      {
        content: "Past insight B",
        agentName: "deep-think",
        similarity: 0.78,
        createdAt: new Date().toISOString(),
      },
    ]);
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("search_past_reasoning", { query: "cost" });
    expect(out).toMatch(/<past_reasoning/);
    expect(out).toMatch(/rank="1"/);
    expect(out).toMatch(/rank="2"/);
    expect(out).toMatch(/similarity="0.910"/);
  });

  it("returns ERROR when query is missing", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("search_past_reasoning", {});
    expect(out).toMatch(/^ERROR/);
  });
});

describe("decompose_problem", () => {
  it("returns the NIM-generated decomposition", async () => {
    aiMock.mockResolvedValue("1. Cut API cost\n2. Self-host\n3. Cache");
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("decompose_problem", { problem: "Cut spend" });
    expect(out).toMatch(/1\. Cut API cost/);
    expect(aiMock).toHaveBeenCalledTimes(1);
  });

  it("falls back gracefully when NIM throws", async () => {
    aiMock.mockRejectedValue(new Error("nim down"));
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("decompose_problem", { problem: "x" });
    expect(out).toMatch(/decomposition unavailable/i);
  });

  it("returns ERROR when problem is missing", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("decompose_problem", {});
    expect(out).toMatch(/^ERROR/);
  });
});

describe("research_subproblem", () => {
  it("returns the truncated research output", async () => {
    researchAiMock.mockResolvedValue("x".repeat(5000));
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("research_subproblem", { query: "vllm cost" });
    expect(out.length).toBe(3000);
  });

  it("falls back when research throws", async () => {
    researchAiMock.mockRejectedValue(new Error("tavily down"));
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("research_subproblem", { query: "x" });
    expect(out).toMatch(/research unavailable/i);
  });

  it("returns ERROR when query is missing", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("research_subproblem", {});
    expect(out).toMatch(/^ERROR/);
  });
});

describe("run_sub_reasoning", () => {
  it("calls Gemini Deep Think and returns the combined parts text", async () => {
    outboundFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                { text: "Reasoning step 1." },
                { text: "Reasoning step 2." },
              ],
            },
          },
        ],
      }),
    });
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("run_sub_reasoning", {
      subproblem: "sub-A",
      context: "extra",
    });
    expect(out).toMatch(/Reasoning step 1/);
    expect(out).toMatch(/Reasoning step 2/);
    expect(budgetCheckpointMock).toHaveBeenCalledTimes(1);
  });

  it("returns degraded sentinel when no reasoner key is configured", async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("run_sub_reasoning", { subproblem: "sub-A" });
    expect(out).toMatch(/no reasoner key/i);
  });

  it("returns HTTP-error sentinel on non-2xx", async () => {
    outboundFetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "boom",
    });
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("run_sub_reasoning", { subproblem: "sub" });
    expect(out).toMatch(/Gemini 500/);
  });

  it("returns ERROR when subproblem is missing", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("run_sub_reasoning", {});
    expect(out).toMatch(/^ERROR/);
  });
});

describe("run_code", () => {
  it("returns a JSON-encoded result on success", async () => {
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

describe("store_insight", () => {
  it("writes via storeMemory and returns 'stored'", async () => {
    storeMemoryMock.mockResolvedValue(true);
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("store_insight", {
      insight: "API gateway sits at the hot path; cache there.",
      category: "strategy",
    });
    expect(out).toBe("stored");
    expect(storeMemoryMock).toHaveBeenCalledWith(
      "user-test",
      "deep-think",
      "API gateway sits at the hot path; cache there.",
      { category: "strategy", kind: "deep-think-insight" },
    );
  });

  it("returns 'store skipped' when storeMemory returns false", async () => {
    storeMemoryMock.mockResolvedValue(false);
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("store_insight", { insight: "x" });
    expect(out).toMatch(/store skipped/);
  });

  it("returns ERROR when insight is missing", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("store_insight", {});
    expect(out).toMatch(/^ERROR/);
  });
});

describe("finalize_solution", () => {
  it("mutates ctx.report with the structured 5-section solution", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("finalize_solution", {
      analysis: "Cost driven by inference at the edge.",
      approach: "Route through self-hosted vLLM with NIM fallback.",
      execution: ["Provision GPU", "Wire endpoint", "Roll out"],
      risks: ["GPU unavailable → use NIM fallback"],
      expected_outcome: "5× cost reduction at 100K calls/day.",
      confidence: "high",
      data_grounded: true,
    });
    expect(out).toMatch(/Solution finalized/);
    expect(ctx.report).not.toBeNull();
    expect(ctx.report?.confidence).toBe("high");
    expect(ctx.report?.execution.length).toBe(3);
    expect(ctx.report?.risks.length).toBe(1);
    expect(ctx.report?.data_grounded).toBe(true);
  });

  it("defaults confidence to medium when given an invalid value", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    await exec("finalize_solution", {
      analysis: "x",
      approach: "y",
      execution: [],
      risks: [],
      expected_outcome: "z",
      confidence: "extremely-very-high",
      data_grounded: false,
    });
    expect(ctx.report?.confidence).toBe("medium");
  });

  it("coerces non-array execution / risks to empty arrays", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    await exec("finalize_solution", {
      analysis: "x",
      approach: "y",
      execution: "not an array",
      risks: 42,
      expected_outcome: "z",
      confidence: "low",
      data_grounded: false,
    });
    expect(ctx.report?.execution).toEqual([]);
    expect(ctx.report?.risks).toEqual([]);
  });
});

describe("trace + cap behaviour", () => {
  it("records each tool call in ctx.trace", async () => {
    storeMemoryMock.mockResolvedValue(true);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    await exec("store_insight", { insight: "a" });
    await exec("store_insight", { insight: "b" });
    expect(ctx.trace.length).toBe(2);
    expect(ctx.trace[0].tool).toBe("store_insight");
  });

  it("caps the trace at 50 entries (Wave 114 L4 invariant)", async () => {
    storeMemoryMock.mockResolvedValue(true);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    for (let i = 0; i < 80; i++) {
      await exec("store_insight", { insight: `i-${i}` });
    }
    expect(ctx.trace.length).toBe(50);
  });

  it("returns a sentinel and records the call for an unknown tool", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("nonexistent_tool", { x: 1 });
    expect(out).toMatch(/unknown tool/);
    expect(ctx.trace[0].tool).toBe("nonexistent_tool");
  });
});
