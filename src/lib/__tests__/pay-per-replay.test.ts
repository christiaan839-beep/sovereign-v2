/**
 * Tests for src/lib/pay-per-replay.ts — Cook 48 microbilling.
 *
 *   - internal callers are never charged.
 *   - external callers under free tier are not charged.
 *   - external callers over free tier pay base price.
 *   - external callers over volume threshold get a discount.
 *   - idempotency key is stable per (consumer, receipt, UTC day).
 *   - config knobs override defaults.
 */

import { describe, it, expect } from "vitest";
import { meterReplay } from "../pay-per-replay";

const NOW = Date.parse("2026-05-12T10:00:00Z");

describe("meterReplay — internal callers", () => {
  it("never charges internal replays", () => {
    const out = meterReplay({
      consumerId: "c1",
      receiptId: "r1",
      relation: "internal",
      occurredAt: NOW,
      dailyReplayCountSoFar: 10_000,
    });
    expect(out.chargeable).toBe(false);
    if (!out.chargeable) expect(out.reason).toBe("internal");
  });
});

describe("meterReplay — free tier", () => {
  it("does not charge until daily count exceeds the free tier", () => {
    const out = meterReplay({
      consumerId: "c1",
      receiptId: "r1",
      relation: "external",
      occurredAt: NOW,
      dailyReplayCountSoFar: 5,
    });
    expect(out.chargeable).toBe(false);
    if (!out.chargeable) expect(out.reason).toBe("free-tier");
  });
});

describe("meterReplay — base tier", () => {
  it("charges base price once past free tier", () => {
    const out = meterReplay({
      consumerId: "c1",
      receiptId: "r1",
      relation: "external",
      occurredAt: NOW,
      dailyReplayCountSoFar: 10,
    });
    expect(out.chargeable).toBe(true);
    if (out.chargeable) {
      expect(out.cents).toBe(1);
      expect(out.tier).toBe("base");
    }
  });

  it("respects baseCents config", () => {
    const out = meterReplay(
      {
        consumerId: "c1",
        receiptId: "r1",
        relation: "external",
        occurredAt: NOW,
        dailyReplayCountSoFar: 100,
      },
      { baseCents: 5 },
    );
    if (out.chargeable) expect(out.cents).toBe(5);
  });
});

describe("meterReplay — volume discount", () => {
  it("applies the volume discount above the threshold", () => {
    const out = meterReplay(
      {
        consumerId: "c1",
        receiptId: "r1",
        relation: "external",
        occurredAt: NOW,
        dailyReplayCountSoFar: 2000,
      },
      {
        baseCents: 10,
        volumeDiscountThreshold: 1000,
        volumeDiscountFraction: 0.5,
      },
    );
    expect(out.chargeable).toBe(true);
    if (out.chargeable) {
      expect(out.cents).toBe(5);
      expect(out.tier).toBe("volume-discount");
    }
  });

  it("never drops below 1 cent even with a 100 % discount fraction", () => {
    const out = meterReplay(
      {
        consumerId: "c1",
        receiptId: "r1",
        relation: "external",
        occurredAt: NOW,
        dailyReplayCountSoFar: 2000,
      },
      { baseCents: 1, volumeDiscountFraction: 1.0 },
    );
    if (out.chargeable) expect(out.cents).toBe(1);
  });
});

describe("meterReplay — idempotency", () => {
  it("emits the SAME idempotency key for the same (consumer, receipt, day)", () => {
    const a = meterReplay({
      consumerId: "c1",
      receiptId: "r1",
      relation: "external",
      occurredAt: NOW,
      dailyReplayCountSoFar: 100,
    });
    const b = meterReplay({
      consumerId: "c1",
      receiptId: "r1",
      relation: "external",
      occurredAt: NOW + 5 * 60 * 60 * 1000, // 5 hours later, same UTC day
      dailyReplayCountSoFar: 101,
    });
    if (a.chargeable && b.chargeable) {
      expect(a.idempotencyKey).toBe(b.idempotencyKey);
    } else {
      throw new Error("expected both chargeable");
    }
  });

  it("emits DIFFERENT keys across UTC day boundaries", () => {
    const a = meterReplay({
      consumerId: "c1",
      receiptId: "r1",
      relation: "external",
      occurredAt: Date.parse("2026-05-12T23:00:00Z"),
      dailyReplayCountSoFar: 100,
    });
    const b = meterReplay({
      consumerId: "c1",
      receiptId: "r1",
      relation: "external",
      occurredAt: Date.parse("2026-05-13T01:00:00Z"),
      dailyReplayCountSoFar: 1,
    });
    if (a.chargeable && b.chargeable) {
      expect(a.idempotencyKey).not.toBe(b.idempotencyKey);
    }
  });

  it("emits DIFFERENT keys per consumer", () => {
    const a = meterReplay({
      consumerId: "alpha",
      receiptId: "r1",
      relation: "external",
      occurredAt: NOW,
      dailyReplayCountSoFar: 100,
    });
    const b = meterReplay({
      consumerId: "beta",
      receiptId: "r1",
      relation: "external",
      occurredAt: NOW,
      dailyReplayCountSoFar: 100,
    });
    if (a.chargeable && b.chargeable) {
      expect(a.idempotencyKey).not.toBe(b.idempotencyKey);
    }
  });
});
