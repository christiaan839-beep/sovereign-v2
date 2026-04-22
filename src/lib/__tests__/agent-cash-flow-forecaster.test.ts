/**
 * cash-flow-forecaster route smoke tests.
 *
 * We mock `ai()` and verify:
 *   1. Happy path — valid JSON projection is returned in `forecast`.
 *   2. Markdown-fence stripping.
 *   3. Horizon clamping (request > 180 still produces a valid forecast).
 *   4. Error path — non-JSON model output throws.
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

import { POST } from "@/app/api/_agents/cash-flow-forecaster/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/cash-flow-forecaster", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("cash-flow-forecaster", () => {
  it("returns parsed forecast on valid JSON from model", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        projection: [
          { date: "2026-05-01", expectedBalance: 10000, inflow: 5000, outflow: 3000 },
        ],
        bestCase: 15000,
        likelyCase: 10000,
        worstCase: 4000,
        risks: ["June payroll cycle may tighten cash if Q2 receipts delay"],
        recommendations: ["Invoice top 3 customers on net-15 instead of net-30"],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        transactions: [
          { date: "2026-04-01", amount: 5000, category: "rent", recurring: true },
          { date: "2026-04-05", amount: -12000, category: "sales" },
        ],
        startingBalance: 8000,
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.forecast.likelyCase).toBe(10000);
    expect(body.forecast.projection[0].expectedBalance).toBe(10000);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"projection":[],"bestCase":0,"likelyCase":0,"worstCase":0,"risks":[],"recommendations":[]}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ transactions: [] }),
    );
    const body = await res.json();
    expect(body.forecast.likelyCase).toBe(0);
  });

  it("accepts out-of-range horizon without crashing (clamps internally)", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        projection: [],
        bestCase: 1,
        likelyCase: 1,
        worstCase: 1,
        risks: [],
        recommendations: [],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ transactions: [], horizonDays: 9999 }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.forecast.likelyCase).toBe(1);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("sorry, I can't forecast that");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(req({ transactions: [] })),
    ).rejects.toThrow(/non-JSON/);
  });
});
