/**
 * anomaly-detector route smoke tests.
 *
 * We mock `ai()` and verify:
 *   1. Happy path — valid JSON anomaly report is returned.
 *   2. Markdown-fence stripping.
 *   3. Accepts NL-string metric form (not just array).
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

import { POST } from "@/app/api/_agents/anomaly-detector/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/anomaly-detector", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("anomaly-detector", () => {
  it("returns parsed report on valid JSON", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        anomalies: [
          {
            timestamp: "2026-04-15T12:00:00Z",
            value: 8200,
            expectedRange: [3000, 5000],
            severity: "critical",
            hypotheses: [
              "Campaign launch driving spike",
              "Bot traffic / credential stuffing",
              "Upstream referrer outage redirecting traffic",
            ],
          },
        ],
        overallHealth: "critical",
        investigationSteps: [
          "Query signups table between 2026-04-15 11:00–13:00 UTC grouped by source.",
          "Check WAF dashboard for rate-limit trips in same window.",
          "Interview growth team about campaign changes deployed on 2026-04-15.",
        ],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        metric: [
          { timestamp: "2026-04-14T12:00:00Z", value: 4000 },
          { timestamp: "2026-04-15T12:00:00Z", value: 8200 },
        ],
        metricName: "signups_per_hour",
        expectedPattern: "steady",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.report.overallHealth).toBe("critical");
    expect(body.report.anomalies[0].hypotheses.length).toBeGreaterThanOrEqual(3);
    expect(body.report.investigationSteps[0]).toMatch(/Query/);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"anomalies":[],"overallHealth":"healthy","investigationSteps":[]}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ metric: [], metricName: "x" }),
    );
    const body = await res.json();
    expect(body.report.overallHealth).toBe("healthy");
  });

  it("accepts NL-string metric description", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        anomalies: [],
        overallHealth: "warning",
        investigationSteps: ["Pull raw data for quantitative analysis."],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        metric: "Conversions averaged 2% but dropped to 0.8% yesterday morning.",
        metricName: "conversion_rate",
        expectedPattern: "seasonal",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.report.overallHealth).toBe("warning");
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("insufficient data");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ metric: [], metricName: "x" }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
