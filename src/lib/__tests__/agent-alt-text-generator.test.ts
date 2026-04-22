/**
 * alt-text-generator route smoke tests.
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

import { POST } from "@/app/api/_agents/alt-text-generator/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/alt-text-generator", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("alt-text-generator", () => {
  it("returns descriptive alt text for informative images", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        altText: "Bar chart showing Q1 revenue up 34% year over year.",
        decision: "descriptive",
        rationale: "Conveys the chart's key takeaway in under 125 characters.",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ description: "Bar chart, Q1 revenue higher than last year" }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.decision).toBe("descriptive");
    expect(body.altText).not.toMatch(/^(Image|Picture|Photo) of/);
  });

  it("returns empty alt for decorative images", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        altText: "",
        decision: "empty",
        rationale: "Decorative flourish adjacent to body text conveys no information.",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ description: "Decorative swirl graphic", purpose: "decorative" }),
    );
    const body = await res.json();
    expect(body.decision).toBe("empty");
    expect(body.altText).toBe("");
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"altText":"Submit button","decision":"descriptive","rationale":"Functional."}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ description: "Blue submit button icon", purpose: "functional" }),
    );
    const body = await res.json();
    expect(body.altText).toBe("Submit button");
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("unable to describe");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(req({ description: "x" })),
    ).rejects.toThrow(/non-JSON/);
  });
});
