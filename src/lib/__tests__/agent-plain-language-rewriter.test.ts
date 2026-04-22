/**
 * plain-language-rewriter route smoke tests.
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

import { POST } from "@/app/api/_agents/plain-language-rewriter/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/plain-language-rewriter", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("plain-language-rewriter", () => {
  it("returns rewritten text at target grade level", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        rewritten: "We changed the rule. Users can now log in with one click.",
        originalGradeLevel: 14,
        newGradeLevel: 8,
        changes: ["Shortened two sentences.", "Swapped 'authenticate' for 'log in'."],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        text:
          "The authentication paradigm has been amended such that users may now authenticate with a singular interaction.",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.rewritten).toBeDefined();
    expect(body.newGradeLevel).toBeLessThanOrEqual(body.originalGradeLevel);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"rewritten":"Short.","originalGradeLevel":null,"newGradeLevel":null,"changes":[]}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ text: "Something long." }),
    );
    const body = await res.json();
    expect(body.rewritten).toBe("Short.");
  });

  it("clamps out-of-range gradeLevel to 4-12 without crashing", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        rewritten: "Simple text.",
        originalGradeLevel: 10,
        newGradeLevel: 4,
        changes: [],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ text: "x", gradeLevel: 1 }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("cannot rewrite");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(req({ text: "x" })),
    ).rejects.toThrow(/non-JSON/);
  });
});
