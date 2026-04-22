/**
 * /api/public/agent-builder-demo — tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAi } = vi.hoisted(() => ({ mockAi: vi.fn() }));

vi.mock("@/lib/ai", () => ({ ai: mockAi }));

beforeEach(() => {
  mockAi.mockReset();
});

import { POST } from "@/app/api/public/agent-builder-demo/route";

function req(body: unknown): Request {
  return new Request("http://l/api/public/agent-builder-demo", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/public/agent-builder-demo", () => {
  it("returns generated agent on happy path", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        suggestedSlug: "summarize-interview",
        routeCode: "// route code",
        testCode: "// test code",
        systemPrompt: "You are...",
        outputSchema: "{ summary: string }",
      }),
    );
    const res = await POST(
      req({ purpose: "An agent that summarizes customer interview transcripts with sentiment tags" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.generated.suggestedSlug).toBe("summarize-interview");
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"suggestedSlug":"x","routeCode":"y","testCode":"z","systemPrompt":"a","outputSchema":"b"}\n```',
    );
    const res = await POST(
      req({ purpose: "A generic agent that does something useful for a business team" }),
    );
    const body = await res.json();
    expect(body.generated.suggestedSlug).toBe("x");
  });

  it("returns 400 for purpose under 20 chars", async () => {
    const res = await POST(req({ purpose: "too short" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for purpose over 500 chars", async () => {
    const res = await POST(req({ purpose: "a".repeat(501) }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing purpose", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await POST(
      new Request("http://l/api/public/agent-builder-demo", {
        method: "POST",
        body: "not json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 503 when model output is unparseable (graceful message)", async () => {
    mockAi.mockResolvedValue("I cannot generate code");
    const res = await POST(
      req({ purpose: "An agent to analyze quarterly financial reports end-to-end" }),
    );
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toMatch(/rephrasing/i);
  });

  it("returns 503 when ai() throws", async () => {
    mockAi.mockRejectedValue(new Error("Claude offline"));
    const res = await POST(
      req({ purpose: "An agent to analyze quarterly financial reports end-to-end" }),
    );
    expect(res.status).toBe(503);
  });

  it("sets no-store cache header", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        suggestedSlug: "x",
        routeCode: "a",
        testCode: "b",
        systemPrompt: "c",
        outputSchema: "d",
      }),
    );
    const res = await POST(
      req({ purpose: "A generic agent for testing the cache header behavior" }),
    );
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
