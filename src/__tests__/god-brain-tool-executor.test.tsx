/**
 * Wave-155 god-brain tool executor tests.
 *
 * god-brain is now a multi-step claudeToolUse orchestrator. The
 * actual Claude call needs the Anthropic SDK + a key, so we test
 * the TOOL EXECUTOR in isolation — the same shape Claude would
 * invoke through claudeToolUse.
 *
 * Tools pinned:
 *   - search_past_god_brain    → memory recall + anon guard
 *   - run_safety_check         → NIM chat pass-through
 *   - run_analysis             → NIM strategist pass-through
 *   - run_deep_thinking        → Claude refine pass-through
 *   - make_embedding           → NIM embeddings success/failure
 *   - make_voice_script        → NIM voicechat
 *   - make_visual              → FLUX image gen
 *   - run_code                 → sandbox JSON envelope
 *   - store_god_brain_outcome  → memory write + anon guard
 *   - finalize_intelligence    → mutates ctx.report + merge accumulated
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { searchMemoryMock, storeMemoryMock, aiMock, outboundFetchMock } =
  vi.hoisted(() => ({
    searchMemoryMock: vi.fn(),
    storeMemoryMock: vi.fn(),
    aiMock: vi.fn(),
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
vi.mock("@/lib/ai", () => ({
  ai: aiMock,
  claudeToolUse: vi.fn(),
}));
vi.mock("@/lib/outbound-fetch", () => ({
  outboundFetchAsResponse: outboundFetchMock,
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
  type GodBrainContext,
} from "@/app/api/_agents/god-brain/route";

function freshCtx(over: Partial<GodBrainContext> = {}): GodBrainContext {
  return {
    userId: "user-test",
    rawInput: "Analyze acme.com",
    depth: "standard",
    results: {},
    timings: {},
    report: null,
    trace: [],
    ...over,
  };
}

beforeEach(() => {
  searchMemoryMock.mockReset();
  storeMemoryMock.mockReset();
  aiMock.mockReset();
  outboundFetchMock.mockReset();
  process.env.NVIDIA_NIM_API_KEY = "nim-test-key";
});

describe("search_past_god_brain", () => {
  it("returns no-matches sentinel when memory is empty", async () => {
    searchMemoryMock.mockResolvedValue([]);
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("search_past_god_brain", { query: "acme" });
    expect(out).toMatch(/no prior god-brain runs/i);
  });

  it("formats matches with similarity + truncated content", async () => {
    searchMemoryMock.mockResolvedValue([
      {
        content: "Past intelligence on acme".repeat(20),
        agentName: "god-brain",
        similarity: 0.91,
        createdAt: new Date().toISOString(),
      },
    ]);
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("search_past_god_brain", { query: "acme" });
    expect(out).toMatch(/<past_run/);
    expect(out).toMatch(/similarity="0.910"/);
  });

  it("returns memory-disabled sentinel for anon userId", async () => {
    const exec = buildToolExecutor(freshCtx({ userId: "anon" }));
    const out = await exec("search_past_god_brain", { query: "x" });
    expect(out).toMatch(/Memory disabled/);
    expect(searchMemoryMock).not.toHaveBeenCalled();
  });

  it("returns ERROR when query is missing", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("search_past_god_brain", {});
    expect(out).toMatch(/^ERROR/);
  });
});

describe("run_safety_check", () => {
  it("stores the verdict on ctx.results and returns it", async () => {
    outboundFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Content is safe." } }],
      }),
    });
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("run_safety_check", { text: "hello" });
    expect(out).toBe("Content is safe.");
    expect(ctx.results.safety).toBe("Content is safe.");
    expect(typeof ctx.timings.safety_ms).toBe("number");
  });

  it("returns ERROR when text is missing", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("run_safety_check", {});
    expect(out).toMatch(/^ERROR/);
  });

  it("returns 'Safety check unavailable' on NIM non-ok", async () => {
    outboundFetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("run_safety_check", { text: "x" });
    expect(out).toMatch(/Safety check unavailable/);
  });
});

describe("run_analysis", () => {
  it("stores analysis on ctx.results and returns it", async () => {
    outboundFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          { message: { content: "Key insight: acme is undervalued." } },
        ],
      }),
    });
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("run_analysis", { text: "Analyze acme.com" });
    expect(out).toMatch(/undervalued/);
    expect(ctx.results.analysis).toMatch(/undervalued/);
  });

  it("uses deep max_tokens when deep=true", async () => {
    outboundFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    const exec = buildToolExecutor(freshCtx({ depth: "deep" }));
    await exec("run_analysis", { text: "x", deep: true });
    const sentBody = JSON.parse(
      String((outboundFetchMock.mock.calls[0]![1] as { body: string }).body),
    );
    expect(sentBody.max_tokens).toBe(1500);
  });

  it("returns ERROR when text is missing", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("run_analysis", {});
    expect(out).toMatch(/^ERROR/);
  });
});

describe("run_deep_thinking", () => {
  it("calls ai() with model:claude + thinking:true", async () => {
    aiMock.mockResolvedValue("[CORRECTION] Refined analysis here.");
    const ctx = freshCtx({ depth: "deep" });
    const exec = buildToolExecutor(ctx);
    const out = await exec("run_deep_thinking", {
      preliminary: "Initial analysis",
      original_input: "acme.com",
    });
    expect(out).toMatch(/CORRECTION/);
    expect(ctx.results.deepThinking).toMatch(/CORRECTION/);
    const call = aiMock.mock.calls[0]![1] as {
      model?: string;
      thinking?: boolean;
      useOpus?: boolean;
    };
    expect(call.model).toBe("claude");
    expect(call.thinking).toBe(true);
    expect(call.useOpus).toBe(false);
  });

  it("returns ERROR when preliminary is missing", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("run_deep_thinking", {});
    expect(out).toMatch(/^ERROR/);
  });

  it("falls back gracefully when Claude throws", async () => {
    aiMock.mockRejectedValue(new Error("no Anthropic key"));
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("run_deep_thinking", { preliminary: "x" });
    expect(out).toMatch(/Deep thinking unavailable/);
    expect(ctx.results.deepThinking).toMatch(/Extended thinking unavailable/);
  });
});

describe("make_embedding", () => {
  it("returns dimensions + preview on success", async () => {
    outboundFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7] }],
      }),
    });
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("make_embedding", { text: "x" });
    const parsed = JSON.parse(out);
    expect(parsed.dimensions).toBe(7);
    expect(parsed.preview).toHaveLength(5);
    expect(ctx.results.embedding).toEqual(
      expect.objectContaining({ dimensions: 7, ready: true }),
    );
  });

  it("marks embedding not-ready on HTTP failure", async () => {
    outboundFetchMock.mockResolvedValue({ ok: false, status: 502 });
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("make_embedding", { text: "x" });
    expect(out).toMatch(/Embedding failed: HTTP 502/);
    expect(ctx.results.embedding).toEqual({ ready: false });
  });

  it("returns ERROR when text is missing", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("make_embedding", {});
    expect(out).toMatch(/^ERROR/);
  });

  it("returns ERROR when NVIDIA_NIM_API_KEY is unset", async () => {
    delete process.env.NVIDIA_NIM_API_KEY;
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("make_embedding", { text: "x" });
    expect(out).toMatch(/NVIDIA_NIM_API_KEY not configured/);
  });
});

describe("make_voice_script", () => {
  it("stores the script on ctx.results and returns it", async () => {
    outboundFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hey there — quick pitch." } }],
      }),
    });
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("make_voice_script", { source_text: "analysis" });
    expect(out).toMatch(/quick pitch/);
    expect(ctx.results.voiceScript).toMatch(/quick pitch/);
  });

  it("returns ERROR when source_text is missing", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("make_voice_script", {});
    expect(out).toMatch(/^ERROR/);
  });
});

describe("make_visual", () => {
  it("stores visual url on success", async () => {
    outboundFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ url: "https://cdn.example/x.png" }],
      }),
    });
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("make_visual", { prompt: "infographic" });
    const parsed = JSON.parse(out);
    expect(parsed.generated).toBe(true);
    expect(parsed.url).toBe("https://cdn.example/x.png");
    expect(ctx.results.visual).toEqual({
      generated: true,
      url: "https://cdn.example/x.png",
    });
  });

  it("marks not-generated on HTTP failure", async () => {
    outboundFetchMock.mockResolvedValue({ ok: false, status: 503 });
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("make_visual", { prompt: "x" });
    expect(out).toMatch(/Visual gen failed/);
    expect(ctx.results.visual).toEqual({ generated: false });
  });

  it("returns ERROR when prompt is missing", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("make_visual", {});
    expect(out).toMatch(/^ERROR/);
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

  it("captures runCode throws without aborting", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("run_code", { code: "throw new Error('boom')" });
    expect(out).toMatch(/run_code threw/);
  });
});

describe("store_god_brain_outcome", () => {
  it("writes via storeMemory and returns 'stored'", async () => {
    storeMemoryMock.mockResolvedValue(true);
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("store_god_brain_outcome", {
      outcome: "acme has 3 weak SEO competitors",
    });
    expect(out).toBe("stored");
    expect(storeMemoryMock).toHaveBeenCalledWith(
      "user-test",
      "god-brain",
      "acme has 3 weak SEO competitors",
      { kind: "god-brain-outcome" },
    );
  });

  it("returns memory-disabled for anon userId", async () => {
    const exec = buildToolExecutor(freshCtx({ userId: "anon" }));
    const out = await exec("store_god_brain_outcome", { outcome: "x" });
    expect(out).toMatch(/Memory disabled/);
  });

  it("returns ERROR when outcome is missing", async () => {
    const exec = buildToolExecutor(freshCtx());
    const out = await exec("store_god_brain_outcome", {});
    expect(out).toMatch(/^ERROR/);
  });
});

describe("finalize_intelligence", () => {
  it("mutates ctx.report and merges accumulated results", async () => {
    const ctx = freshCtx();
    ctx.results.safety = "Safe.";
    ctx.results.analysis = "Insight: …";
    const exec = buildToolExecutor(ctx);
    const out = await exec("finalize_intelligence", {
      intelligence: { extra: "claude-supplied" },
      models_used: ["nemotron-3-super-120b"],
      notes: "Skipped voice + visual",
      data_grounded: true,
    });
    expect(out).toMatch(/Intelligence finalized/);
    expect(ctx.report).not.toBeNull();
    expect(ctx.report?.intelligence).toEqual(
      expect.objectContaining({
        safety: "Safe.",
        analysis: "Insight: …",
        extra: "claude-supplied",
      }),
    );
    expect(ctx.report?.modelsUsed).toContain("nemotron-3-super-120b");
    expect(ctx.report?.data_grounded).toBe(true);
  });

  it("clamps models_used at 16", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const huge = Array.from({ length: 50 }, (_, i) => `m-${i}`);
    await exec("finalize_intelligence", {
      intelligence: {},
      models_used: huge,
      notes: "",
      data_grounded: false,
    });
    expect(ctx.report?.modelsUsed.length).toBe(16);
  });

  it("coerces non-object intelligence to empty object", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    await exec("finalize_intelligence", {
      intelligence: "not an object",
      models_used: [],
      notes: "",
      data_grounded: false,
    });
    expect(ctx.report?.intelligence).toEqual({});
  });
});

describe("trace + cap behaviour", () => {
  it("records each tool call in ctx.trace", async () => {
    storeMemoryMock.mockResolvedValue(true);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    await exec("store_god_brain_outcome", { outcome: "a" });
    await exec("store_god_brain_outcome", { outcome: "b" });
    expect(ctx.trace).toHaveLength(2);
  });

  it("caps trace at 50 entries (Wave 114 L4 invariant)", async () => {
    storeMemoryMock.mockResolvedValue(true);
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    for (let i = 0; i < 80; i++) {
      await exec("store_god_brain_outcome", { outcome: `o-${i}` });
    }
    expect(ctx.trace.length).toBe(50);
  });

  it("returns sentinel for unknown tool + records trace", async () => {
    const ctx = freshCtx();
    const exec = buildToolExecutor(ctx);
    const out = await exec("nonexistent_tool", { x: 1 });
    expect(out).toMatch(/unknown tool/);
    expect(ctx.trace[0].tool).toBe("nonexistent_tool");
  });
});
