/**
 * Tests for runWithTools() — the Cook 36 tool-use loop on super-agent.
 *
 * Locks the contracts that make multi-turn tool use safe:
 *
 *   - System prompt injects the registry's tool-list block verbatim.
 *   - Model output is parsed as a tool-call envelope (never trusted
 *     as raw text). Unparseable output → "no-tool-call-parse" outcome
 *     with the raw model output as a fallback for the caller.
 *   - Terminal turn (toolCalls=[], finalAnswer present) exits cleanly.
 *   - Tool calls are dispatched IN PARALLEL via Promise.all on a
 *     given step (latency win — 3 tool calls of 40ms each ≈ 40ms,
 *     not 120ms).
 *   - maxSteps cap is hard: a model in an infinite tool loop hits
 *     the limit and exits with outcome="max-steps".
 *   - Receipt-relevant: every step's modelOutput + toolCalls +
 *     toolResults are preserved in `steps[]`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

vi.mock("../ai", () => ({
  ai: vi.fn(),
}));

import { ai } from "../ai";
import { ToolRegistry, type ToolDefinition } from "../tool-registry";
import { runWithTools, type ToolAgentSpec } from "../super-agent";

const aiMock = vi.mocked(ai);

function makeEchoTool(): ToolDefinition<{ msg: string }, { echoed: string }> {
  return {
    name: "echo",
    description: "Echo the supplied message back.",
    inputSchema: z.object({ msg: z.string().min(1).max(200) }),
    tier: 1,
    execute: async (input) => ({ echoed: input.msg.toUpperCase() }),
  };
}

function makeSpec(
  registry: ToolRegistry,
  overrides: Partial<ToolAgentSpec> = {},
): ToolAgentSpec {
  return {
    agentSlug: "test-tool-agent",
    systemPrompt: "You are a tool-using test agent.",
    registry,
    toolContext: {
      userId: "user-1",
      tenantId: "tenant-1",
      agentSlug: "test-tool-agent",
    },
    ...overrides,
  };
}

beforeEach(() => {
  aiMock.mockReset();
});

describe("runWithTools — single-step terminal answer", () => {
  it("returns outcome=answer when the model emits an empty toolCalls + finalAnswer", async () => {
    const registry = new ToolRegistry().register(makeEchoTool());
    aiMock.mockResolvedValueOnce(
      JSON.stringify({ toolCalls: [], finalAnswer: "Done." }),
    );
    const result = await runWithTools("Hi", makeSpec(registry));
    expect(result.outcome).toBe("answer");
    expect(result.finalAnswer).toBe("Done.");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].toolCalls).toEqual([]);
  });
});

describe("runWithTools — multi-step tool dispatch", () => {
  it("dispatches a tool call, feeds the result back, then accepts the final answer", async () => {
    const registry = new ToolRegistry().register(makeEchoTool());

    aiMock.mockResolvedValueOnce(
      JSON.stringify({
        toolCalls: [{ name: "echo", args: { msg: "hello" } }],
      }),
    );
    aiMock.mockResolvedValueOnce(
      JSON.stringify({ toolCalls: [], finalAnswer: "Echoed: HELLO" }),
    );

    const result = await runWithTools("Echo 'hello'", makeSpec(registry));

    expect(result.outcome).toBe("answer");
    expect(result.finalAnswer).toBe("Echoed: HELLO");
    expect(result.steps).toHaveLength(2);

    const firstStep = result.steps[0];
    expect(firstStep.toolCalls).toHaveLength(1);
    expect(firstStep.toolCalls[0].name).toBe("echo");
    expect(firstStep.toolResults).toHaveLength(1);
    expect(firstStep.toolResults[0].outcome).toBe("ok");
  });

  it("dispatches tool calls in parallel on a single step (latency win)", async () => {
    const registry = new ToolRegistry();
    registry.register({
      name: "slow_echo",
      description: "Slow echo.",
      inputSchema: z.object({ msg: z.string() }),
      tier: 1,
      execute: async (input) => {
        await new Promise((r) => setTimeout(r, 40));
        return { msg: input.msg };
      },
    });

    aiMock.mockResolvedValueOnce(
      JSON.stringify({
        toolCalls: [
          { name: "slow_echo", args: { msg: "a" } },
          { name: "slow_echo", args: { msg: "b" } },
          { name: "slow_echo", args: { msg: "c" } },
        ],
      }),
    );
    aiMock.mockResolvedValueOnce(
      JSON.stringify({ toolCalls: [], finalAnswer: "done" }),
    );

    const start = Date.now();
    await runWithTools("3 echoes", makeSpec(registry));
    const elapsed = Date.now() - start;

    // 3 calls of 40ms each: sequential ≈ 120ms+, parallel ≈ 40ms+.
    expect(elapsed).toBeLessThan(110);
  });

  it("respects maxSteps and exits with outcome=max-steps when the model loops", async () => {
    const registry = new ToolRegistry().register(makeEchoTool());

    aiMock.mockResolvedValue(
      JSON.stringify({
        toolCalls: [{ name: "echo", args: { msg: "loop" } }],
      }),
    );

    const result = await runWithTools(
      "loop forever",
      makeSpec(registry, { maxSteps: 3 }),
    );

    expect(result.outcome).toBe("max-steps");
    expect(result.finalAnswer).toBe("");
    expect(result.steps).toHaveLength(3);
  });
});

describe("runWithTools — error paths", () => {
  it("returns outcome=no-tool-call-parse when the model output isn't an envelope", async () => {
    const registry = new ToolRegistry().register(makeEchoTool());
    aiMock.mockResolvedValueOnce("Just plain text, no JSON.");
    const result = await runWithTools("Hi", makeSpec(registry));
    expect(result.outcome).toBe("no-tool-call-parse");
    expect(result.finalAnswer).toBe("Just plain text, no JSON.");
  });

  it("preserves a tool-call-result of unknown-tool in the step record", async () => {
    const registry = new ToolRegistry();
    aiMock.mockResolvedValueOnce(
      JSON.stringify({
        toolCalls: [{ name: "echo", args: { msg: "hello" } }],
      }),
    );
    aiMock.mockResolvedValueOnce(
      JSON.stringify({ toolCalls: [], finalAnswer: "Fallback." }),
    );
    const result = await runWithTools("Hi", makeSpec(registry));

    expect(result.steps[0].toolResults[0].outcome).toBe("unknown-tool");
    expect(result.finalAnswer).toBe("Fallback.");
  });

  it("preserves an input-invalid result in the step record (model gets to retry)", async () => {
    const registry = new ToolRegistry().register(makeEchoTool());
    aiMock.mockResolvedValueOnce(
      JSON.stringify({
        toolCalls: [{ name: "echo", args: { msg: "x".repeat(500) } }],
      }),
    );
    aiMock.mockResolvedValueOnce(
      JSON.stringify({
        toolCalls: [{ name: "echo", args: { msg: "fixed" } }],
      }),
    );
    aiMock.mockResolvedValueOnce(
      JSON.stringify({ toolCalls: [], finalAnswer: "done" }),
    );

    const result = await runWithTools("Echo something", makeSpec(registry));

    expect(result.outcome).toBe("answer");
    expect(result.steps[0].toolResults[0].outcome).toBe("input-invalid");
    expect(result.steps[1].toolResults[0].outcome).toBe("ok");
  });
});

describe("runWithTools — system prompt composition", () => {
  it("appends the registry's tool-list block to the caller's systemPrompt", async () => {
    const registry = new ToolRegistry().register(makeEchoTool());
    aiMock.mockResolvedValueOnce(
      JSON.stringify({ toolCalls: [], finalAnswer: "ok" }),
    );

    await runWithTools(
      "anything",
      makeSpec(registry, { systemPrompt: "CALLER_PROMPT" }),
    );

    expect(aiMock).toHaveBeenCalledOnce();
    const call = aiMock.mock.calls[0];
    const system = call[1]?.system as string;
    expect(system).toContain("CALLER_PROMPT");
    expect(system).toContain("─── TOOL USE ───");
    expect(system).toContain("- echo");
    expect(system).toContain("toolCalls");
    expect(system).toContain("finalAnswer");
  });
});
