/**
 * daily-briefing route smoke tests.
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

import { POST } from "@/app/api/_agents/daily-briefing/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/daily-briefing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("daily-briefing", () => {
  it("produces a structured briefing for a normal day", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        headline: "Three client calls anchor the day; board prep is the highest-leverage block.",
        keyPriorities: [
          "Prep board deck before 10:00",
          "Close loop with Acme on renewal",
          "Review Q2 forecast with CFO",
        ],
        recommendedSequence: [
          "Deep work 08:00-09:45 on board deck",
          "Client call 10:00 with Acme",
          "CFO sync 14:00",
        ],
        risks: [],
        coffeeTime: "07:45",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        meetings: [
          { title: "Acme renewal", time: "10:00", attendees: ["Chris", "Sam"] },
          { title: "CFO sync", time: "14:00" },
        ],
        tasksDue: ["Board deck", "Forecast review"],
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.headline).toBeTruthy();
    expect(body.result.keyPriorities.length).toBeGreaterThan(0);
    expect(body.result.coffeeTime).toMatch(/^\d{2}:\d{2}$/);
  });

  it("handles empty meetings with default coffee time", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        headline: "Clear calendar today — use the space for deep work on the deck.",
        keyPriorities: ["Draft pricing page"],
        recommendedSequence: ["Deep work 09:00-12:00 on pricing"],
        risks: [],
        coffeeTime: "08:00",
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ meetings: [] }),
    );
    const body = await res.json();
    expect(body.result.coffeeTime).toBe("08:00");
  });

  it("rejects non-array meetings input", async () => {
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ meetings: "not-an-array" }),
      ),
    ).rejects.toThrow(/must be an array/);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("cannot generate briefing");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(
        req({ meetings: [{ title: "T", time: "10:00" }] }),
      ),
    ).rejects.toThrow(/non-JSON/);
  });
});
