/**
 * listing-writer route smoke tests.
 *
 * We mock `ai()` and verify:
 *   1. Happy path — valid JSON listing variants are returned.
 *   2. Markdown-fence stripping.
 *   3. Custom style + platforms path flows through.
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

import { POST } from "@/app/api/_agents/listing-writer/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/listing-writer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("listing-writer", () => {
  it("returns parsed listing on valid JSON", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        mlsDescription: "3BR/2BA, 1,850 sqft ranch on 0.25 acre lot. Updated kitchen...",
        zillowDescription:
          "Picture yourself sipping coffee on the screened back porch while the kids...",
        airbnbDescription: "Welcome! Our sunny ranch is the perfect basecamp for exploring...",
        headlines: ["Updated Ranch on Quarter-Acre", "Move-In Ready 3BR in Maplewood"],
        disclaimers: ["Square footage approximate; buyer to verify."],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ facts: "3 beds, 2 baths, 1850 sqft ranch, quarter-acre, Maplewood." }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.listing.mlsDescription).toMatch(/1,850 sqft/);
    expect(body.listing.disclaimers.length).toBeGreaterThan(0);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue(
      '```json\n{"mlsDescription":"x","zillowDescription":"y","airbnbDescription":"z","headlines":[],"disclaimers":[]}\n```',
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ facts: "..." }),
    );
    const body = await res.json();
    expect(body.listing.mlsDescription).toBe("x");
  });

  it("accepts custom style and targetPlatforms", async () => {
    mockAi.mockResolvedValue(
      JSON.stringify({
        mlsDescription: "",
        zillowDescription: "",
        airbnbDescription: "Luxury beachfront villa...",
        headlines: ["Oceanfront Villa"],
        disclaimers: [],
      }),
    );
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        facts: "5BR beachfront villa, private pool.",
        targetPlatforms: ["airbnb"],
        style: "luxury",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.listing.airbnbDescription).toMatch(/villa/i);
  });

  it("throws when model returns non-JSON", async () => {
    mockAi.mockResolvedValue("I need more info about the property");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(req({ facts: "..." })),
    ).rejects.toThrow(/non-JSON/);
  });
});
