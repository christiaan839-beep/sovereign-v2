/**
 * Tests for src/lib/marketplace-core.ts — Cook 62.
 *
 *   - validateListing: slug regex, price range, name + description caps.
 *   - splitRevenue:
 *       - sums always equal totalCents (no fee leakage).
 *       - rejects bad inputs.
 *       - banker's rounding tie cases.
 *   - transition: every legal pair allowed; illegal pairs rejected.
 *   - publish requires safety layer + non-zero price.
 */

import { describe, it, expect } from "vitest";
import {
  validateListing,
  splitRevenue,
  transition,
  MARKETPLACE_CONSTANTS,
  type MarketplaceListing,
} from "../marketplace-core";

const BASE: MarketplaceListing = {
  slug: "third-party-lead-blitz",
  developerId: "dev-acme",
  displayName: "Third-Party Lead Blitz",
  description: "Outbound prospect enrichment with personalized angles.",
  pricePerRunCents: 25,
  status: "draft",
  safetyLayers: ["jailbreak", "content-safety"],
};

describe("validateListing", () => {
  it("accepts a clean listing", () => {
    expect(validateListing(BASE).ok).toBe(true);
  });

  it("rejects invalid slugs", () => {
    expect(validateListing({ ...BASE, slug: "BadCase" }).ok).toBe(false);
    expect(validateListing({ ...BASE, slug: "" }).ok).toBe(false);
    expect(validateListing({ ...BASE, slug: "a".repeat(65) }).ok).toBe(false);
  });

  it("rejects oversize description", () => {
    expect(
      validateListing({
        ...BASE,
        description: "x".repeat(MARKETPLACE_CONSTANTS.MAX_DESCRIPTION + 1),
      }).ok,
    ).toBe(false);
  });

  it("rejects negative or fractional prices", () => {
    expect(validateListing({ ...BASE, pricePerRunCents: -1 }).ok).toBe(false);
    expect(validateListing({ ...BASE, pricePerRunCents: 1.5 }).ok).toBe(false);
  });

  it("rejects empty developerId", () => {
    expect(validateListing({ ...BASE, developerId: "" }).ok).toBe(false);
  });
});

describe("splitRevenue", () => {
  it("sums always equal totalCents (no leakage)", () => {
    for (const total of [0, 1, 99, 100, 137, 1234, 999_999]) {
      for (const f of [0, 0.1, 0.25, 0.3, 0.5, 0.75, 0.9, 1.0]) {
        const r = splitRevenue(total, f);
        expect(r.platformCents + r.developerCents).toBe(total);
      }
    }
  });

  it("default platform fee is 30 %", () => {
    const r = splitRevenue(100);
    expect(r.platformCents).toBe(30);
    expect(r.developerCents).toBe(70);
  });

  it("rounds half-to-even (banker's)", () => {
    // 5 cents at 50 % = 2.5 → round to 2 (even). developer = 3.
    const r = splitRevenue(5, 0.5);
    expect(r.platformCents).toBe(2);
    expect(r.developerCents).toBe(3);
  });

  it("rejects bad inputs", () => {
    expect(() => splitRevenue(-1)).toThrow();
    expect(() => splitRevenue(1.5)).toThrow();
    expect(() => splitRevenue(100, -0.1)).toThrow();
    expect(() => splitRevenue(100, 1.1)).toThrow();
  });
});

describe("transition — allowed paths", () => {
  it("draft → submitted", () => {
    const r = transition(BASE, "submitted");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.listing!.status).toBe("submitted");
  });

  it("submitted → approved", () => {
    const r = transition({ ...BASE, status: "submitted" }, "approved");
    expect(r.ok).toBe(true);
  });

  it("submitted → rejected", () => {
    const r = transition({ ...BASE, status: "submitted" }, "rejected");
    expect(r.ok).toBe(true);
  });

  it("approved → published (with safety + price)", () => {
    const r = transition({ ...BASE, status: "approved" }, "published");
    expect(r.ok).toBe(true);
  });

  it("published → unpublished and back", () => {
    const off = transition({ ...BASE, status: "published" }, "unpublished");
    expect(off.ok).toBe(true);
    const on = transition({ ...BASE, status: "unpublished" }, "published");
    expect(on.ok).toBe(true);
  });

  it("rejected → draft (resubmission cycle)", () => {
    const r = transition({ ...BASE, status: "rejected" }, "draft");
    expect(r.ok).toBe(true);
  });
});

describe("transition — illegal paths", () => {
  it("draft → published is rejected", () => {
    const r = transition(BASE, "published");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid-transition");
  });

  it("approved → draft is rejected", () => {
    const r = transition({ ...BASE, status: "approved" }, "draft");
    expect(r.ok).toBe(false);
  });

  it("publishing without a safety layer is rejected", () => {
    const r = transition(
      { ...BASE, status: "approved", safetyLayers: [] },
      "published",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("missing-safety-layer");
  });

  it("publishing at zero price is rejected", () => {
    const r = transition(
      { ...BASE, status: "approved", pricePerRunCents: 0 },
      "published",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid-price");
  });

  it("invalid listing blocks any transition", () => {
    const r = transition({ ...BASE, slug: "BAD" }, "submitted");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid-listing");
  });
});
