/**
 * dispute-resolver route smoke tests.
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

import { POST } from "@/app/api/_agents/dispute-resolver/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/dispute-resolver", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("dispute-resolver", () => {
  it("returns producer-fault verdict with refund on spec violation", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        verdict: "producer-fault",
        remediation: "Re-run with currency field enforced.",
        shouldRefund: true,
        shouldRetry: true,
        preventRecurrence: "Add 'currency is REQUIRED (ISO 4217)' to invoice-extractor system prompt.",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        producerAgent: "invoice-extractor",
        consumerAgent: "expense-categorizer",
        rejectedOutput: '{"vendor":"X","total":100}',
        rejectionReason: "missing required currency field",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.resolution.verdict).toBe("producer-fault");
    expect(body.resolution.shouldRefund).toBe(true);
    expect(body.resolution.shouldRetry).toBe(true);
  });

  it("returns consumer-fault with no refund when goalposts moved", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        verdict: "consumer-fault",
        remediation: "Consumer applied a stricter spec than originally agreed.",
        shouldRefund: false,
        shouldRetry: false,
        preventRecurrence: "Consumer must publish locked spec before transaction.",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        producerAgent: "p",
        consumerAgent: "c",
        rejectedOutput: "output",
        rejectionReason: "not premium enough",
      }),
    );
    const body = await res.json();
    expect(body.resolution.verdict).toBe("consumer-fault");
    expect(body.resolution.shouldRefund).toBe(false);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"verdict":"spec-ambiguous","remediation":"r","shouldRefund":false,"shouldRetry":true,"preventRecurrence":"p"}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ producerAgent: "p", consumerAgent: "c", rejectedOutput: "o", rejectionReason: "r" }),
    );
    const body = await res.json();
    expect(body.resolution.verdict).toBe("spec-ambiguous");
    expect(body.resolution.shouldRefund).toBe(false);
    expect(body.resolution.shouldRetry).toBe(true);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("cannot arbitrate");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ producerAgent: "p", consumerAgent: "c", rejectedOutput: "o", rejectionReason: "r" }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
