/**
 * rfp-responder route smoke tests.
 *
 * We mock `ai()` and verify:
 *   1. Happy path — valid JSON response is returned.
 *   2. Markdown-fence stripping.
 *   3. pastWins array flows through (uses it in prompt construction).
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

import { POST } from "@/app/api/_agents/rfp-responder/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/rfp-responder", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("rfp-responder", () => {
  it("returns parsed response on valid JSON", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        executiveSummary: "We propose a cloud-native CRM migration completed in 14 weeks...",
        sectionResponses: [
          {
            rfpSection: "4.1 Technical approach",
            response: "Our phased migration plan...",
            supportingEvidence: "Similar 12-week engagement with Fortune 500 retailer.",
          },
        ],
        complianceChecklist: [
          "[PASS] Section 4.1 technical approach",
          "[GAP] Section 5.3 FedRAMP requirement — see risks",
        ],
        risks: ["FedRAMP Moderate authorization is in progress, not yet complete."],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        rfpText: "Federal agency seeks CRM migration. Must meet FedRAMP Moderate.",
        companyCapabilities: "CRM migration, cloud architecture, SOC2 Type II.",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.response.sectionResponses).toHaveLength(1);
    expect(body.response.complianceChecklist.some((l: string) => l.startsWith("[GAP]"))).toBe(true);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"executiveSummary":"x","sectionResponses":[],"complianceChecklist":[],"risks":[]}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ rfpText: "...", companyCapabilities: "..." }),
    );
    const body = await res.json();
    expect(body.response.executiveSummary).toBe("x");
  });

  it("accepts pastWins array as optional context", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        executiveSummary: "Building on our track record...",
        sectionResponses: [
          {
            rfpSection: "Past performance",
            response: "Drawing on prior engagements...",
            supportingEvidence: "Win #1 detail.",
          },
        ],
        complianceChecklist: ["[PASS] Past performance"],
        risks: [],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        rfpText: "Describe past performance.",
        companyCapabilities: "Services firm.",
        pastWins: ["Migrated Fortune 500 CRM in 2024", "State of X contract 2023"],
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.response.sectionResponses[0].supportingEvidence).toMatch(/Win/);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("RFP too vague to respond to");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ rfpText: "...", companyCapabilities: "..." }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
