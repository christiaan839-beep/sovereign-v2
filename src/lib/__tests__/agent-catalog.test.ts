/**
 * agent-catalog.ts — unit tests.
 *
 * DB calls are mocked — we exercise the shape transformations and the
 * registry-fallback behaviour, not Postgres itself (that's covered by
 * schema tests + staging integration).
 *
 * Dispatch strategy: the mock inspects which table is queried AND which
 * chain methods were called to distinguish:
 *   - listCatalog  : from(metadata) + leftJoin + groupBy  → mockListRows
 *   - getAgentPublic metadata lookup : from(metadata) + limit  → mockMetadataRow
 *   - getAgentPublic reviews agg     : from(reviews)          → mockReviewAgg
 *   - getAgentPublic stats agg       : from(stats)            → mockStatsAgg
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockListRows, mockMetadataRow, mockReviewAgg, mockStatsAgg } = vi.hoisted(() => ({
  mockListRows: vi.fn(),
  mockMetadataRow: vi.fn(),
  mockReviewAgg: vi.fn(),
  mockStatsAgg: vi.fn(),
}));

vi.mock("@/db", () => {
  type Ctx = { table: string; hasLeftJoin: boolean };

  const resolve = (ctx: Ctx): Promise<unknown[]> => {
    if (ctx.table === "reviews") return Promise.resolve(mockReviewAgg());
    if (ctx.table === "stats") return Promise.resolve(mockStatsAgg());
    if (ctx.table === "metadata" && ctx.hasLeftJoin) return Promise.resolve(mockListRows());
    return Promise.resolve(mockMetadataRow()); // metadata single lookup
  };

  const chain = (ctx: Ctx) => {
    const c: Record<string, unknown> = {};
    c.from = () => c;
    c.leftJoin = () => { ctx.hasLeftJoin = true; return c; };
    c.where = () => c;
    c.groupBy = () => c;
    c.orderBy = () => c;
    c.limit = () => c;
    // Terminal — awaiting the chain resolves to the query result
    (c as { then?: unknown }).then = (cb: (rows: unknown[]) => unknown) =>
      resolve(ctx).then(cb);
    return c;
  };

  return {
    db: {
      select: (_cols?: unknown) => ({
        from: (table: { _type?: string }) => {
          const ctx: Ctx = { table: table?._type ?? "", hasLeftJoin: false };
          return chain(ctx);
        },
      }),
    },
  };
});

vi.mock("@/db/schema", () => ({
  agentMetadata: {
    _type: "metadata",
    slug: "slug",
    displayName: "displayName",
    tagline: "tagline",
    description: "description",
    category: "category",
    icon: "icon",
    heroColor: "heroColor",
    creatorHandle: "creatorHandle",
    pricingCents: "pricingCents",
    tags: "tags",
    featured: "featured",
    verified: "verified",
  },
  agentStatsDaily: {
    _type: "stats",
    agentSlug: "agentSlug",
    day: "day",
    runs: "runs",
    successes: "successes",
    avgDurationMs: "avgDurationMs",
  },
  agentReviews: {
    _type: "reviews",
    agentSlug: "agentSlug",
    rating: "rating",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({ _op: "eq" })),
  and: vi.fn(() => ({ _op: "and" })),
  gte: vi.fn(() => ({ _op: "gte" })),
  desc: vi.fn(() => ({ _op: "desc" })),
  sql: Object.assign(
    (..._args: unknown[]) => ({ _op: "sql" }),
    { raw: (s: string) => s },
  ),
}));

vi.mock("@/app/api/agents/registry", () => ({
  AGENT_REGISTRY: {
    "seo-dominator": () => Promise.resolve({}),
    "lead-blitz": () => Promise.resolve({}),
  },
}));

import { listCatalog, getAgentPublic } from "@/lib/agent-catalog";

beforeEach(() => {
  mockListRows.mockReset();
  mockMetadataRow.mockReset();
  mockReviewAgg.mockReset();
  mockStatsAgg.mockReset();
});

describe("agent-catalog", () => {
  it("listCatalog returns shaped rows from DB with derived successRate", async () => {
    mockListRows.mockResolvedValue([
      {
        slug: "seo-dominator",
        displayName: "SEO Dominator",
        tagline: null,
        description: null,
        category: "content",
        icon: null,
        heroColor: null,
        creatorHandle: null,
        pricingCents: 0,
        tags: ["seo", "content"],
        featured: true,
        verified: false,
        runs30d: 42,
        successes30d: 40,
        avgDurationMs: 1200,
      },
    ]);
    const rows = await listCatalog();
    expect(rows).toHaveLength(1);
    expect(rows[0].slug).toBe("seo-dominator");
    expect(rows[0].runs30d).toBe(42);
    expect(rows[0].successRate).toBeCloseTo(40 / 42);
    expect(rows[0].avgRating).toBeNull(); // listCatalog doesn't fetch reviews
  });

  it("listCatalog tolerates null tags and zero runs", async () => {
    mockListRows.mockResolvedValue([
      {
        slug: "lead-blitz",
        displayName: "Lead Blitz",
        tagline: null,
        description: null,
        category: "leads",
        icon: null,
        heroColor: null,
        creatorHandle: null,
        pricingCents: 0,
        tags: null,
        featured: false,
        verified: false,
        runs30d: 0,
        successes30d: 0,
        avgDurationMs: null,
      },
    ]);
    const rows = await listCatalog();
    expect(rows[0].tags).toEqual([]);
    expect(rows[0].successRate).toBe(0);
  });

  it("getAgentPublic returns null when slug not in registry", async () => {
    const agent = await getAgentPublic("nonexistent-slug");
    expect(agent).toBeNull();
  });

  it("getAgentPublic falls back to humanized displayName when metadata row missing", async () => {
    mockMetadataRow.mockResolvedValue([]);
    const agent = await getAgentPublic("seo-dominator");
    expect(agent).toBeTruthy();
    expect(agent?.displayName).toBe("SEO Dominator");
    expect(agent?.category).toBe("general");
    expect(agent?.runs30d).toBe(0);
  });

  it("getAgentPublic returns full shape when metadata + stats + reviews exist", async () => {
    mockMetadataRow.mockResolvedValue([
      {
        slug: "seo-dominator",
        displayName: "SEO Dominator Pro",
        tagline: "Rank #1 in 30 days",
        description: "Full SEO workflow",
        category: "content",
        icon: null,
        heroColor: "#B5532C",
        creatorHandle: "@sovereign",
        pricingCents: 499,
        tags: ["seo"],
        featured: true,
        verified: true,
      },
    ]);
    mockReviewAgg.mockResolvedValue([{ avgRating: 4.7, reviewCount: 23 }]);
    mockStatsAgg.mockResolvedValue([{ runs: 100, successes: 92, avgDuration: 1500 }]);

    const agent = await getAgentPublic("seo-dominator");
    expect(agent).toMatchObject({
      slug: "seo-dominator",
      displayName: "SEO Dominator Pro",
      pricingCents: 499,
      verified: true,
      runs30d: 100,
      avgRating: 4.7,
      reviewCount: 23,
    });
    expect(agent?.successRate).toBeCloseTo(0.92);
  });
});
