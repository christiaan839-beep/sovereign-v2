/**
 * test-generator route smoke tests.
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

import { POST } from "@/app/api/_agents/test-generator/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/test-generator", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("test-generator", () => {
  it("returns parsed tests on valid JSON from model", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        tests:
          "import { describe, it, expect } from 'vitest';\ndescribe('add', () => { it('adds', () => expect(1 + 1).toBe(2)); });",
        coverageNotes: ["Happy path covered."],
        missingCases: ["Overflow behavior with MAX_SAFE_INTEGER."],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ code: "export const add = (a, b) => a + b;" }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.tests).toContain("describe");
    expect(body.missingCases.length).toBeGreaterThan(0);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"tests":"it(\'x\', () => {});","coverageNotes":[],"missingCases":[]}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ code: "x" }),
    );
    const body = await res.json();
    expect(body.tests).toContain("it(");
  });

  it("handles python/pytest requests", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        tests: "def test_add():\n    assert 1 + 1 == 2",
        coverageNotes: ["Covers happy path."],
        missingCases: [],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ code: "def add(a, b): return a + b", language: "python" }),
    );
    const body = await res.json();
    expect(body.tests).toContain("def test_");
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("not json");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(req({ code: "x" })),
    ).rejects.toThrow(/non-JSON/);
  });
});
