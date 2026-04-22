/**
 * phishing-detector route smoke tests.
 *
 * We mock `ai()` and verify the handler parses valid JSON, strips
 * markdown fences, handles a low-confidence "suspicious" verdict
 * cleanly, and throws on non-JSON so agent-factory's error envelope
 * kicks in.
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

import { POST } from "@/app/api/_agents/phishing-detector/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/phishing-detector", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("phishing-detector", () => {
  it("returns phish verdict with indicators on valid JSON", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        verdict: "phish",
        confidence: 0.92,
        indicators: ["Lookalike domain 'paypa1.com'", "Urgency pressure"],
        recommendation: "Delete and report to IT",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ content: "Verify your PayPal account at http://paypa1.com/login within 24 hours." }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.verdict).toBe("phish");
    expect(body.indicators.length).toBeGreaterThan(0);
    expect(body.confidence).toBeGreaterThan(0.8);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"verdict":"safe","confidence":0.95,"indicators":[],"recommendation":"Safe to engage"}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ content: "Regular newsletter from trusted sender" }),
    );
    const body = await res.json();
    expect(body.verdict).toBe("safe");
    expect(body.indicators).toEqual([]);
  });

  it("returns suspicious verdict with mid confidence for ambiguous case", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        verdict: "suspicious",
        confidence: 0.55,
        indicators: ["Generic greeting", "Unusual TLD"],
        recommendation: "Verify with sender via known channel",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ content: "Dear Customer, your package is ready.", senderDomain: "delivery.xyz" }),
    );
    const body = await res.json();
    expect(body.verdict).toBe("suspicious");
    expect(body.confidence).toBeGreaterThan(0.4);
    expect(body.confidence).toBeLessThan(0.8);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("Sorry, I cannot analyze this email.");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(req({ content: "..." })),
    ).rejects.toThrow(/non-JSON/);
  });
});
