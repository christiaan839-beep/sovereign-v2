/**
 * security-auditor-code route smoke tests.
 *
 * We mock `ai()` and verify the handler parses audit output, strips
 * markdown fences, accepts a high audit score with empty criticalIssues,
 * and throws on non-JSON.
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

import { POST } from "@/app/api/_agents/security-auditor-code/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/security-auditor-code", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("security-auditor-code", () => {
  it("returns audit with score, issues, and recommendations", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        auditScore: 62,
        criticalIssues: ["No authorization check on tenant-scoped endpoint"],
        recommendations: [
          {
            priority: "must-fix",
            issue: "Handler accepts userId from query param without verifying it matches session user",
            fix: "Replace 'const userId = req.query.userId' with 'const userId = await getSession(req).userId'",
          },
          {
            priority: "should-fix",
            issue: "Errors logged with full request body",
            fix: "Redact passwords and tokens before logging via redactSensitive(body)",
          },
        ],
        positiveFindings: ["Input parsed with zod schema"],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        code: "export async function handler(req) { const userId = req.query.userId; ... }",
        language: "typescript",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.auditScore).toBe(62);
    expect(body.recommendations[0].priority).toBe("must-fix");
    expect(body.positiveFindings.length).toBeGreaterThan(0);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"auditScore":95,"criticalIssues":[],"recommendations":[],"positiveFindings":["Clean input validation"]}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ code: "const x = 1;", language: "typescript" }),
    );
    const body = await res.json();
    expect(body.auditScore).toBe(95);
  });

  it("accepts empty criticalIssues when code is solid", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        auditScore: 88,
        criticalIssues: [],
        recommendations: [
          {
            priority: "nice-to-have",
            issue: "Could add explicit return type",
            fix: "Add ': Promise<Result>' to handler signature",
          },
        ],
        positiveFindings: ["Parameterized queries throughout", "Structured logging"],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        code: "async function get(id: string) { return db.query(sql, [id]); }",
        language: "typescript",
        threatModel: "authenticated API, tenant-scoped",
      }),
    );
    const body = await res.json();
    expect(body.criticalIssues).toEqual([]);
    expect(body.auditScore).toBeGreaterThan(80);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("I could not audit this code.");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ code: "x", language: "go" }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
