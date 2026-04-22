/**
 * grant-finder-writer route smoke tests.
 *
 * We mock `ai()` and verify:
 *   1. Happy path — valid JSON result is returned.
 *   2. Markdown-fence stripping.
 *   3. Optional fundingNeeded + projectDescription flow through.
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

import { POST } from "@/app/api/_agents/grant-finder-writer/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/grant-finder-writer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("grant-finder-writer", () => {
  it("returns parsed result on valid JSON", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        suggestedGrants: [
          {
            name: "Federal SBIR Phase I (health IT category)",
            funder: "HHS / NIH research target list",
            typicalRange: "$150k–$300k",
            fitScore: 72,
            applicationAngle: "Lead with the evidence-based clinical workflow.",
          },
        ],
        draftNarrative: "Our organization addresses the critical gap in rural telemedicine access...",
        evaluationCriteria: ["Innovation (30%)", "Team capability (25%)", "Commercial potential (25%)"],
        commonPitfalls: ["Missing PI credentials — SBIR requires a PhD or equivalent."],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        orgDescription: "501c3 rural telehealth nonprofit, 2 years old, 8 FTE, serving Appalachia.",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.suggestedGrants).toHaveLength(1);
    expect(body.result.suggestedGrants[0].fitScore).toBe(72);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"suggestedGrants":[],"draftNarrative":"n","evaluationCriteria":[],"commonPitfalls":[]}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ orgDescription: "..." }),
    );
    const body = await res.json();
    expect(body.result.draftNarrative).toBe("n");
  });

  it("accepts optional fundingNeeded and projectDescription", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        suggestedGrants: [
          {
            name: "Community foundation capacity-building (category)",
            funder: "local community foundation",
            typicalRange: "$25k–$75k",
            fitScore: 88,
            applicationAngle: "Emphasize measurable community outcomes.",
          },
        ],
        draftNarrative: "Our project will expand services to 500 additional households...",
        evaluationCriteria: ["Community need", "Org capacity"],
        commonPitfalls: ["Over-promising on outcomes"],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        orgDescription: "Youth arts nonprofit",
        fundingNeeded: 50000,
        projectDescription: "After-school music program expansion to 2 more schools.",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.suggestedGrants[0].fitScore).toBe(88);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("no suitable grants found");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(req({ orgDescription: "..." })),
    ).rejects.toThrow(/non-JSON/);
  });
});
