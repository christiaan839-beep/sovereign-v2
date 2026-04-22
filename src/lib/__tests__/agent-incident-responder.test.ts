/**
 * incident-responder route smoke tests.
 *
 * We mock `ai()` and verify the handler parses a runbook payload,
 * strips markdown fences, infers severity when missing, and throws
 * on non-JSON.
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

import { POST } from "@/app/api/_agents/incident-responder/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/incident-responder", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("incident-responder", () => {
  it("returns a runbook with severity and actions on valid JSON", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        severity: "SEV1",
        immediateActions: ["Acknowledge page; assign incident commander", "Disable feature flag 'new-checkout'"],
        investigationSteps: ["Pull last 2h of error logs", "Check deploy timeline"],
        communicationDraft: "We are investigating an issue affecting checkout. Next update in 15min.",
        rollbackPlan: "Revert PR #1234 via GitHub rollback button; verify checkout success in smoke test.",
        postMortemQuestions: ["Why did monitoring not catch the error spike?"],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        incidentDescription: "Checkout is returning 500 errors",
        severity: "SEV1",
        affectedSystems: ["checkout-api"],
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.severity).toBe("SEV1");
    expect(body.immediateActions.length).toBeGreaterThan(0);
    expect(body.rollbackPlan).toContain("Revert");
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"severity":"SEV3","immediateActions":["Monitor"],"investigationSteps":[],"communicationDraft":"","rollbackPlan":"n/a","postMortemQuestions":[]}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ incidentDescription: "Minor latency spike, self-recovering." }),
    );
    const body = await res.json();
    expect(body.severity).toBe("SEV3");
  });

  it("infers severity when not provided in input", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        severity: "SEV2",
        immediateActions: ["Page on-call engineer"],
        investigationSteps: ["Check partition status"],
        communicationDraft: "Degraded service on analytics dashboard.",
        rollbackPlan: "No safe rollback; mitigation is to scale up replicas.",
        postMortemQuestions: ["Did auto-scale policy fire?"],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ incidentDescription: "Analytics dashboard showing stale data for 20min" }),
    );
    const body = await res.json();
    expect(body.severity).toBe("SEV2");
    expect(body.immediateActions[0]).toMatch(/on-call|page/i);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("I need more information to create a runbook.");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ incidentDescription: "..." }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
