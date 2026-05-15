/**
 * Tests for src/lib/add-ons.ts — Cook 138.
 */

import { describe, it, expect } from "vitest";
import {
  ADD_ONS,
  addOnsByFamily,
  addOnsForTier,
  annualPriceUsd,
  bundleAnnualCents,
  isKnownAddOn,
  listAddOns,
  stripePriceId,
} from "../add-ons";

describe("ADD_ONS registry", () => {
  it("contains the canonical Auditor Replay Seat SKU at $50K/yr", () => {
    const a = ADD_ONS["auditor-replay-seat"];
    expect(a).toBeDefined();
    expect(a.priceUsdCentsAnnual).toBe(5_000_000);
    expect(a.unit).toBe("seat");
  });

  it("contains five regulatory packs", () => {
    expect(addOnsByFamily("regulatory-pack")).toHaveLength(5);
  });

  it("contains a crypto-receipt overage SKU", () => {
    const a = ADD_ONS["crypto-receipt-overage"];
    expect(a).toBeDefined();
    expect(a.family).toBe("receipt-api");
  });
});

describe("listAddOns", () => {
  it("returns every SKU in the registry", () => {
    expect(listAddOns()).toHaveLength(Object.keys(ADD_ONS).length);
  });
});

describe("addOnsForTier", () => {
  it("returns nothing for the free tier", () => {
    expect(addOnsForTier("free")).toHaveLength(0);
  });

  it("returns enterprise-only SKUs for enterprise tier", () => {
    const got = addOnsForTier("enterprise").map((a) => a.id);
    expect(got).toContain("regulatory-pack-fedramp");
    expect(got).toContain("auditor-replay-seat");
  });

  it("excludes auditor-replay-seat from the array tier", () => {
    expect(addOnsForTier("array").map((a) => a.id)).not.toContain(
      "auditor-replay-seat",
    );
  });
});

describe("addOnsByFamily", () => {
  it("returns only the auditor-seat family", () => {
    const got = addOnsByFamily("auditor-seat");
    expect(got).toHaveLength(1);
    expect(got[0].id).toBe("auditor-replay-seat");
  });
});

describe("annualPriceUsd", () => {
  it("returns the price for a known SKU", () => {
    expect(annualPriceUsd("auditor-replay-seat")).toBe(50_000);
  });
  it("returns null for an unknown SKU", () => {
    expect(annualPriceUsd("nonexistent")).toBeNull();
  });
});

describe("stripePriceId", () => {
  const KEY = "STRIPE_PRICE_AUDITOR_REPLAY_SEAT";

  it("returns null when env is unset", () => {
    const prev = process.env[KEY];
    delete process.env[KEY];
    try {
      expect(stripePriceId("auditor-replay-seat")).toBeNull();
    } finally {
      if (prev !== undefined) process.env[KEY] = prev;
    }
  });

  it("returns env value when set", () => {
    const prev = process.env[KEY];
    process.env[KEY] = "price_test_123";
    try {
      expect(stripePriceId("auditor-replay-seat")).toBe("price_test_123");
    } finally {
      if (prev !== undefined) process.env[KEY] = prev;
      else delete process.env[KEY];
    }
  });

  it("returns null for an unknown SKU", () => {
    expect(stripePriceId("nonexistent")).toBeNull();
  });
});

describe("isKnownAddOn", () => {
  it("accepts the canonical SKUs", () => {
    expect(isKnownAddOn("auditor-replay-seat")).toBe(true);
    expect(isKnownAddOn("regulatory-pack-csrd")).toBe(true);
  });
  it("rejects an unknown id", () => {
    expect(isKnownAddOn("nope")).toBe(false);
  });
});

describe("bundleAnnualCents", () => {
  it("sums two SKUs correctly", () => {
    // 2 auditor seats + 1 CSRD pack = 2*$50k + $65k = $165k
    const got = bundleAnnualCents([
      { id: "auditor-replay-seat", quantity: 2 },
      { id: "regulatory-pack-csrd", quantity: 1 },
    ]);
    expect(got).toBe(16_500_000);
  });

  it("ignores unknown SKU ids", () => {
    const got = bundleAnnualCents([
      { id: "auditor-replay-seat", quantity: 1 },
      { id: "nope", quantity: 100 },
    ]);
    expect(got).toBe(5_000_000);
  });

  it("ignores negative quantities", () => {
    const got = bundleAnnualCents([
      { id: "auditor-replay-seat", quantity: 1 },
      { id: "regulatory-pack-csrd", quantity: -5 },
    ]);
    expect(got).toBe(5_000_000);
  });

  it("returns zero for an empty bundle", () => {
    expect(bundleAnnualCents([])).toBe(0);
  });
});
