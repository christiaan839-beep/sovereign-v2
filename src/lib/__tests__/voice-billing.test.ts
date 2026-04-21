/**
 * voice-billing.ts — tests.
 *
 * Pure compute tests don't need mocks. Settlement tests mock
 * captureHold/releaseHold/topUp and assert the right one fires
 * with the right amounts for each tier of usage.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCapture, mockRelease, mockTopUp, mockInsert } = vi.hoisted(() => ({
  mockCapture: vi.fn(),
  mockRelease: vi.fn(),
  mockTopUp: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock("@/lib/credits", () => ({
  captureHold: mockCapture,
  releaseHold: mockRelease,
  topUp: mockTopUp,
}));

// Minimal db mock for the usage-marker insert + monthly query.
vi.mock("@/db", () => ({
  db: {
    insert: () => ({ values: mockInsert }),
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([{ totalMinutes: 0 }]),
      }),
    }),
  },
}));
vi.mock("@/db/schema", () => ({
  creditTransactions: { userId: "user_id", createdAt: "created_at", metadata: "metadata" },
}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn(),
  eq: vi.fn(),
  gte: vi.fn(),
  sql: Object.assign(
    (..._args: unknown[]) => ({ _sql: true }),
    { raw: (s: string) => s },
  ),
}));

import {
  computeVoiceCharge,
  computeVoiceChargeForPlan,
  isUnlimitedVoicePlan,
  settleVoiceSession,
} from "@/lib/voice-billing";

beforeEach(() => {
  mockCapture.mockReset();
  mockRelease.mockReset();
  mockTopUp.mockReset();
  mockInsert.mockReset();
  mockCapture.mockResolvedValue(undefined);
  mockRelease.mockResolvedValue(undefined);
  mockTopUp.mockResolvedValue(0);
  mockInsert.mockResolvedValue(undefined);
});

describe("isUnlimitedVoicePlan", () => {
  it("is true for founder + enterprise", () => {
    expect(isUnlimitedVoicePlan("founder")).toBe(true);
    expect(isUnlimitedVoicePlan("enterprise")).toBe(true);
  });
  it("is false for free + starter + growth + node + pay_per_run", () => {
    expect(isUnlimitedVoicePlan("free")).toBe(false);
    expect(isUnlimitedVoicePlan("starter")).toBe(false);
    expect(isUnlimitedVoicePlan("array")).toBe(false);
    expect(isUnlimitedVoicePlan("node")).toBe(false);
    expect(isUnlimitedVoicePlan("pay_per_run")).toBe(false);
  });
});

describe("computeVoiceChargeForPlan", () => {
  const base = { secondsUsed: 180, holdCents: 75 }; // 3 min

  it("founder → 0 regardless of usage", () => {
    expect(
      computeVoiceChargeForPlan({ plan: "founder", minutesUsedThisMonth: 0, ...base }),
    ).toBe(0);
    expect(
      computeVoiceChargeForPlan({ plan: "founder", minutesUsedThisMonth: 100, ...base }),
    ).toBe(0);
  });

  it("enterprise → 0 regardless of usage", () => {
    expect(
      computeVoiceChargeForPlan({ plan: "enterprise", minutesUsedThisMonth: 50, ...base }),
    ).toBe(0);
  });

  it("free plan with full allowance → 0 on a 3-min session", () => {
    expect(
      computeVoiceChargeForPlan({ plan: "free", minutesUsedThisMonth: 0, ...base }),
    ).toBe(0);
  });

  it("free plan with 4 min used + 3 new min → 30¢ (1 free + 2 paid)", () => {
    expect(
      computeVoiceChargeForPlan({ plan: "free", minutesUsedThisMonth: 4, ...base }),
    ).toBe(30);
  });

  it("free plan past allowance → full 3 min × 15¢", () => {
    expect(
      computeVoiceChargeForPlan({ plan: "free", minutesUsedThisMonth: 7, ...base }),
    ).toBe(45);
  });

  it("growth plan → full rate, no free allowance", () => {
    expect(
      computeVoiceChargeForPlan({ plan: "array", minutesUsedThisMonth: 0, ...base }),
    ).toBe(45);
  });

  it("growth plan → clamped at holdCents", () => {
    expect(
      computeVoiceChargeForPlan({ plan: "array", minutesUsedThisMonth: 0, secondsUsed: 600, holdCents: 75 }),
    ).toBe(75);
  });

  it("0 seconds → 0 regardless of plan", () => {
    expect(
      computeVoiceChargeForPlan({ plan: "free", minutesUsedThisMonth: 0, secondsUsed: 0, holdCents: 75 }),
    ).toBe(0);
    expect(
      computeVoiceChargeForPlan({ plan: "array", minutesUsedThisMonth: 10, secondsUsed: 0, holdCents: 75 }),
    ).toBe(0);
  });
});

describe("settleVoiceSession — plan-aware + unlimited", () => {
  it("holdId=null (unlimited plan) skips all credit calls", async () => {
    const res = await settleVoiceSession({
      holdId: null,
      userId: "u_1",
      secondsUsed: 120,
      holdCents: 0,
      plan: "founder",
    });
    expect(res).toEqual({ charged: 0, refunded: 0 });
    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockRelease).not.toHaveBeenCalled();
    expect(mockTopUp).not.toHaveBeenCalled();
  });

  it("free-tier with full allowance → full release + no charge", async () => {
    const res = await settleVoiceSession({
      holdId: "hold_1",
      userId: "u_1",
      secondsUsed: 180, // 3 min, within 5-min allowance
      holdCents: 75,
      plan: "free",
      minutesUsedThisMonth: 0,
    });
    expect(res).toEqual({ charged: 0, refunded: 75 });
    expect(mockRelease).toHaveBeenCalledWith("hold_1");
  });

  it("free-tier past allowance → charge via partial capture + refund", async () => {
    const res = await settleVoiceSession({
      holdId: "hold_1",
      userId: "u_1",
      secondsUsed: 180, // 3 min
      holdCents: 75,
      plan: "free",
      minutesUsedThisMonth: 7, // already past allowance
    });
    expect(res).toEqual({ charged: 45, refunded: 30 });
    expect(mockCapture).toHaveBeenCalledWith("hold_1");
    expect(mockTopUp).toHaveBeenCalledWith(
      "u_1",
      30,
      "refund",
      expect.objectContaining({ chargeCents: 45 }),
    );
  });

  it("writes usage marker to ledger on every settle (non-unlimited)", async () => {
    await settleVoiceSession({
      holdId: "hold_1",
      userId: "u_1",
      secondsUsed: 60,
      holdCents: 75,
      plan: "array",
      minutesUsedThisMonth: 0,
    });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u_1",
        deltaCents: 0,
        reason: "agent_run",
        metadata: expect.objectContaining({
          type: "voice_usage",
          minutes: 1,
          chargeCents: 15,
          plan: "array",
        }),
      }),
    );
  });

  it("writes usage marker for unlimited plan too (with chargeCents=0)", async () => {
    await settleVoiceSession({
      holdId: null,
      userId: "u_1",
      secondsUsed: 120,
      holdCents: 0,
      plan: "founder",
    });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          type: "voice_usage",
          minutes: 2,
          chargeCents: 0,
          plan: "founder",
        }),
      }),
    );
  });
});

describe("computeVoiceCharge", () => {
  it("0 seconds → 0 cents", () => {
    expect(computeVoiceCharge(0, 75)).toBe(0);
  });

  it("negative seconds → 0 (defensive)", () => {
    expect(computeVoiceCharge(-5, 75)).toBe(0);
  });

  it("1 second → 1 minute → 15¢", () => {
    expect(computeVoiceCharge(1, 75)).toBe(15);
  });

  it("60 seconds → 1 minute → 15¢ (exact boundary)", () => {
    expect(computeVoiceCharge(60, 75)).toBe(15);
  });

  it("61 seconds → 2 minutes → 30¢", () => {
    expect(computeVoiceCharge(61, 75)).toBe(30);
  });

  it("5 minutes → 75¢", () => {
    expect(computeVoiceCharge(300, 75)).toBe(75);
  });

  it("caps at hold amount when usage exceeds ceiling", () => {
    expect(computeVoiceCharge(600, 75)).toBe(75); // 10 min would be 150¢, capped to 75
  });
});

describe("settleVoiceSession", () => {
  it("0 seconds → release full hold, no capture", async () => {
    const result = await settleVoiceSession({
      holdId: "hold_1",
      userId: "u_1",
      secondsUsed: 0,
      holdCents: 75,
    });

    expect(result).toEqual({ charged: 0, refunded: 75 });
    expect(mockRelease).toHaveBeenCalledWith("hold_1");
    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockTopUp).not.toHaveBeenCalled();
  });

  it("used full 5 minutes → capture full hold, no refund", async () => {
    const result = await settleVoiceSession({
      holdId: "hold_1",
      userId: "u_1",
      secondsUsed: 300,
      holdCents: 75,
    });

    expect(result).toEqual({ charged: 75, refunded: 0 });
    expect(mockCapture).toHaveBeenCalledWith("hold_1");
    expect(mockRelease).not.toHaveBeenCalled();
    expect(mockTopUp).not.toHaveBeenCalled();
  });

  it("used 1 minute → capture 75¢ then refund 60¢", async () => {
    const result = await settleVoiceSession({
      holdId: "hold_1",
      userId: "u_1",
      secondsUsed: 60,
      holdCents: 75,
    });

    expect(result).toEqual({ charged: 15, refunded: 60 });
    expect(mockCapture).toHaveBeenCalledWith("hold_1");
    expect(mockTopUp).toHaveBeenCalledWith(
      "u_1",
      60,
      "refund",
      expect.objectContaining({
        stage: "voice_partial_refund",
        holdId: "hold_1",
        chargeCents: 15,
      }),
    );
    expect(mockRelease).not.toHaveBeenCalled();
  });

  it("usage over ceiling → capture full hold (no negative refund)", async () => {
    const result = await settleVoiceSession({
      holdId: "hold_1",
      userId: "u_1",
      secondsUsed: 600, // would be 150¢ raw
      holdCents: 75,
    });

    expect(result.charged).toBe(75);
    expect(result.refunded).toBe(0);
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockTopUp).not.toHaveBeenCalled();
  });

  it("metadata includes secondsUsed for audit", async () => {
    await settleVoiceSession({
      holdId: "hold_1",
      userId: "u_1",
      secondsUsed: 45,
      holdCents: 75,
    });

    expect(mockTopUp).toHaveBeenCalledWith(
      "u_1",
      expect.any(Number),
      "refund",
      expect.objectContaining({ secondsUsed: 45 }),
    );
  });
});
