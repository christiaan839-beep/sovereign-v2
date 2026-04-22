/**
 * nda-triage route smoke tests.
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

import { POST } from "@/app/api/_agents/nda-triage/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/nda-triage", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("nda-triage", () => {
  it("classifies a standard mutual NDA as GREEN", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        classification: "GREEN",
        redFlags: [],
        missingClauses: [],
        recommendation: "sign as-is",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ ndaText: "Mutual NDA. Term: 3 years. Standard carve-outs apply." }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.classification).toBe("GREEN");
    expect(body.result.redFlags).toEqual([]);
  });

  it("flags a perpetual-term NDA as RED", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        classification: "RED",
        redFlags: [
          "Perpetual confidentiality term",
          "IP assignment to disclosing party",
          "24-month non-compete clause",
        ],
        missingClauses: ["no return/destruction obligation"],
        recommendation: "escalate to counsel",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        ndaText: "Perpetual NDA. All IP assigned. 24-month non-compete.",
      }),
    );
    const body = await res.json();
    expect(body.result.classification).toBe("RED");
    expect(body.result.redFlags.length).toBeGreaterThanOrEqual(2);
    expect(body.result.recommendation).toMatch(/counsel/i);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"classification":"YELLOW","redFlags":["one-sided"],"missingClauses":[],"recommendation":"redline"}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ ndaText: "One-sided NDA" }),
    );
    const body = await res.json();
    expect(body.result.classification).toBe("YELLOW");
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("I can't help with legal documents.");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ ndaText: "..." }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
