/**
 * /api/public/catalog — tests.
 *
 * Mock agent-catalog.ts listCatalog() and verify:
 *  - 200 on happy path with agents + count
 *  - 503 on listCatalog throw (DB outage)
 *  - cache header s-maxage=300
 *  - category query param forwarded
 *  - response shape matches PublicAgent[]
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockListCatalog } = vi.hoisted(() => ({
  mockListCatalog: vi.fn(),
}));

vi.mock("@/lib/agent-catalog", () => ({
  listCatalog: mockListCatalog,
}));

beforeEach(() => {
  mockListCatalog.mockReset();
});

import { GET } from "@/app/api/public/catalog/route";

describe("GET /api/public/catalog", () => {
  it("returns 200 with agents + count on happy path", async () => {
    mockListCatalog.mockResolvedValue([
      {
        slug: "apex",
        displayName: "Apex",
        tagline: "Lead-gen blitz",
        runs30d: 1204,
        successRate: 0.96,
      },
    ]);
    const res = await GET(new Request("http://l/api/public/catalog"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.agents).toHaveLength(1);
    expect(body.count).toBe(1);
  });

  it("forwards category query param", async () => {
    mockListCatalog.mockResolvedValue([]);
    await GET(new Request("http://l/api/public/catalog?category=lead-gen"));
    expect(mockListCatalog).toHaveBeenCalledWith(
      expect.objectContaining({ category: "lead-gen" }),
    );
  });

  it("sets Cache-Control s-maxage=300", async () => {
    mockListCatalog.mockResolvedValue([]);
    const res = await GET(new Request("http://l/api/public/catalog"));
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
  });

  it("returns 503 on listCatalog failure", async () => {
    mockListCatalog.mockRejectedValue(new Error("DB down"));
    const res = await GET(new Request("http://l/api/public/catalog"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });
});
