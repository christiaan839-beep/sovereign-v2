/**
 * trust-ledger-query route smoke tests.
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

import { POST } from "@/app/api/_agents/trust-ledger-query/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/trust-ledger-query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("trust-ledger-query", () => {
  it("returns parameterized SELECT for an audit question", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        sql:
          "SELECT agent_slug, COUNT(*) AS blocked FROM execution_audit WHERE trust_decision = 'block' AND tenant_id = $tenant GROUP BY agent_slug",
        explanation: "Counts blocked runs per agent for the caller's tenant.",
        estimatedRows: 50,
        tablesAccessed: ["execution_audit"],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ question: "Which agents had the most blocked runs?" }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sql).toMatch(/SELECT/i);
    expect(body.tablesAccessed).toContain("execution_audit");
  });

  it("accepts timeRange parameter", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        sql:
          "SELECT day, SUM(runs) FROM agent_stats_daily WHERE tenant_id = $tenant AND day BETWEEN $1 AND $2 GROUP BY day",
        explanation: "Daily run totals within the time range.",
        estimatedRows: 30,
        tablesAccessed: ["agent_stats_daily"],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        question: "How many runs per day last month?",
        timeRange: { start: "2026-03-01", end: "2026-03-31" },
      }),
    );
    const body = await res.json();
    expect(body.sql).toContain("BETWEEN");
    expect(body.tablesAccessed).toContain("agent_stats_daily");
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"sql":"SELECT 1","explanation":"x","estimatedRows":1,"tablesAccessed":["execution_audit"]}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ question: "q" }),
    );
    const body = await res.json();
    expect(body.sql).toBe("SELECT 1");
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("refuse");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(req({ question: "q" })),
    ).rejects.toThrow(/non-JSON/);
  });
});
