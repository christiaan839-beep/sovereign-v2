/**
 * /api/public/playbook-builder-demo — tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAi } = vi.hoisted(() => ({ mockAi: vi.fn() }));

vi.mock("@/lib/ai", () => ({ ai: mockAi }));

beforeEach(() => {
  mockAi.mockReset();
});

import { POST } from "@/app/api/public/playbook-builder-demo/route";

function req(body: unknown): Request {
  return new Request("http://l/api/public/playbook-builder-demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/public/playbook-builder-demo", () => {
  it("returns composed playbook on happy path", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        playbookName: "lead-blitz-fintech",
        description: "Find qualified fintech leads and draft outreach.",
        steps: [
          { agent: "leads", inputs: { niche: "fintech SaaS" }, outputKey: "qualifiedLeads" },
          { agent: "email-sequence", inputs: { leads: "{{step1.qualifiedLeads}}" }, outputKey: "threads" },
        ],
        guarantee: "≥5 leads each with contact_angle field",
        estimatedCostCents: 8,
      }),
    );
    const res = await POST(
      req({ goal: "Find 10 qualified fintech SaaS leads and draft personalized outreach for each" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.playbook.steps).toHaveLength(2);
    expect(body.playbook.guarantee).toMatch(/≥5/);
  });

  it("returns empty-steps playbook when goal cannot be met (positive flow)", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        playbookName: "quantum-weather-forecast",
        description: "No Sovereign agent does quantum meteorology. Build a `quantum-weather` agent first.",
        steps: [],
        guarantee: "requires missing agent",
        estimatedCostCents: 0,
      }),
    );
    const res = await POST(
      req({ goal: "Predict tomorrow's weather using quantum computing at a street level for every city" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.playbook.steps).toHaveLength(0);
  });

  it("strips markdown fences", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"playbookName":"x","description":"y","steps":[],"guarantee":"g","estimatedCostCents":0}\n```',
    );
    const res = await POST(req({ goal: "A generic goal for testing fence stripping behavior correctly" }));
    const body = await res.json();
    expect(body.playbook.playbookName).toBe("x");
  });

  it("returns 400 for goal under 20 chars", async () => {
    const res = await POST(req({ goal: "too short" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for goal over 400 chars", async () => {
    const res = await POST(req({ goal: "a".repeat(401) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing goal", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("returns 503 when model output unparseable (graceful)", async () => {
    mockAi.mockResolvedValue("I can't compose that playbook");
    const res = await POST(req({ goal: "A reasonable goal for composing an AI playbook successfully" }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/rephrasing|sequence/i);
  });

  it("returns 503 when ai() throws", async () => {
    mockAi.mockRejectedValue(new Error("Claude offline"));
    const res = await POST(req({ goal: "A reasonable goal for composing an AI playbook successfully" }));
    expect(res.status).toBe(503);
  });

  it("sets no-store cache header", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        playbookName: "x",
        description: "y",
        steps: [],
        guarantee: "g",
        estimatedCostCents: 0,
      }),
    );
    const res = await POST(req({ goal: "A generic goal for testing cache headers correctly returned" }));
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
