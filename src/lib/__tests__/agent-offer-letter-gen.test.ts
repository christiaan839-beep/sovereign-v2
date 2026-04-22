/**
 * offer-letter-gen route smoke tests.
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

import { POST } from "@/app/api/_agents/offer-letter-gen/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/offer-letter-gen", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("offer-letter-gen", () => {
  it("parses delimited sections into offerLetter, disclaimer, and nextSteps", async () => {
    mockAi.mockResolvedValue(
      `===LETTER===
# Offer Letter for Jane Doe
We're excited to offer you the role of Senior Engineer.
Base: $180,000. Equity: 40,000 options, 4-year vest, 1-year cliff.
===DISCLAIMER===
Your employment with the Company is at-will and may be terminated by either party at any time.
===NEXT_STEPS===
- Sign and return the offer letter
- Complete background check
- Schedule start-date kickoff call
- Review benefits packet`,
    );

    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        role: "Senior Engineer",
        candidate: "Jane Doe",
        baseSalary: "$180,000",
        equity: "40,000 options",
        jurisdiction: "US-CA",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.offerLetter).toContain("Jane Doe");
    expect(body.result.offerLetter).toContain("Senior Engineer");
    expect(body.result.atWillDisclaimer).toMatch(/at-will/i);
    expect(Array.isArray(body.result.nextSteps)).toBe(true);
    expect(body.result.nextSteps.length).toBeGreaterThan(0);
    expect(body.result.nextSteps[0]).not.toMatch(/^[-*]/);
  });

  it("handles SA jurisdiction with empty at-will disclaimer", async () => {
    mockAi.mockResolvedValue(
      `===LETTER===
# Offer Letter — Under BCEA (South Africa)
Welcome to the team.
===DISCLAIMER===

===NEXT_STEPS===
- Complete probation paperwork
- Sign BCEA acknowledgment`,
    );

    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        role: "Developer",
        candidate: "Sipho N",
        baseSalary: "R800,000",
        equity: "0.1%",
        jurisdiction: "SA",
      }),
    );
    const body = await res.json();
    expect(body.result.offerLetter).toContain("BCEA");
    expect(body.result.atWillDisclaimer).toBe("");
    expect(body.result.nextSteps).toHaveLength(2);
  });

  it("gracefully degrades when delimiters are missing", async () => {
    mockAi.mockResolvedValue("Just a raw letter with no delimiters.");
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        role: "PM",
        candidate: "Alex",
        baseSalary: "$150,000",
        equity: "15,000",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.offerLetter).toContain("Just a raw letter");
    expect(body.result.atWillDisclaimer).toBe("");
    expect(body.result.nextSteps).toEqual([]);
  });
});
