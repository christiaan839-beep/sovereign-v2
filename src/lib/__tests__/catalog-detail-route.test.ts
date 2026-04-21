/**
 * GET /api/catalog/[slug] — single agent detail tests.
 *
 * Next.js 15+ passes params as a Promise; we unwrap it in the route.
 * Test cases: found → 200, not-found → 404, cache headers present.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetAgentPublic } = vi.hoisted(() => ({
  mockGetAgentPublic: vi.fn(),
}));

vi.mock("@/lib/agent-catalog", () => ({
  getAgentPublic: mockGetAgentPublic,
}));

import { GET } from "@/app/api/catalog/[slug]/route";

beforeEach(() => {
  mockGetAgentPublic.mockReset();
});

describe("GET /api/catalog/[slug]", () => {
  it("returns the agent when slug exists", async () => {
    mockGetAgentPublic.mockResolvedValue({
      slug: "seo-dominator",
      displayName: "SEO Dominator",
      category: "content",
      runs30d: 42,
      successRate: 0.95,
    });
    const res = await GET(
      new Request("http://l/api/catalog/seo-dominator"),
      { params: Promise.resolve({ slug: "seo-dominator" }) },
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.agent.slug).toBe("seo-dominator");
    expect(mockGetAgentPublic).toHaveBeenCalledWith("seo-dominator");
  });

  it("returns 404 when slug not found", async () => {
    mockGetAgentPublic.mockResolvedValue(null);
    const res = await GET(
      new Request("http://l/api/catalog/ghost"),
      { params: Promise.resolve({ slug: "ghost" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  it("sets Cache-Control for edge caching on hits", async () => {
    mockGetAgentPublic.mockResolvedValue({ slug: "a", displayName: "A" });
    const res = await GET(
      new Request("http://l/api/catalog/a"),
      { params: Promise.resolve({ slug: "a" }) },
    );
    expect(res.headers.get("Cache-Control")).toContain("max-age");
  });

  it("does NOT cache 404s (so seed runs surface quickly)", async () => {
    mockGetAgentPublic.mockResolvedValue(null);
    const res = await GET(
      new Request("http://l/api/catalog/ghost"),
      { params: Promise.resolve({ slug: "ghost" }) },
    );
    const cc = res.headers.get("Cache-Control") ?? "";
    // Should not claim long-lived cache on a miss
    expect(cc).not.toMatch(/max-age=\d{2,}/);
  });
});
