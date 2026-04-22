/**
 * invoice-extractor route smoke tests.
 *
 * We don't exercise the full agent-factory (auth, rate-limit, audit
 * trail — those have their own coverage in agent-factory.test.ts).
 * We mock `ai()` and verify:
 *   1. The route exports a POST handler.
 *   2. The handler returns `success: true` with a parsed `extracted`
 *      object when the model returns valid JSON.
 *   3. The handler throws when the model returns non-JSON (so
 *      agent-factory's error envelope kicks in).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAi } = vi.hoisted(() => ({ mockAi: vi.fn() }));

vi.mock("@/lib/ai", () => ({
  ai: mockAi,
  research_ai: vi.fn(),
}));

// The factory is heavy — mock to a passthrough so we can call the
// handler directly in tests without booting the full middleware stack.
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

import { POST } from "@/app/api/_agents/invoice-extractor/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/invoice-extractor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("invoice-extractor", () => {
  it("returns parsed invoice on valid JSON from model", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        vendor: { name: "Acme Inc", address: "1 Main St", email: null, phone: null, taxId: null },
        invoice: { number: "INV-001", date: "2026-04-01", dueDate: null, currency: "USD" },
        lineItems: [{ description: "Widget", quantity: 2, unitPrice: 50, total: 100 }],
        totals: { subtotal: 100, tax: 8, total: 108 },
        confidence: 0.95,
        warnings: [],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ text: "Invoice INV-001 from Acme Inc. Total $108." }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.extracted.vendor.name).toBe("Acme Inc");
    expect(body.extracted.totals.total).toBe(108);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"vendor":{"name":"X"},"invoice":{"number":"I","date":"2026-01-01","currency":"USD"},"lineItems":[],"totals":{"subtotal":0,"tax":0,"total":0},"confidence":1,"warnings":[]}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(req({ text: "..." }));
    const body = await res.json();
    expect(body.extracted.vendor.name).toBe("X");
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("sorry, I cannot parse this");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(req({ text: "..." })),
    ).rejects.toThrow(/non-JSON/);
  });
});
