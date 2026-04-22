/**
 * resume-screener route smoke tests.
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

import { POST } from "@/app/api/_agents/resume-screener/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/resume-screener", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("resume-screener", () => {
  it("returns a structured score for a good match", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        score: 88,
        strengths: ["7 years Next.js", "Shipped SaaS at scale"],
        gaps: ["No Kubernetes experience"],
        verdict: "strong",
        rationale: "Experience and stack overlap are both high; minor infra gap only.",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        jobDescription: "Senior Next.js engineer, 5+ years, SaaS background.",
        resumeText: "7 years at various SaaS companies building Next.js apps.",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.score).toBe(88);
    expect(body.result.verdict).toBe("strong");
    expect(Array.isArray(body.result.strengths)).toBe(true);
  });

  it("handles a weak-match reject verdict", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        score: 35,
        strengths: [],
        gaps: ["No relevant backend experience", "No TypeScript"],
        verdict: "reject",
        rationale: "Candidate has marketing background; no engineering match.",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        jobDescription: "Senior backend engineer, TypeScript required.",
        resumeText: "10 years in marketing campaigns.",
      }),
    );
    const body = await res.json();
    expect(body.result.verdict).toBe("reject");
    expect(body.result.score).toBeLessThan(50);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"score":72,"strengths":["a"],"gaps":["b"],"verdict":"match","rationale":"ok"}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ jobDescription: "jd", resumeText: "resume" }),
    );
    const body = await res.json();
    expect(body.result.verdict).toBe("match");
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("I refuse to screen this resume.");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ jobDescription: "jd", resumeText: "resume" }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
