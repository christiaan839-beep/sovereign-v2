/**
 * Tests for src/lib/add-on-provisioner.ts — Cook 146.
 */

import { describe, it, expect } from "vitest";
import { provisionAddOn } from "../add-on-provisioner";

const NOW = 1_700_000_000_000;

describe("provisionAddOn — validation", () => {
  it("throws on missing skuId", () => {
    expect(() =>
      provisionAddOn({ skuId: "", userId: "u1", eventId: "evt_1" }),
    ).toThrow();
  });

  it("throws on unknown SKU", () => {
    expect(() =>
      provisionAddOn({
        skuId: "nope",
        userId: "u1",
        eventId: "evt_1",
      }),
    ).toThrow(/unknown SKU/);
  });

  it("throws on missing userId", () => {
    expect(() =>
      provisionAddOn({
        skuId: "auditor-replay-seat",
        userId: "",
        eventId: "evt_1",
      }),
    ).toThrow();
  });
});

describe("provisionAddOn — auditor-seat family", () => {
  it("issues one seat for default quantity", () => {
    const r = provisionAddOn({
      skuId: "auditor-replay-seat",
      userId: "u1",
      eventId: "evt_1",
      now: NOW,
    });
    expect(r.family).toBe("auditor-seat");
    expect(r.quantity).toBe(1);
    expect(r.seats).toHaveLength(1);
    expect(r.seats?.[0].expiresAt).toBeGreaterThan(NOW);
    expect(r.flagEnabled).toBeUndefined();
    expect(r.meterId).toBeUndefined();
  });

  it("issues N seats matching the quantity", () => {
    const r = provisionAddOn({
      skuId: "auditor-replay-seat",
      userId: "u1",
      eventId: "evt_2",
      quantity: 5,
      now: NOW,
    });
    expect(r.seats).toHaveLength(5);
    expect(r.quantity).toBe(5);
  });

  it("clamps quantity to >= 1", () => {
    const r = provisionAddOn({
      skuId: "auditor-replay-seat",
      userId: "u1",
      eventId: "evt_3",
      quantity: 0,
      now: NOW,
    });
    expect(r.quantity).toBe(1);
    expect(r.seats).toHaveLength(1);
  });

  it("each seat has a unique credential", () => {
    const r = provisionAddOn({
      skuId: "auditor-replay-seat",
      userId: "u1",
      eventId: "evt_4",
      quantity: 3,
      now: NOW,
    });
    const macs = new Set(r.seats?.map((s) => s.mac));
    expect(macs.size).toBe(3);
  });
});

describe("provisionAddOn — regulatory-pack family", () => {
  it("returns a feature-flag key for the pack", () => {
    const r = provisionAddOn({
      skuId: "regulatory-pack-csrd",
      userId: "u1",
      eventId: "evt_5",
      now: NOW,
    });
    expect(r.family).toBe("regulatory-pack");
    expect(r.flagEnabled).toBe("pack:regulatory-pack-csrd");
    expect(r.seats).toBeUndefined();
    expect(r.meterId).toBeUndefined();
  });
});

describe("provisionAddOn — receipt-api family", () => {
  it("binds the meter id to the stripe subscription when present", () => {
    const r = provisionAddOn({
      skuId: "crypto-receipt-overage",
      userId: "u1",
      eventId: "evt_6",
      stripeSubscriptionId: "sub_abc123",
      now: NOW,
    });
    expect(r.family).toBe("receipt-api");
    expect(r.meterId).toBe("meter:receipt:sub_abc123");
  });

  it("falls back to userId when subscription id is absent", () => {
    const r = provisionAddOn({
      skuId: "crypto-receipt-overage",
      userId: "u1",
      eventId: "evt_7",
      now: NOW,
    });
    expect(r.meterId).toBe("meter:receipt:u1");
  });
});

describe("provisionAddOn — common fields", () => {
  it("always echoes the event id and provisionedAt", () => {
    const r = provisionAddOn({
      skuId: "auditor-replay-seat",
      userId: "u1",
      eventId: "evt_traceability",
      now: NOW,
    });
    expect(r.eventId).toBe("evt_traceability");
    expect(r.provisionedAt).toBe(NOW);
  });

  it("respects an explicit family override (defaults to SKU's family)", () => {
    const r = provisionAddOn({
      skuId: "auditor-replay-seat",
      userId: "u1",
      eventId: "evt_x",
      now: NOW,
    });
    expect(r.family).toBe("auditor-seat");
  });
});
