/**
 * consensus route — smoke tests.
 *
 * Mocks verifiedAi from @/lib/consensus so tests don't hit NIM.
 * Verifies the route surfaces the library's full verified shape
 * (answer, verified, revised, confidence, models) under success=true.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockVerifiedAi } = vi.hoisted(() => ({ mockVerifiedAi: vi.fn() }));

vi.mock("@/lib/consensus", () => ({
  verifiedAi: mockVerifiedAi,
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
  mockVerifiedAi.mockReset();
});

import { POST } from "@/app/api/_agents/consensus/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/consensus", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("consensus", () => {
  it("surfaces the full verifiedAi shape on happy path", async () => {
    mockVerifiedAi.mockResolvedValue({
      answer: "42",
      verified: true,
      revised: false,
      confidence: 0.9,
      models: ["nemotron-ultra", "deepseek-v3-2"],
    });
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ prompt: "What is the answer?" }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.answer).toBe("42");
    expect(body.verified).toBe(true);
    expect(body.models).toHaveLength(2);
  });

  it("passes skipVerify through to the library", async () => {
    mockVerifiedAi.mockResolvedValue({
      answer: "quick",
      verified: false,
      revised: false,
      confidence: 0.7,
      models: ["nemotron-ultra"],
    });
    await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ prompt: "quick question", skipVerify: true }),
    );
    expect(mockVerifiedAi).toHaveBeenCalledWith(
      "quick question",
      expect.objectContaining({ skipVerify: true }),
    );
  });

  it("passes system prompt through", async () => {
    mockVerifiedAi.mockResolvedValue({
      answer: "x",
      verified: true,
      revised: false,
      confidence: 0.9,
      models: ["a", "b"],
    });
    await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ prompt: "p", system: "You are a strict analyst." }),
    );
    expect(mockVerifiedAi).toHaveBeenCalledWith(
      "p",
      expect.objectContaining({ system: "You are a strict analyst." }),
    );
  });
});
