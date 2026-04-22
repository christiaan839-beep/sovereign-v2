/**
 * review-analyzer route smoke tests.
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

import { POST } from "@/app/api/_agents/review-analyzer/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/review-analyzer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("review-analyzer", () => {
  it("synthesizes themes and draft responses from a batch", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        overallSentiment: "mixed",
        averageRating: 3.5,
        themes: {
          positive: ["easy setup", "responsive support"],
          negative: ["slow export", "pricey"],
        },
        urgentIssues: [],
        draftResponses: {
          "Sam K": "Thanks Sam — we've prioritized the export performance issue you called out; expect improvements in our next release.",
        },
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        reviews: [
          { rating: 5, text: "Easy setup!", author: "Jane" },
          { rating: 2, text: "Export is painfully slow.", author: "Sam K" },
        ],
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.overallSentiment).toBe("mixed");
    expect(body.result.themes.negative).toContain("slow export");
    expect(body.result.draftResponses["Sam K"]).toBeTruthy();
  });

  it("flags urgent safety issues", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        overallSentiment: "negative",
        averageRating: 1.5,
        themes: { positive: [], negative: ["product defect"] },
        urgentIssues: ["Reviewer reports burn injury from defective battery — safety escalation required"],
        draftResponses: {
          "review-1": "We take this seriously. Please contact safety@brand.com immediately so we can investigate and recall the affected unit.",
        },
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        reviews: [{ rating: 1, text: "The battery overheated and burned my hand." }],
      }),
    );
    const body = await res.json();
    expect(body.result.urgentIssues.length).toBeGreaterThan(0);
    expect(body.result.overallSentiment).toBe("negative");
  });

  it("rejects an empty reviews array", async () => {
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ reviews: [] }),
      ),
    ).rejects.toThrow(/non-empty/);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("not json");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ reviews: [{ rating: 4, text: "ok" }] }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
