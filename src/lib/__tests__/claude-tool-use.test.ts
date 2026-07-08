/**
 * claudeToolUse loop tests — pins the BACKLOG M7 cost bounds:
 *   1. Individual tool results are capped at 20,000 chars on insertion.
 *   2. Tool results older than the 2 most recent tool-result turns are
 *      collapsed to a 300-char summary before the next API call.
 *
 * The Anthropic client is mocked; assertions inspect the `messages`
 * array each messages.create call receives.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/db", () => ({
  db: { query: { settings: { findFirst: vi.fn().mockResolvedValue(null) } } },
}));

vi.mock("@/db/schema", () => ({ settings: { userEmail: "userEmail" } }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));
vi.mock("@/lib/crypto", () => ({ safeDecrypt: vi.fn((v: string) => v) }));

vi.mock("@/lib/circuit-breaker", () => ({
  geminiBreaker: { execute: (fn: () => Promise<string>) => fn() },
  claudeBreaker: { execute: (fn: () => Promise<string>) => fn() },
  groqBreaker: { execute: (fn: () => Promise<string>) => fn() },
}));

vi.mock("@/lib/retry", () => ({
  withRetry: (fn: () => Promise<string>) => fn(),
}));

vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContent: vi.fn() };
    }
  },
}));

const mockClaudeCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockClaudeCreate };
  },
}));

vi.mock("groq-sdk", () => ({
  default: class MockGroq {
    chat = { completions: { create: vi.fn() } };
  },
}));

vi.mock("@/lib/nvidia", () => ({ nimChat: vi.fn() }));
vi.mock("@tavily/core", () => ({ tavily: vi.fn() }));

import { claudeToolUse } from "@/lib/ai";

const TOOLS = [
  { name: "probe", description: "probe a target", input_schema: {} },
];

/** A response that asks to run the `probe` tool once. */
function toolUseResponse(id: string) {
  return {
    stop_reason: "tool_use",
    content: [{ type: "tool_use", id, name: "probe", input: { step: id } }],
  };
}

const endTurnResponse = {
  stop_reason: "end_turn",
  content: [{ type: "text", text: "done" }],
};

type Msg = { role: string; content: unknown };

function toolResultContents(messages: Msg[]): string[] {
  return messages
    .filter((m) => m.role === "user" && Array.isArray(m.content))
    .flatMap((m) =>
      (m.content as Array<{ type: string; content: string }>)
        .filter((b) => b.type === "tool_result")
        .map((b) => b.content),
    );
}

beforeEach(() => {
  mockClaudeCreate.mockReset();
});

describe("claudeToolUse — M7 cost bounds", () => {
  it("caps a single oversized tool result at 20,000 chars", async () => {
    mockClaudeCreate
      .mockResolvedValueOnce(toolUseResponse("t1"))
      .mockResolvedValueOnce(endTurnResponse);

    const huge = "x".repeat(30_000);
    await claudeToolUse(
      "audit the target",
      TOOLS,
      undefined,
      4096,
      async () => huge,
    );

    // The 2nd create call sees the tool result from iteration 1.
    const secondCallMessages = mockClaudeCreate.mock.calls[1][0]
      .messages as Msg[];
    const results = toolResultContents(secondCallMessages);
    expect(results).toHaveLength(1);
    expect(results[0].length).toBeLessThan(21_000);
    expect(results[0]).toContain("[tool result capped");
  });

  it("collapses tool results older than the 2 most recent turns", async () => {
    mockClaudeCreate
      .mockResolvedValueOnce(toolUseResponse("t1"))
      .mockResolvedValueOnce(toolUseResponse("t2"))
      .mockResolvedValueOnce(toolUseResponse("t3"))
      .mockResolvedValueOnce(endTurnResponse);

    let call = 0;
    await claudeToolUse(
      "audit the target",
      TOOLS,
      undefined,
      4096,
      async () => {
        call += 1;
        return `result-${call}: ` + "y".repeat(5_000);
      },
    );

    // 4th create call sees 3 tool-result turns; the oldest must be
    // collapsed, the newest two intact.
    const fourthCallMessages = mockClaudeCreate.mock.calls[3][0]
      .messages as Msg[];
    const results = toolResultContents(fourthCallMessages);
    expect(results).toHaveLength(3);
    expect(results[0]).toContain("[tool result truncated");
    expect(results[0].length).toBeLessThan(400);
    expect(results[1]).not.toContain("[tool result truncated");
    expect(results[2]).not.toContain("[tool result truncated");
    expect(results[1].length).toBeGreaterThan(5_000);
  });

  it("keeps short tool results untouched", async () => {
    mockClaudeCreate
      .mockResolvedValueOnce(toolUseResponse("t1"))
      .mockResolvedValueOnce(toolUseResponse("t2"))
      .mockResolvedValueOnce(toolUseResponse("t3"))
      .mockResolvedValueOnce(endTurnResponse);

    await claudeToolUse(
      "audit the target",
      TOOLS,
      undefined,
      4096,
      async () => "short result",
    );

    const fourthCallMessages = mockClaudeCreate.mock.calls[3][0]
      .messages as Msg[];
    for (const content of toolResultContents(fourthCallMessages)) {
      expect(content).toBe("short result");
    }
  });

  it("still returns collected tool calls and final text", async () => {
    mockClaudeCreate
      .mockResolvedValueOnce(toolUseResponse("t1"))
      .mockResolvedValueOnce(endTurnResponse);

    const out = await claudeToolUse(
      "audit the target",
      TOOLS,
      undefined,
      4096,
      async () => "ok",
    );
    expect(out.text).toBe("done");
    expect(out.toolCalls).toEqual([{ name: "probe", input: { step: "t1" } }]);
  });
});
