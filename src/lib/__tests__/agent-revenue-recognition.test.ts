/**
 * revenue-recognition route smoke tests.
 *
 * We mock `ai()` and verify:
 *   1. Happy path — valid JSON recognition schedule is returned.
 *   2. Markdown-fence stripping.
 *   3. IFRS 15 path works as well as ASC 606 default.
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

import { POST } from "@/app/api/_agents/revenue-recognition/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/revenue-recognition", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("revenue-recognition", () => {
  it("returns parsed recognition schedule on valid JSON", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        performanceObligations: [
          { description: "SaaS subscription", standalonePrice: 12000, recognitionPattern: "over-time" },
          { description: "Implementation services", standalonePrice: 3000, recognitionPattern: "point-in-time" },
        ],
        schedule: [
          { period: "2026-05", revenue: 1000, rationale: "1 of 12 months SaaS" },
          { period: "2026-05", revenue: 3000, rationale: "Implementation delivered" },
        ],
        totalContractValue: 15000,
        cautions: ["Implementation SSP inferred from market rate — confirm with vendor"],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ contractSummary: "12-month SaaS contract at $1k/mo plus $3k implementation." }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.recognition.totalContractValue).toBe(15000);
    expect(body.recognition.performanceObligations).toHaveLength(2);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```\n{"performanceObligations":[],"schedule":[],"totalContractValue":0,"cautions":[]}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ contractSummary: "minimal" }),
    );
    const body = await res.json();
    expect(body.recognition.totalContractValue).toBe(0);
  });

  it("accepts IFRS 15 standard explicitly", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        performanceObligations: [{ description: "License", standalonePrice: 5000, recognitionPattern: "point-in-time" }],
        schedule: [{ period: "2026-04", revenue: 5000, rationale: "Right-of-use transfer" }],
        totalContractValue: 5000,
        cautions: [],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ contractSummary: "Perpetual license, one-time $5k.", accountingStandard: "IFRS 15" }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.recognition.performanceObligations[0].recognitionPattern).toBe("point-in-time");
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("cannot determine");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ contractSummary: "vague terms" }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
