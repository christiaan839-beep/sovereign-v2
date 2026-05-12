/**
 * Tests for src/lib/whitelabel-pricing.ts — Cook 57.
 *
 *   - chargeFor:
 *       - flat model returns the fixed rate.
 *       - markup model applies (1 + fraction) * cost with banker's rounding.
 *       - minimumCents floor applied (default 1).
 *       - maximumCents ceiling applied when set.
 *       - negative markup rejected.
 *   - tryTakeToken:
 *       - empty bucket refills over time.
 *       - bucket never exceeds capacity.
 *       - zero capacity always denies.
 *   - priceAndLimit:
 *       - missing config → missing-config decision.
 *       - rate-limited returns chargeCents=0 + allowed=false.
 *       - happy path returns marginCents = charge - cost.
 */

import { describe, it, expect } from "vitest";
import {
  chargeFor,
  tryTakeToken,
  priceAndLimit,
  type WhitelabelConfig,
} from "../whitelabel-pricing";

const FLAT: WhitelabelConfig = {
  domain: "ai.example.com",
  tenantId: "t-1",
  pricing: { kind: "flat", centsPerRun: 25 },
  rateLimitRpm: 60,
};

const MARKUP: WhitelabelConfig = {
  domain: "ai.example.com",
  tenantId: "t-1",
  pricing: { kind: "markup", markupFraction: 0.5 },
  rateLimitRpm: 60,
};

describe("chargeFor — flat model", () => {
  it("returns the fixed rate regardless of cost", () => {
    expect(chargeFor(FLAT, 10)).toBe(25);
    expect(chargeFor(FLAT, 100)).toBe(25);
  });

  it("applies maximumCents ceiling", () => {
    expect(chargeFor({ ...FLAT, maximumCents: 10 }, 10)).toBe(10);
  });

  it("applies minimumCents floor", () => {
    expect(
      chargeFor(
        { ...FLAT, pricing: { kind: "flat", centsPerRun: 0 }, minimumCents: 5 },
        0,
      ),
    ).toBe(5);
  });

  it("default minimumCents floor is 1 cent", () => {
    expect(
      chargeFor({ ...FLAT, pricing: { kind: "flat", centsPerRun: 0 } }, 0),
    ).toBe(1);
  });
});

describe("chargeFor — markup model", () => {
  it("applies (1 + fraction) * cost with banker's rounding", () => {
    expect(chargeFor(MARKUP, 10)).toBe(15);
    expect(chargeFor(MARKUP, 100)).toBe(150);
  });

  it("rejects negative markup", () => {
    expect(() =>
      chargeFor(
        { ...MARKUP, pricing: { kind: "markup", markupFraction: -0.1 } },
        10,
      ),
    ).toThrow(/markup/);
  });

  it("zero markup = pass-through", () => {
    expect(
      chargeFor(
        { ...MARKUP, pricing: { kind: "markup", markupFraction: 0 } },
        17,
      ),
    ).toBe(17);
  });
});

describe("tryTakeToken", () => {
  it("denies when bucket is below 1 token after refill", () => {
    const { allowed } = tryTakeToken(
      { tokens: 0, lastRefillMs: 1000 },
      60,
      1010, // 10ms later → refill 10ms * (60/60_000) = 0.01 tokens
    );
    expect(allowed).toBe(false);
  });

  it("refills over time and allows once a token is available", () => {
    // 60 rpm = 1 token per second. After 1 sec, bucket has 1 token.
    const { allowed, bucket } = tryTakeToken(
      { tokens: 0, lastRefillMs: 0 },
      60,
      1000,
    );
    expect(allowed).toBe(true);
    expect(bucket.tokens).toBeCloseTo(0, 4);
  });

  it("never exceeds capacity", () => {
    const { bucket } = tryTakeToken(
      { tokens: 100, lastRefillMs: 0 },
      60,
      120_000, // 2 minutes later → would refill 120 tokens
    );
    // Capacity is 60; consumed 1 → bucket = 59.
    expect(bucket.tokens).toBeLessThanOrEqual(60);
  });

  it("denies with zero capacity", () => {
    const { allowed } = tryTakeToken({ tokens: 0, lastRefillMs: 0 }, 0, 1000);
    expect(allowed).toBe(false);
  });
});

describe("priceAndLimit", () => {
  it("returns missing-config when config is null", () => {
    const d = priceAndLimit(null, 5, { tokens: 0, lastRefillMs: 0 }, 0);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("missing-config");
  });

  it("returns rate-limited when no token available", () => {
    const d = priceAndLimit(
      FLAT,
      5,
      { tokens: 0, lastRefillMs: 1000 },
      1010, // not enough time elapsed
    );
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("rate-limited");
    expect(d.chargeCents).toBe(0);
  });

  it("happy path charges + records margin", () => {
    const d = priceAndLimit(MARKUP, 10, { tokens: 10, lastRefillMs: 0 }, 0);
    expect(d.allowed).toBe(true);
    expect(d.chargeCents).toBe(15);
    expect(d.costCents).toBe(10);
    expect(d.marginCents).toBe(5);
  });

  it("decision is JSON-serializable", () => {
    const d = priceAndLimit(FLAT, 5, { tokens: 10, lastRefillMs: 0 }, 0);
    expect(() => JSON.parse(JSON.stringify(d))).not.toThrow();
  });
});
