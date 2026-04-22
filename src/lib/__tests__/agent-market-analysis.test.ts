/**
 * market-analysis route — smoke tests.
 *
 * Mocks ai() and research_ai() so tests don't hit NIM or Tavily.
 * Verifies happy path, research-failure degradation, and non-JSON error.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAi, mockResearch } = vi.hoisted(() => ({
  mockAi: vi.fn(),
  mockResearch: vi.fn(),
}));

vi.mock("@/lib/ai", () => ({
  ai: mockAi,
  research_ai: mockResearch,
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
  mockResearch.mockReset();
});

import { POST } from "@/app/api/_agents/market-analysis/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/market-analysis", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("market-analysis", () => {
  it("returns parsed analysis on happy path with research", async () => {
    mockResearch.mockResolvedValue("Market sized at $4.2B (Gartner 2025), growing at 18% YoY.");
    mockAi.mockResolvedValue(
      JSON.stringify({
        marketSize: { currentUsd: "US$4.2B (Gartner 2025)", growthRate: "18% YoY", horizon: "2026-2030" },
        keyTrends: ["AI agent adoption", "Vertical SaaS consolidation"],
        majorPlayers: [{ name: "Acme", positioning: "enterprise", estimatedShare: "12%" }],
        opportunities: ["mid-market underserved"],
        threats: ["consolidation risk"],
        recommendations: ["ship faster"],
        researchGrounded: true,
        confidence: "high",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ industry: "AI platforms", region: "North America" }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.analysis.marketSize.currentUsd).toMatch(/4\.2B/);
    expect(body.analysis.researchGrounded).toBe(true);
  });

  it("degrades gracefully when research fails", async () => {
    mockResearch.mockRejectedValue(new Error("tavily down"));
    mockAi.mockResolvedValue(
      JSON.stringify({
        marketSize: { currentUsd: null, growthRate: null, horizon: "unknown" },
        keyTrends: [],
        majorPlayers: [],
        opportunities: [],
        threats: [],
        recommendations: [],
        researchGrounded: false,
        confidence: "low",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ industry: "emerging quantum" }),
    );
    const body = await res.json();
    expect(body.analysis.researchGrounded).toBe(false);
    expect(body.analysis.confidence).toBe("low");
  });

  it("strips markdown fences from model output", async () => {
    mockResearch.mockResolvedValue("data");
    mockAi.mockResolvedValue(
      '```json\n{"marketSize":{"currentUsd":null,"growthRate":null,"horizon":"h"},"keyTrends":[],"majorPlayers":[],"opportunities":[],"threats":[],"recommendations":[],"researchGrounded":true,"confidence":"medium"}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ industry: "x" }),
    );
    const body = await res.json();
    expect(body.analysis.confidence).toBe("medium");
  });

  it("throws when model returns non-JSON", async () => {
    mockResearch.mockResolvedValue("data");
    mockAi.mockResolvedValue("sorry, I cannot answer that");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(req({ industry: "x" })),
    ).rejects.toThrow(/non-JSON/);
  });
});
