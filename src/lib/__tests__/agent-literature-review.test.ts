/**
 * literature-review route smoke tests.
 *
 * We mock `ai()` and verify the handler parses synthesis output,
 * strips markdown fences, surfaces conflicts with named papers, and
 * throws on non-JSON.
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

import { POST } from "@/app/api/_agents/literature-review/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/literature-review", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const samplePapers = [
  { title: "Paper A: RCT on fasting", abstract: "Randomized trial showing fasting reduces insulin." },
  { title: "Paper B: Cohort on fasting", abstract: "Observational cohort showing similar reductions." },
  { title: "Paper C: Meta-analysis", abstract: "Meta-analysis pooling 14 RCTs." },
];

describe("literature-review", () => {
  it("returns synthesis with consensus, conflicts, and gaps", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        consensus: ["Intermittent fasting reduces fasting insulin in metabolically healthy adults"],
        conflicts: [
          {
            claim: "Effect size magnitude",
            supportingPapers: ["Paper A: RCT on fasting"],
            opposingPapers: ["Paper B: Cohort on fasting"],
          },
        ],
        gapsInLiterature: ["No papers cover long-term (>1 year) effects", "Limited data in adolescents"],
        synthesis: "Three papers align on direction of effect, with stronger evidence from Paper C (meta-analysis).",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ papers: samplePapers, topic: "Does IF reduce insulin?" }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.consensus.length).toBeGreaterThan(0);
    expect(body.conflicts[0].supportingPapers).toContain("Paper A: RCT on fasting");
    expect(body.gapsInLiterature.length).toBeGreaterThan(0);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"consensus":[],"conflicts":[],"gapsInLiterature":["Thin evidence base"],"synthesis":"Only two papers provided — insufficient for consensus."}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ papers: samplePapers.slice(0, 2) }),
    );
    const body = await res.json();
    expect(body.consensus).toEqual([]);
    expect(body.synthesis).toContain("insufficient");
  });

  it("names both supporting and opposing papers for each conflict", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        consensus: ["Fasting is safe in adults"],
        conflicts: [
          {
            claim: "Fasting improves cognitive performance",
            supportingPapers: ["Paper A: RCT on fasting"],
            opposingPapers: ["Paper B: Cohort on fasting", "Paper C: Meta-analysis"],
          },
        ],
        gapsInLiterature: ["Pediatric data missing"],
        synthesis: "Evidence is mixed on cognitive effects; the meta-analysis weighs against the single RCT.",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ papers: samplePapers }),
    );
    const body = await res.json();
    expect(body.conflicts[0].supportingPapers.length).toBeGreaterThan(0);
    expect(body.conflicts[0].opposingPapers.length).toBeGreaterThan(0);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("Cannot synthesize this literature.");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ papers: samplePapers }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
