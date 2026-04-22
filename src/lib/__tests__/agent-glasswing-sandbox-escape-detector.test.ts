/**
 * glasswing-sandbox-escape-detector route smoke tests.
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

import { POST } from "@/app/api/_agents/glasswing-sandbox-escape-detector/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/glasswing-sandbox-escape-detector", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("glasswing-sandbox-escape-detector", () => {
  it("flags destructive shell command as high severity / block", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        suspicious: true,
        patterns: [
          {
            type: "shell-command",
            evidence: "sudo rm -rf /",
            severity: "high",
          },
        ],
        recommendation: "block",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ agentOutput: "Run: sudo rm -rf / to clean up" }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.suspicious).toBe(true);
    expect(body.recommendation).toBe("block");
  });

  it("allows benign output with empty patterns", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        suspicious: false,
        patterns: [],
        recommendation: "allow",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ agentOutput: "Here is your quarterly report summary." }),
    );
    const body = await res.json();
    expect(body.suspicious).toBe(false);
    expect(body.recommendation).toBe("allow");
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"suspicious":false,"patterns":[],"recommendation":"allow"}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ agentOutput: "hello" }),
    );
    const body = await res.json();
    expect(body.recommendation).toBe("allow");
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("cannot scan");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(req({ agentOutput: "x" })),
    ).rejects.toThrow(/non-JSON/);
  });
});
