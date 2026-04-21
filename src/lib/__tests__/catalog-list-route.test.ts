/**
 * GET /api/catalog — list endpoint tests.
 *
 * Thin route — delegates to listCatalog(), adds a counts rollup.
 * We verify the query-param plumbing and the response shape.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockListCatalog } = vi.hoisted(() => ({
  mockListCatalog: vi.fn(),
}));

vi.mock("@/lib/agent-catalog", () => ({
  listCatalog: mockListCatalog,
}));

import { GET } from "@/app/api/catalog/route";

beforeEach(() => {
  mockListCatalog.mockReset();
});

describe("GET /api/catalog", () => {
  it("returns agents + per-category counts + total", async () => {
    mockListCatalog.mockResolvedValue([
      { slug: "seo-dominator", displayName: "SEO Dominator", category: "content", featured: true, runs30d: 42 },
      { slug: "content-machine", displayName: "Content Machine", category: "content", featured: false, runs30d: 10 },
      { slug: "lead-blitz", displayName: "Lead Blitz", category: "leads", featured: true, runs30d: 5 },
    ]);

    const res = await GET(new Request("http://l/api/catalog"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.agents).toHaveLength(3);
    expect(body.total).toBe(3);
    expect(body.counts.content).toBe(2);
    expect(body.counts.leads).toBe(1);
  });

  it("passes category filter through to listCatalog", async () => {
    mockListCatalog.mockResolvedValue([]);
    await GET(new Request("http://l/api/catalog?category=leads"));
    expect(mockListCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ category: "leads" }),
    );
  });

  it("passes limit through to listCatalog and clamps to sane max", async () => {
    mockListCatalog.mockResolvedValue([]);
    await GET(new Request("http://l/api/catalog?limit=50"));
    expect(mockListCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 }),
    );

    mockListCatalog.mockClear();
    await GET(new Request("http://l/api/catalog?limit=99999"));
    expect(mockListCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 500 }), // clamped
    );
  });

  it("sets Cache-Control for edge caching", async () => {
    mockListCatalog.mockResolvedValue([]);
    const res = await GET(new Request("http://l/api/catalog"));
    expect(res.headers.get("Cache-Control")).toContain("max-age=60");
  });

  it("returns empty counts when there are no agents", async () => {
    mockListCatalog.mockResolvedValue([]);
    const res = await GET(new Request("http://l/api/catalog"));
    const body = await res.json();
    expect(body.agents).toEqual([]);
    expect(body.counts).toEqual({});
    expect(body.total).toBe(0);
  });
});
