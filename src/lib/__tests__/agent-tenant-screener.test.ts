/**
 * tenant-screener route smoke tests.
 *
 * We mock `ai()` and verify:
 *   1. Happy path — valid JSON screening output is returned.
 *   2. Markdown-fence stripping.
 *   3. Protected-class content in input is acknowledged in legalCautions but
 *      not used to lower the score (the agent relies on the model; we verify
 *      the mocked response pattern flows through cleanly).
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

import { POST } from "@/app/api/_agents/tenant-screener/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/tenant-screener", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("tenant-screener", () => {
  it("returns parsed screening on valid JSON", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        riskScore: 82,
        strengths: ["Income 4.1× rent", "5 years at current employer"],
        concerns: ["One 30-day late payment 2 years ago"],
        verdict: "strong",
        legalCautions: [],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ application: "Applicant earns $8k/mo, rent is $2k, employed 5yrs as RN." }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.screening.verdict).toBe("strong");
    expect(body.screening.riskScore).toBe(82);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"riskScore":65,"strengths":[],"concerns":[],"verdict":"acceptable","legalCautions":[]}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ application: "..." }),
    );
    const body = await res.json();
    expect(body.screening.verdict).toBe("acceptable");
  });

  it("surfaces legalCautions when protected-class info appears in application", async () => {
    // The system prompt instructs the model to IGNORE protected-class info
    // and note it in legalCautions. We verify that when the model returns
    // such a caution, it flows through the response untouched.
    mockAi.mockResolvedValue(
      JSON.stringify({
        riskScore: 75,
        strengths: ["Income 3.5× rent"],
        concerns: [],
        verdict: "acceptable",
        legalCautions: [
          "Applicant disclosed disability — ignored per Fair Housing Act; decision based solely on financial factors.",
        ],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        application:
          "Applicant uses a wheelchair and has a service dog. Earns $7k/mo against $2k rent.",
        jurisdiction: "California",
      }),
    );
    const body = await res.json();
    expect(body.screening.legalCautions.length).toBeGreaterThan(0);
    expect(body.screening.legalCautions[0]).toMatch(/Fair Housing|ignored/i);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("unable to assess");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(req({ application: "..." })),
    ).rejects.toThrow(/non-JSON/);
  });
});
