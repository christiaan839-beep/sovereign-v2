/**
 * agent-reviewer route smoke tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAi } = vi.hoisted(() => ({ mockAi: vi.fn() }));

vi.mock("@/lib/ai", () => ({
  ai: mockAi,
  research_ai: vi.fn(),
}));

vi.mock("@/lib/agent-factory", () => ({
  createAgentRoute: (opts: { handler: (args: { input: unknown }) => Promise<unknown> }) => {
    return async (req: Request) => {
      const input = await req.json();
      const out = await opts.handler({ input });
      return new Response(JSON.stringify(out), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
  },
}));

beforeEach(() => {
  mockAi.mockReset();
});

import { POST } from "@/app/api/_agents/agent-reviewer/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/agent-reviewer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("agent-reviewer", () => {
  it("returns parsed review on valid JSON", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        overallScore: 82,
        strengths: ["consistent JSON output", "no hallucinations"],
        weaknesses: ["occasionally drops the 'currency' field"],
        suggestedPromptChanges: ["Add: 'currency is REQUIRED — never omit, use ISO 4217.'"],
        suggestedModelChange: null,
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        agentSlug: "invoice-extractor",
        sampleOutputs: ["{...}", "{...}", "{...}"],
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.review.overallScore).toBe(82);
    expect(body.review.suggestedPromptChanges).toHaveLength(1);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"overallScore":50,"strengths":[],"weaknesses":["x"],"suggestedPromptChanges":[],"suggestedModelChange":null}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ agentSlug: "x", sampleOutputs: ["a"] }),
    );
    const body = await res.json();
    expect(body.review.overallScore).toBe(50);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("I can't do that");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ agentSlug: "x", sampleOutputs: ["a"] }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
