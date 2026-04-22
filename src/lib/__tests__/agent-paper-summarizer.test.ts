/**
 * paper-summarizer route smoke tests.
 *
 * We mock `ai()` and verify: happy-path structured summary, markdown-fence
 * stripping, audience-aware tone handling, and throw-on-non-JSON.
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

import { POST } from "@/app/api/_agents/paper-summarizer/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/paper-summarizer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("paper-summarizer", () => {
  it("returns structured summary with findings and limitations", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        title: "Effects of Intermittent Fasting on Metabolic Health",
        abstract: "A 12-week RCT in 142 adults found intermittent fasting reduced HbA1c and fasting insulin.",
        keyFindings: [
          "HbA1c reduced by 0.8 percentage points (p<0.01)",
          "Fasting insulin reduced by 31%",
        ],
        methodology: "Randomized controlled trial with 142 adults, 12-week intervention.",
        limitations: ["Short follow-up period (12 weeks only)", "Single-center study"],
        applicability: "Practitioners can consider time-restricted eating as an adjunct for metabolic health.",
        citation: "Smith J et al. (2024). Effects of IF. Journal of Metabolic Research.",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ paperText: "A 12-week RCT on intermittent fasting..." }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.keyFindings.length).toBeGreaterThanOrEqual(2);
    expect(body.limitations.length).toBeGreaterThan(0);
    expect(body.citation).toBeTruthy();
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"title":"T","abstract":"a","keyFindings":["f1"],"methodology":"m","limitations":["No limitations stated by the authors or visible from this text."],"applicability":"a","citation":null}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ paperText: "..." }),
    );
    const body = await res.json();
    expect(body.title).toBe("T");
    expect(body.limitations[0]).toContain("No limitations stated");
  });

  it("flags missing limitations when paper does not state them", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        title: "[inferred] Short Paper Without Limitations Section",
        abstract: "Brief report on a novel protocol.",
        keyFindings: ["Protocol completed successfully"],
        methodology: "Case series with 5 patients.",
        limitations: ["No limitations stated by the authors or visible from this text."],
        applicability: "Too preliminary to act on — awaiting controlled study.",
        citation: null,
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ paperText: "Very short paper without methodological caveats.", audience: "expert" }),
    );
    const body = await res.json();
    expect(body.limitations[0]).toContain("No limitations stated");
    expect(body.citation).toBeNull();
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("I cannot summarize this paper.");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ paperText: "..." }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
