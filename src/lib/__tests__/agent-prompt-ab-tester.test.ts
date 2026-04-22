/**
 * prompt-ab-tester route smoke tests.
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

import { POST } from "@/app/api/_agents/prompt-ab-tester/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/prompt-ab-tester", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("prompt-ab-tester", () => {
  it("returns parsed A/B result on valid JSON", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        winner: "B",
        confidenceLevel: "med",
        aScore: 72,
        bScore: 88,
        rationale: "Prompt B produced more specific, JSON-compliant outputs in 4 of 5 runs.",
        outputSamples: { a: ["a1", "a2"], b: ["b1", "b2"] },
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        prompt_a: "Summarize this:",
        prompt_b: "Summarize this into exactly 3 bullets:",
        sharedInput: "Long text here.",
        runs: 5,
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.winner).toBe("B");
    expect(body.result.bScore).toBeGreaterThan(body.result.aScore);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"winner":"tie","confidenceLevel":"low","aScore":50,"bScore":50,"rationale":"r","outputSamples":{"a":[],"b":[]}}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ prompt_a: "a", prompt_b: "b", sharedInput: "i", runs: 3 }),
    );
    const body = await res.json();
    expect(body.result.winner).toBe("tie");
  });

  it("clamps runs into 3-20 range (passes through)", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        winner: "A",
        confidenceLevel: "low",
        aScore: 60,
        bScore: 55,
        rationale: "r",
        outputSamples: { a: [], b: [] },
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ prompt_a: "a", prompt_b: "b", sharedInput: "i", runs: 999 }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("cannot run tests");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ prompt_a: "a", prompt_b: "b", sharedInput: "i", runs: 5 }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
