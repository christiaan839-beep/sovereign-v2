/**
 * Tests for agent-bundles — split math + graceful no-DB paths.
 *
 * DB-connected paths (createBundle, getBundleBySlug, listPublicBundles)
 * are integration-tested against a seeded Neon branch.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  bundleDiscountPct,
  createBundle,
  getBundleBySlug,
  listPublicBundles,
  splitBundleEarnings,
  sumOfComponentPrices,
  type Bundle,
} from "../agent-bundles";

/* ─── splitBundleEarnings ─────────────────────────────────────── */

describe("splitBundleEarnings()", () => {
  it("splits 70/30 with three equal-share members at $1.00", () => {
    const r = splitBundleEarnings({
      priceCents: 100,
      creatorSharePct: 70,
      members: [
        { agentId: "a", agentSlug: "a", sharePct: 34 },
        { agentId: "b", agentSlug: "b", sharePct: 33 },
        { agentId: "c", agentSlug: "c", sharePct: 33 },
      ],
    });
    expect(r.platformCents).toBe(30);
    expect(r.creatorPoolCents).toBe(70);
    expect(r.perMember).toHaveLength(3);
    // Sum of member shares must equal the creator pool.
    expect(r.perMember.reduce((n, m) => n + m.creatorCents, 0)).toBe(70);
  });

  it("honors custom creator_share_pct (50/50 bundle)", () => {
    const r = splitBundleEarnings({
      priceCents: 1000,
      creatorSharePct: 50,
      members: [
        { agentId: "a", agentSlug: "a", sharePct: 100 },
      ],
    });
    expect(r.platformCents).toBe(500);
    expect(r.perMember[0].creatorCents).toBe(500);
  });

  it("proportionally re-normalises when shares don't sum to 100", () => {
    // Declared shares [30, 30, 35] = 95 total → scale so sum = pool.
    const r = splitBundleEarnings({
      priceCents: 1000,
      creatorSharePct: 70,
      members: [
        { agentId: "a", agentSlug: "a", sharePct: 30 },
        { agentId: "b", agentSlug: "b", sharePct: 30 },
        { agentId: "c", agentSlug: "c", sharePct: 35 },
      ],
    });
    expect(r.creatorPoolCents).toBe(700);
    expect(r.perMember.reduce((n, m) => n + m.creatorCents, 0)).toBe(700);
  });

  it("returns zero splits for a zero-price bundle", () => {
    const r = splitBundleEarnings({
      priceCents: 0,
      creatorSharePct: 70,
      members: [{ agentId: "a", agentSlug: "a", sharePct: 100 }],
    });
    expect(r.platformCents).toBe(0);
    expect(r.creatorPoolCents).toBe(0);
    expect(r.perMember).toEqual([]);
  });

  it("rounding remainder flows to first member, not platform", () => {
    // 7 cents at 70% = 4.9 creator cents. Floor to 4, remainder 1
    // should go to the first member (never platform).
    const r = splitBundleEarnings({
      priceCents: 7,
      creatorSharePct: 70,
      members: [
        { agentId: "a", agentSlug: "a", sharePct: 33 },
        { agentId: "b", agentSlug: "b", sharePct: 33 },
        { agentId: "c", agentSlug: "c", sharePct: 34 },
      ],
    });
    // Platform floored to Math.floor(7 * 30 / 100) = 2 cents
    expect(r.platformCents).toBe(2);
    expect(r.creatorPoolCents).toBe(5);
    expect(r.perMember.reduce((n, m) => n + m.creatorCents, 0)).toBe(5);
  });

  it("handles zero-member bundles gracefully (edge case)", () => {
    const r = splitBundleEarnings({
      priceCents: 100,
      creatorSharePct: 70,
      members: [],
    });
    expect(r.platformCents).toBe(30);
    expect(r.creatorPoolCents).toBe(70);
    expect(r.perMember).toEqual([]);
  });

  it("clamps out-of-range creator_share_pct to [0, 100]", () => {
    const over = splitBundleEarnings({
      priceCents: 100,
      creatorSharePct: 150,
      members: [{ agentId: "a", agentSlug: "a", sharePct: 100 }],
    });
    expect(over.platformCents).toBe(0);
    expect(over.creatorPoolCents).toBe(100);

    const under = splitBundleEarnings({
      priceCents: 100,
      creatorSharePct: -50,
      members: [{ agentId: "a", agentSlug: "a", sharePct: 100 }],
    });
    expect(under.platformCents).toBe(100);
    expect(under.creatorPoolCents).toBe(0);
  });

  it("handles fractional input price by flooring", () => {
    const r = splitBundleEarnings({
      priceCents: 99.7,
      creatorSharePct: 70,
      members: [{ agentId: "a", agentSlug: "a", sharePct: 100 }],
    });
    expect(r.platformCents + r.creatorPoolCents).toBe(99);
  });
});

/* ─── Helpers ─────────────────────────────────────────────────── */

describe("sumOfComponentPrices() + bundleDiscountPct()", () => {
  const bundle: Bundle = {
    id: "x",
    slug: "x",
    name: "x",
    description: "x",
    category: "x",
    publisherEmail: "a@b.c",
    priceCents: 400,
    creatorSharePct: 70,
    isPublic: true,
    publishedAt: new Date(),
    members: [
      { agentId: "a", agentSlug: "a", agentName: "A", sharePct: 50, position: 0, agentPriceCents: 300 },
      { agentId: "b", agentSlug: "b", agentName: "B", sharePct: 50, position: 1, agentPriceCents: 200 },
    ],
  };

  it("sums component prices correctly", () => {
    expect(sumOfComponentPrices(bundle)).toBe(500);
  });

  it("computes discount vs sum-of-components", () => {
    expect(bundleDiscountPct(bundle)).toBe(20); // 400 is 20% off 500
  });

  it("returns 0 discount when bundle costs same as sum", () => {
    expect(bundleDiscountPct({ ...bundle, priceCents: 500 })).toBe(0);
  });

  it("returns 0 discount when bundle costs MORE than sum (never negative)", () => {
    expect(bundleDiscountPct({ ...bundle, priceCents: 600 })).toBe(0);
  });

  it("returns 0 discount for empty bundle", () => {
    expect(bundleDiscountPct({ ...bundle, priceCents: 100, members: [] })).toBe(0);
  });
});

/* ─── DB functions — graceful no-DB ───────────────────────────── */

describe("agent-bundles DB functions — no-DB path", () => {
  const ORIG = process.env.DATABASE_URL;
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIG;
  });

  it("getBundleBySlug returns null without a DB", async () => {
    expect(await getBundleBySlug("anything")).toBeNull();
  });

  it("getBundleBySlug returns null for empty slug regardless of DB", async () => {
    process.env.DATABASE_URL = "postgres://unused";
    expect(await getBundleBySlug("")).toBeNull();
  });

  it("listPublicBundles returns [] without a DB", async () => {
    expect(await listPublicBundles()).toEqual([]);
  });

  it("listPublicBundles accepts custom options without throwing", async () => {
    await expect(
      listPublicBundles({ category: "Finance", limit: 5 }),
    ).resolves.toEqual([]);
  });

  it("createBundle returns no_db error without a DB", async () => {
    const r = await createBundle({
      slug: "x",
      name: "X",
      description: "",
      category: "Growth",
      publisherEmail: "a@b.c",
      priceCents: 100,
      members: [{ agentSlug: "a", sharePct: 100 }],
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("no_db");
  });

  it("createBundle rejects shares that don't sum to 100 BEFORE hitting DB", async () => {
    process.env.DATABASE_URL = "postgres://unused";
    const r = await createBundle({
      slug: "x",
      name: "X",
      description: "",
      category: "Growth",
      publisherEmail: "a@b.c",
      priceCents: 100,
      members: [
        { agentSlug: "a", sharePct: 50 },
        { agentSlug: "b", sharePct: 40 },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("shares_must_sum_to_100");
  });
});
