/**
 * youtube-summarizer + valuation-comparable-finder — smoke tests.
 *
 * These two agents were the tail of wave 3 (rate-limited before the
 * subagent could produce them). Both use the standard elite-tier
 * template: factory + ai() + markdown-fence-strip + throw on non-JSON.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAi } = vi.hoisted(() => ({ mockAi: vi.fn() }));

vi.mock("@/lib/ai", () => ({ ai: mockAi, research_ai: vi.fn() }));

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

function req(path: string, body: unknown): Request {
  return new Request(`http://l${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("youtube-summarizer", () => {
  it("returns parsed summary on happy path", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        tldr: "short",
        takeaways: [{ point: "x", timestamp: "00:05:12" }],
        tweetThread: ["one"],
        discussionQuestions: ["why?"],
      }),
    );
    const { POST } = await import("@/app/api/_agents/youtube-summarizer/route");
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req("/api/agents/youtube-summarizer", { transcript: "...", maxTakeaways: 5 }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.summary.takeaways[0].timestamp).toBe("00:05:12");
  });

  it("strips markdown fences", async () => {
    mockAi.mockResolvedValue('```json\n{"tldr":"t","takeaways":[],"tweetThread":[],"discussionQuestions":[]}\n```');
    const { POST } = await import("@/app/api/_agents/youtube-summarizer/route");
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req("/api/agents/youtube-summarizer", { transcript: "..." }),
    );
    const body = await res.json();
    expect(body.summary.tldr).toBe("t");
  });

  it("throws on non-JSON output", async () => {
    mockAi.mockResolvedValue("I cannot summarize that");
    const { POST } = await import("@/app/api/_agents/youtube-summarizer/route");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req("/api/agents/youtube-summarizer", { transcript: "..." }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});

describe("valuation-comparable-finder", () => {
  it("returns framework with disclaimers on happy path", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        valuationRange: { low: 450000, midpoint: 500000, high: 550000, currency: "USD" },
        compsCriteria: [{ dimension: "distance_from_subject", acceptableRange: "within 0.5 miles" }],
        adjustmentFactors: [{ factor: "pool", direction: "up", magnitude: "minor" }],
        marketNotes: ["balanced market"],
        disclaimers: [
          "Not an MLS lookup — provides search framework only",
          "Not a USPAP-compliant appraisal",
          "Valuation range assumes arms-length transaction and stabilized market conditions",
        ],
      }),
    );
    const { POST } = await import("@/app/api/_agents/valuation-comparable-finder/route");
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req("/api/agents/valuation-comparable-finder", {
        propertyDescription: "3BR/2BA, 1800sqft, Austin TX",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    // Schema change: agent returns `framework`, not `guidance`. Three
    // disclaimers are mandated by the system prompt.
    expect(body.framework.disclaimers.length).toBeGreaterThanOrEqual(3);
    expect(body.framework.valuationRange.currency).toBe("USD");
  });

  it("throws on non-JSON output", async () => {
    mockAi.mockResolvedValue("I'm a real estate agent, not a psychic");
    const { POST } = await import("@/app/api/_agents/valuation-comparable-finder/route");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req("/api/agents/valuation-comparable-finder", { propertyDescription: "x" }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
