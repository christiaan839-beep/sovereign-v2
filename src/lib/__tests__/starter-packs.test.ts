/**
 * Tests for src/lib/starter-packs.ts — Cook 149.
 */

import { describe, it, expect } from "vitest";
import {
  STARTER_PACKS,
  annualPriceUsd,
  ctaFor,
  isKnownStarterPack,
  listStarterPacks,
  packsByFamily,
  stripeLinkFor,
} from "../starter-packs";

describe("STARTER_PACKS registry", () => {
  it("includes the $99 founder 1:1", () => {
    const p = STARTER_PACKS["advisory-pack-1h"];
    expect(p).toBeDefined();
    expect(p.priceUsdCents).toBe(29_900);
    expect(p.family).toBe("hour");
  });

  it("includes the $499 verify-your-agent audit", () => {
    expect(STARTER_PACKS["verify-your-agent"].priceUsdCents).toBe(49_900);
  });

  it("every SKU has a contact fallback", () => {
    for (const p of listStarterPacks()) {
      expect(p.contactFallback).toMatch(/^\/contact/);
    }
  });
});

describe("packsByFamily", () => {
  it("returns only the hour family", () => {
    const got = packsByFamily("hour");
    expect(got.length).toBeGreaterThanOrEqual(2);
    expect(got.every((p) => p.family === "hour")).toBe(true);
  });

  it("returns the kit family", () => {
    expect(packsByFamily("kit").length).toBeGreaterThanOrEqual(2);
  });
});

describe("isKnownStarterPack", () => {
  it("accepts canonical ids", () => {
    expect(isKnownStarterPack("verify-your-agent")).toBe(true);
    expect(isKnownStarterPack("advisory-pack-1h")).toBe(true);
  });
  it("rejects unknown ids", () => {
    expect(isKnownStarterPack("nope")).toBe(false);
  });
});

describe("stripeLinkFor", () => {
  const KEY = "STRIPE_LINK_ADVISORY_1H";

  it("returns null when env unset", () => {
    const prev = process.env[KEY];
    delete process.env[KEY];
    try {
      expect(stripeLinkFor("advisory-pack-1h")).toBeNull();
    } finally {
      if (prev !== undefined) process.env[KEY] = prev;
    }
  });

  it("returns env value when set", () => {
    const prev = process.env[KEY];
    process.env[KEY] = "https://buy.stripe.com/test_abc";
    try {
      expect(stripeLinkFor("advisory-pack-1h")).toBe(
        "https://buy.stripe.com/test_abc",
      );
    } finally {
      if (prev !== undefined) process.env[KEY] = prev;
      else delete process.env[KEY];
    }
  });

  it("returns null for an unknown SKU", () => {
    expect(stripeLinkFor("nonexistent")).toBeNull();
  });
});

describe("ctaFor", () => {
  it("falls back to contact when no Stripe link set", () => {
    const KEY = "STRIPE_LINK_ADVISORY_1H";
    const prev = process.env[KEY];
    delete process.env[KEY];
    try {
      const cta = ctaFor("advisory-pack-1h");
      expect(cta.payable).toBe(false);
      expect(cta.url).toBe("/contact?intent=advisory-1h");
    } finally {
      if (prev !== undefined) process.env[KEY] = prev;
    }
  });

  it("uses Stripe link when env is set", () => {
    const KEY = "STRIPE_LINK_ADVISORY_1H";
    const prev = process.env[KEY];
    process.env[KEY] = "https://buy.stripe.com/x";
    try {
      const cta = ctaFor("advisory-pack-1h");
      expect(cta.payable).toBe(true);
      expect(cta.url).toBe("https://buy.stripe.com/x");
    } finally {
      if (prev !== undefined) process.env[KEY] = prev;
      else delete process.env[KEY];
    }
  });

  it("returns a safe fallback for unknown SKUs", () => {
    const cta = ctaFor("nope");
    expect(cta.payable).toBe(false);
    expect(cta.url).toBe("/contact");
  });
});

describe("annualPriceUsd", () => {
  it("returns dollars for a known SKU", () => {
    expect(annualPriceUsd("verify-your-agent")).toBe(499);
  });
  it("returns null for unknown", () => {
    expect(annualPriceUsd("nope")).toBeNull();
  });
});
