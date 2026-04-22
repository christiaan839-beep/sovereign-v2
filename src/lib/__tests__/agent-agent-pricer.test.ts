/**
 * agent-pricer route smoke tests.
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

import { POST } from "@/app/api/_agents/agent-pricer/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/agent-pricer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("agent-pricer", () => {
  it("returns pricing recommendation on valid JSON from model", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        recommendedPriceCents: 150,
        pricingTiers: { basic: 75, verified: 150, premium: 225 },
        rationale: "70% creator margin after 30% platform fee and 10c compute cost.",
        marginAtRecommended: 0.63,
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ agentPurpose: "Extract invoices from PDFs", estimatedCostCents: 10 }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.recommendedPriceCents).toBeGreaterThan(0);
    expect(body.pricingTiers.premium).toBeGreaterThan(body.pricingTiers.basic);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"recommendedPriceCents":100,"pricingTiers":{"basic":50,"verified":100,"premium":150},"rationale":"x","marginAtRecommended":0.5}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ agentPurpose: "x", estimatedCostCents: 5 }),
    );
    const body = await res.json();
    expect(body.recommendedPriceCents).toBe(100);
  });

  it("accepts competitor price anchoring", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        recommendedPriceCents: 199,
        pricingTiers: { basic: 99, verified: 199, premium: 299 },
        rationale: "Anchored slightly below competitor median of 225c.",
        marginAtRecommended: 0.55,
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        agentPurpose: "Competitive agent",
        estimatedCostCents: 20,
        competitorPrices: [200, 225, 250],
      }),
    );
    const body = await res.json();
    expect(body.recommendedPriceCents).toBe(199);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("cannot price");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ agentPurpose: "x", estimatedCostCents: 5 }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
