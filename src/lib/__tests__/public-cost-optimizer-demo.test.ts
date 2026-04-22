/**
 * /api/public/cost-optimizer-demo — tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAi } = vi.hoisted(() => ({ mockAi: vi.fn() }));

vi.mock("@/lib/ai", () => ({ ai: mockAi }));

beforeEach(() => {
  mockAi.mockReset();
});

import { POST } from "@/app/api/public/cost-optimizer-demo/route";

function req(body: unknown): Request {
  return new Request("http://l/api/public/cost-optimizer-demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/public/cost-optimizer-demo", () => {
  it("returns recommendation on happy path", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        recommendedModel: "nvidia/nemotron-70b",
        estimatedCostCentsPerMillion: 100,
        estimatedLatencyMs: 720,
        alternativeModels: [
          { name: "groq/llama-3.3-70b", costCentsPerMillion: 80, latencyMs: 250, rationale: "Fastest option" },
        ],
        rationale: "Task is structured extraction — open-source Nemotron matches quality at 1/75 the cost of Opus.",
        savingsVsClaudeOpus: { percent: 98.7, absolute: "~$74 saved per 1M tokens" },
      }),
    );
    const res = await POST(
      req({
        taskDescription: "Extract structured data from invoice PDFs with vendor and line items",
        qualityRequirement: "basic",
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.recommendation.recommendedModel).toBe("nvidia/nemotron-70b");
    expect(body.recommendation.savingsVsClaudeOpus.percent).toBeGreaterThan(90);
  });

  it("strips markdown fences", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"recommendedModel":"x","estimatedCostCentsPerMillion":0,"estimatedLatencyMs":0,"alternativeModels":[],"rationale":"r","savingsVsClaudeOpus":{"percent":0,"absolute":"none"}}\n```',
    );
    const res = await POST(
      req({
        taskDescription: "A generic task for testing the fence strip behavior correctly",
        qualityRequirement: "basic",
      }),
    );
    const body = await res.json();
    expect(body.recommendation.recommendedModel).toBe("x");
  });

  it("returns 400 for task under 20 chars", async () => {
    const res = await POST(req({ taskDescription: "too short", qualityRequirement: "basic" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for task over 400 chars", async () => {
    const res = await POST(req({ taskDescription: "a".repeat(401), qualityRequirement: "basic" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid qualityRequirement", async () => {
    const res = await POST(
      req({
        taskDescription: "A valid task description of sufficient length for the test",
        qualityRequirement: "deluxe",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing fields", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("returns 503 when model output unparseable", async () => {
    mockAi.mockResolvedValue("I can't optimize that task");
    const res = await POST(
      req({
        taskDescription: "A reasonable task description for the cost optimizer to analyze",
        qualityRequirement: "basic",
      }),
    );
    expect(res.status).toBe(503);
  });

  it("returns 503 when ai() throws", async () => {
    mockAi.mockRejectedValue(new Error("Claude offline"));
    const res = await POST(
      req({
        taskDescription: "A reasonable task description for the cost optimizer to analyze",
        qualityRequirement: "basic",
      }),
    );
    expect(res.status).toBe(503);
  });

  it("sets no-store cache header", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        recommendedModel: "x",
        estimatedCostCentsPerMillion: 0,
        estimatedLatencyMs: 0,
        alternativeModels: [],
        rationale: "r",
        savingsVsClaudeOpus: { percent: 0, absolute: "none" },
      }),
    );
    const res = await POST(
      req({
        taskDescription: "A reasonable task for the cache header test to verify correctly",
        qualityRequirement: "basic",
      }),
    );
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
