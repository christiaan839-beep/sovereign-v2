/**
 * agent-builder route smoke tests.
 *
 * Mocks @/lib/ai and @/lib/agent-factory so we can invoke the handler
 * directly and assert on its parsed envelope.
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

import { POST } from "@/app/api/_agents/agent-builder/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/agent-builder", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("agent-builder", () => {
  it("returns parsed scaffolding on valid JSON from model", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        suggestedSlug: "summarize-thread",
        routeCode: "export const POST = createAgentRoute({ name: 'summarize-thread' });",
        testCode: "describe('summarize-thread', () => {});",
        systemPrompt: "You are a thread summarizer.",
        outputSchema: '{"summary":"string"}',
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ purpose: "Summarize a Slack thread into bullets" }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.generated.suggestedSlug).toBe("summarize-thread");
    expect(body.generated.routeCode).toContain("createAgentRoute");
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"suggestedSlug":"x","routeCode":"","testCode":"","systemPrompt":"","outputSchema":"{}"}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ purpose: "anything" }),
    );
    const body = await res.json();
    expect(body.generated.suggestedSlug).toBe("x");
  });

  it("propagates optional model + input hints without crashing", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        suggestedSlug: "geocode-address",
        routeCode: "",
        testCode: "",
        systemPrompt: "",
        outputSchema: "{}",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        purpose: "Geocode an address to lat/lng",
        expectedInputs: ["address"],
        expectedOutput: "{lat:number, lng:number}",
        model: "gemini",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.generated.suggestedSlug).toBe("geocode-address");
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("sorry, I cannot help with that");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(req({ purpose: "anything" })),
    ).rejects.toThrow(/non-JSON/);
  });
});
