/**
 * agent-upgrader route smoke tests.
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

import { POST } from "@/app/api/_agents/agent-upgrader/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/agent-upgrader", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("agent-upgrader", () => {
  it("returns parsed upgrade on valid JSON", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        proposedPrompt: "You are X. Always include currency in ISO 4217.",
        changes: ["Added: 'Always include currency in ISO 4217.'"],
        hypothesis: "Model was dropping currency field when input used a symbol.",
        risksOfChange: ["May over-specify currency on documents that truly lack it."],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        currentPrompt: "You are X.",
        failures: [{ input: "$100 invoice", output: '{"amount":100}', whyFailed: "missing currency" }],
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.upgrade.changes).toHaveLength(1);
    expect(body.upgrade.hypothesis).toContain("currency");
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"proposedPrompt":"p","changes":[],"hypothesis":"h","risksOfChange":[]}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ currentPrompt: "x", failures: [] }),
    );
    const body = await res.json();
    expect(body.upgrade.proposedPrompt).toBe("p");
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("nope");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ currentPrompt: "x", failures: [] }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
