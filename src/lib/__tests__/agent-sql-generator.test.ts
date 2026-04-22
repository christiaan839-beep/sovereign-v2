/**
 * sql-generator route smoke tests.
 * Mocks ai() and agent-factory passthrough; verifies happy path,
 * markdown-fence stripping, and the non-JSON error path.
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

import { POST } from "@/app/api/_agents/sql-generator/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/sql-generator", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("sql-generator", () => {
  it("returns parsed SQL on valid JSON from model", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        sql: "SELECT id, email FROM users WHERE created_at > $1",
        explanation: "Lists users created after the given date.",
        safetyNotes: [],
        readOnly: true,
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        question: "Show me users created recently",
        schema: "users(id, email, created_at)",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sql).toContain("SELECT");
    expect(body.readOnly).toBe(true);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"sql":"SELECT 1","explanation":"x","safetyNotes":[],"readOnly":true}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ question: "q", schema: "s" }),
    );
    const body = await res.json();
    expect(body.sql).toBe("SELECT 1");
  });

  it("flags mutations via safetyNotes when model returns readOnly=false", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        sql: "DELETE FROM users WHERE id = $1",
        explanation: "Deletes a user.",
        safetyNotes: ["DESTRUCTIVE: DELETE statement — confirm before execution."],
        readOnly: false,
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ question: "delete user 5", schema: "users(id, email)" }),
    );
    const body = await res.json();
    expect(body.readOnly).toBe(false);
    expect(body.safetyNotes.length).toBeGreaterThan(0);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("i cannot comply");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(req({ question: "q", schema: "s" })),
    ).rejects.toThrow(/non-JSON/);
  });
});
