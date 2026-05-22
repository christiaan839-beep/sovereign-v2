/**
 * Tests for src/lib/eval-llm-judge.ts — Wave 150.
 *
 * Pure-parsing tests over `parseJudgeOutput`. The LLM call itself
 * is smoke-tested via the failure sentinel path.
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

const nimChatMock = vi.fn();
vi.mock("@/lib/nvidia", () => ({
  nimChat: (...args: unknown[]) => nimChatMock(...args),
}));

import { parseJudgeOutput, llmJudge } from "@/lib/eval-llm-judge";

describe("parseJudgeOutput — strict JSON path", () => {
  it("parses well-formed JSON", () => {
    const r = parseJudgeOutput('{"score": 0.82, "rationale": "good"}');
    expect(r.score).toBeCloseTo(0.82, 4);
    expect(r.rationale).toBe("good");
    expect(r.failed).toBe(false);
  });

  it("strips ```json fences", () => {
    const r = parseJudgeOutput('```json\n{"score":0.5,"rationale":"x"}\n```');
    expect(r.score).toBe(0.5);
    expect(r.failed).toBe(false);
  });

  it("strips bare ``` fences", () => {
    const r = parseJudgeOutput('```\n{"score":0.7,"rationale":"r"}\n```');
    expect(r.score).toBeCloseTo(0.7, 4);
  });

  it("clamps score to [0, 1]", () => {
    expect(parseJudgeOutput('{"score": 1.5, "rationale": "x"}').score).toBe(1);
    expect(parseJudgeOutput('{"score": -0.2, "rationale": "x"}').score).toBe(0);
  });

  it("returns 0.5 sentinel on empty input", () => {
    const r = parseJudgeOutput("");
    expect(r.score).toBe(0.5);
    expect(r.failed).toBe(true);
  });

  it("returns 0.5 sentinel on null score field", () => {
    const r = parseJudgeOutput('{"score": null, "rationale": "x"}');
    expect(r.failed).toBe(true);
  });

  it("truncates rationale at 240 chars", () => {
    const long = "x".repeat(500);
    const r = parseJudgeOutput(`{"score":0.5,"rationale":"${long}"}`);
    expect(r.rationale.length).toBe(240);
  });
});

describe("parseJudgeOutput — greedy fallback", () => {
  it("extracts 0.x number from prose", () => {
    const r = parseJudgeOutput("My score is 0.73. The answer is solid.");
    expect(r.score).toBeCloseTo(0.73, 4);
    expect(r.failed).toBe(false);
  });

  it("handles 1.0 / 1 edge", () => {
    expect(parseJudgeOutput("Score: 1.0 — perfect.").score).toBe(1);
    expect(parseJudgeOutput("score = 1").score).toBe(1);
  });

  it("returns 0.5 sentinel when no number found", () => {
    const r = parseJudgeOutput("This response was acceptable overall.");
    expect(r.score).toBe(0.5);
    expect(r.failed).toBe(true);
  });

  it("ignores numbers > 1 in fallback", () => {
    const r = parseJudgeOutput("There were 42 issues, no clear score given.");
    expect(r.score).toBe(0.5); // 42 doesn't match the 0.x|1.0|1 regex
    expect(r.failed).toBe(true);
  });
});

describe("llmJudge — NIM call path", () => {
  it("returns 0 for empty output (cheap guard)", async () => {
    const r = await llmJudge("query", "", "audit");
    expect(r).toBe(0);
    expect(nimChatMock).not.toHaveBeenCalled();
  });

  it("returns the parsed score on happy NIM response", async () => {
    nimChatMock.mockResolvedValueOnce('{"score":0.88,"rationale":"strong"}');
    const r = await llmJudge("query", "ok ".repeat(60), "audit");
    expect(r).toBeCloseTo(0.88, 4);
  });

  it("returns 0.5 sentinel when NIM throws", async () => {
    nimChatMock.mockRejectedValueOnce(new Error("nim down"));
    const r = await llmJudge("query", "x".repeat(80), "audit");
    expect(r).toBe(0.5);
  });

  it("returns 0.5 sentinel on unparseable LLM output", async () => {
    nimChatMock.mockResolvedValueOnce("I am an LLM and refuse to grade.");
    const r = await llmJudge("query", "x".repeat(80), "audit");
    expect(r).toBe(0.5);
  });

  it("truncates input + output before sending to NIM", async () => {
    nimChatMock.mockResolvedValueOnce('{"score":0.5,"rationale":"x"}');
    await llmJudge("a".repeat(5000), "b".repeat(20000), "audit");
    const sentMessages = nimChatMock.mock.calls[0]![1] as Array<{
      role: string;
      content: string;
    }>;
    const userMsg = sentMessages.find((m) => m.role === "user")!;
    // User prompt should be much shorter than 25K
    expect(userMsg.content.length).toBeLessThan(6000);
  });
});
