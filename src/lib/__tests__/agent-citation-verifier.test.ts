/**
 * citation-verifier route smoke tests.
 *
 * We mock `ai()` and verify: happy path with "supported" verdict,
 * markdown-fence stripping, a "contradicts" verdict with relevantQuote,
 * and a throw on non-JSON output.
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

import { POST } from "@/app/api/_agents/citation-verifier/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/citation-verifier", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("citation-verifier", () => {
  it("returns supported verdict when source backs the claim", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        verdict: "supported",
        confidence: 0.95,
        relevantQuote: "Fasting insulin levels dropped by 31% in the intervention group.",
        discrepancies: [],
        recommendation: "Citation is accurate; no changes needed",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        claim: "Intermittent fasting reduces fasting insulin by about 30%.",
        sourceText: "Our study found that fasting insulin levels dropped by 31% in the intervention group after 12 weeks.",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.verdict).toBe("supported");
    expect(body.relevantQuote).toContain("31%");
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"verdict":"unsupported","confidence":0.9,"relevantQuote":null,"discrepancies":["Source does not mention this topic"],"recommendation":"Remove citation"}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ claim: "X causes Y", sourceText: "This paper is about Z." }),
    );
    const body = await res.json();
    expect(body.verdict).toBe("unsupported");
    expect(body.relevantQuote).toBeNull();
  });

  it("returns contradicts verdict with specific discrepancies", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        verdict: "contradicts",
        confidence: 0.88,
        relevantQuote: "No significant effect was observed in the treatment arm (p=0.71).",
        discrepancies: [
          "Claim asserts a significant effect; source reports non-significance (p=0.71)",
          "Claim direction (benefit) opposite to source finding (null)",
        ],
        recommendation: "Remove this citation or revise claim to reflect null result",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        claim: "The drug significantly reduced mortality.",
        sourceText: "No significant effect was observed in the treatment arm (p=0.71).",
      }),
    );
    const body = await res.json();
    expect(body.verdict).toBe("contradicts");
    expect(body.discrepancies.length).toBeGreaterThanOrEqual(2);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("I cannot verify this citation.");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ claim: "x", sourceText: "y" }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
