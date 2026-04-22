/**
 * expense-categorizer route smoke tests.
 *
 * Mocks `ai()` and `createAgentRoute` to test the handler in isolation.
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

import { POST } from "@/app/api/_agents/expense-categorizer/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/expense-categorizer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("expense-categorizer", () => {
  it("classifies a clear business charge", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        category: "Advertising",
        subcategory: "Digital ads",
        deductibleLikely: true,
        confidence: 0.92,
        rationale: "Facebook Ads is a standard paid-marketing cost.",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ transaction: "FACEBOOK ADS * 3498 $199.00" }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.category).toBe("Advertising");
    expect(body.result.deductibleLikely).toBe(true);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"category":"Office Expense","subcategory":"Supplies","deductibleLikely":true,"confidence":0.8,"rationale":"stationery"}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ transaction: "STAPLES #1234 $45.12" }),
    );
    const body = await res.json();
    expect(body.result.category).toBe("Office Expense");
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("I cannot confidently categorize this.");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ transaction: "??? UNKNOWN CHARGE ???" }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
