/**
 * api-design-reviewer route smoke tests.
 *
 * We mock `ai()` and verify:
 *   1. Happy path — valid JSON review is returned.
 *   2. Markdown-fence stripping.
 *   3. GraphQL style path works (non-default).
 *   4. Error path — non-JSON model output throws.
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

import { POST } from "@/app/api/_agents/api-design-reviewer/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/api-design-reviewer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("api-design-reviewer", () => {
  it("returns parsed review on valid JSON", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        score: 68,
        strengths: ["Consistent snake_case fields", "HTTPS enforced"],
        issues: [
          {
            severity: "major",
            category: "versioning",
            description: "No versioning strategy documented.",
            recommendation: "Adopt URL-path versioning (/v1/) like Stripe; document breaking-change policy.",
          },
          {
            severity: "minor",
            category: "pagination",
            description: "Only offset-based pagination on /users.",
            recommendation: "Add cursor-based option for collections > 10k.",
          },
        ],
        nextStepsPriority: [
          "Add versioning strategy",
          "Standardize error envelope",
          "Document auth scopes",
        ],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ apiSpec: "GET /users returns all users. POST /createUser creates a user." }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.review.score).toBe(68);
    expect(body.review.issues).toHaveLength(2);
    expect(body.review.issues[0].category).toBe("versioning");
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"score":90,"strengths":[],"issues":[],"nextStepsPriority":[]}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ apiSpec: "..." }),
    );
    const body = await res.json();
    expect(body.review.score).toBe(90);
  });

  it("accepts GraphQL style explicitly", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        score: 82,
        strengths: ["Schema uses non-null where appropriate"],
        issues: [
          {
            severity: "minor",
            category: "consistency",
            description: "Mutation naming inconsistent (createUser vs user_update).",
            recommendation: "Standardize on verbNoun (createUser, updateUser).",
          },
        ],
        nextStepsPriority: ["Rename user_update to updateUser"],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        apiSpec: "type Query { user(id: ID!): User } type Mutation { createUser(...): User }",
        style: "GraphQL",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.review.score).toBe(82);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("please share more of the spec");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(req({ apiSpec: "..." })),
    ).rejects.toThrow(/non-JSON/);
  });
});
