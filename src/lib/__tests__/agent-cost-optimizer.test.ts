/**
 * cost-optimizer route smoke tests.
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

import { POST } from "@/app/api/_agents/cost-optimizer/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/cost-optimizer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("cost-optimizer", () => {
  it("returns parsed recommendation on valid JSON", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        recommendedModel: "nemotron-ultra-253b-v1",
        alternativeModels: ["deepseek-v3.2", "claude-sonnet"],
        estimatedCostCents: 0.3,
        estimatedLatencyMs: 600,
        rationale: "Structured extraction at 'verified' quality — Nemotron Ultra matches Claude Sonnet at 1/3000th the cost.",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ taskDescription: "Extract structured data from invoice text", qualityRequirement: "verified" }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.recommendation.recommendedModel).toBe("nemotron-ultra-253b-v1");
    expect(body.recommendation.alternativeModels.length).toBeGreaterThan(0);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"recommendedModel":"x","alternativeModels":[],"estimatedCostCents":0,"estimatedLatencyMs":0,"rationale":""}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ taskDescription: "t", qualityRequirement: "basic" }),
    );
    const body = await res.json();
    expect(body.recommendation.recommendedModel).toBe("x");
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("no can do");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ taskDescription: "t", qualityRequirement: "basic" }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
