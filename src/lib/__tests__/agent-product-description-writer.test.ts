/**
 * product-description-writer route smoke tests.
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

import { POST } from "@/app/api/_agents/product-description-writer/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/product-description-writer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("product-description-writer", () => {
  it("parses all five delimited sections", async () => {
    mockAi.mockResolvedValue(
      `===SHORT===
The last travel mug you'll ever buy.
===LONG===
Crafted from double-wall vacuum-sealed stainless steel, this mug keeps coffee hot for 12 hours and cold brew icy for 24.

Built for commuters who refuse to settle.
===BULLETS===
- Keeps hot for 12 hrs
- Keeps cold for 24 hrs
- Fits car cupholders
- Leakproof locking lid
- Dishwasher safe
===SEO_TITLE===
Ultimate Travel Mug — 12hr Hot, 24hr Cold
===SEO_META===
Stainless steel travel mug that keeps coffee hot 12 hours or cold 24 hours. Leakproof lid, fits cupholders, dishwasher safe. Shop now.`,
    );

    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        productName: "Sovereign Travel Mug",
        features: ["Double-wall vacuum", "Leakproof lid", "Fits cupholders"],
        targetMarket: "commuters",
        platform: "shopify",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.shortDescription).toContain("travel mug");
    expect(body.result.longDescription).toContain("commuters");
    expect(body.result.bulletPoints).toHaveLength(5);
    expect(body.result.bulletPoints[0]).not.toMatch(/^[-*]/);
    expect(body.result.seoTitle).toContain("Mug");
    expect(body.result.seoMetaDescription).toContain("hours");
  });

  it("accepts features as a single string", async () => {
    mockAi.mockResolvedValue(
      `===SHORT===
Clean soap.
===LONG===
Long description here.
===BULLETS===
- one
- two
===SEO_TITLE===
title
===SEO_META===
meta`,
    );

    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        productName: "Soap",
        features: "handmade with lavender and shea butter",
        targetMarket: "gift buyers",
        platform: "etsy",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.bulletPoints).toHaveLength(2);
  });

  it("gracefully degrades when delimiters are missing", async () => {
    mockAi.mockResolvedValue("Just some prose with no delimiters at all.");
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({
        productName: "Widget",
        features: "feature",
        targetMarket: "market",
      }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.shortDescription).toBe("");
    expect(body.result.bulletPoints).toEqual([]);
  });
});
