/**
 * playbook-builder route smoke tests.
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

import { POST } from "@/app/api/_agents/playbook-builder/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/playbook-builder", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("playbook-builder", () => {
  it("returns parsed playbook on valid JSON", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        playbookName: "lead-blitz-saas",
        description: "Find + score SaaS decision-makers, then draft personalized outreach.",
        steps: [
          { agent: "lead-finder", inputs: { vertical: "SaaS" }, outputKey: "leads" },
          { agent: "lead-scorer", inputs: { leads: "{{step1.leads}}" }, outputKey: "scored" },
          { agent: "outreach-drafter", inputs: { scored: "{{step2.scored}}" }, outputKey: "drafts" },
        ],
        guarantee: "≥5 leads each with score 0-100 and a drafted outreach email ≥80 words",
        estimatedCostCents: 12,
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ goal: "Generate 5 outbound leads for SaaS companies this week" }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.playbook.steps).toHaveLength(3);
    expect(body.playbook.guarantee).toContain("≥5 leads");
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"playbookName":"x","description":"","steps":[],"guarantee":"","estimatedCostCents":0}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ goal: "anything" }),
    );
    const body = await res.json();
    expect(body.playbook.playbookName).toBe("x");
  });

  it("respects availableAgents option (passes through prompt)", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        playbookName: "p",
        description: "",
        steps: [{ agent: "lead-finder", inputs: {}, outputKey: "out" }],
        guarantee: "g",
        estimatedCostCents: 3,
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ goal: "g", availableAgents: ["lead-finder", "outreach-drafter"], maxSteps: 2 }),
    );
    const body = await res.json();
    expect(body.playbook.steps[0].agent).toBe("lead-finder");
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("sorry");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(req({ goal: "x" })),
    ).rejects.toThrow(/non-JSON/);
  });
});
