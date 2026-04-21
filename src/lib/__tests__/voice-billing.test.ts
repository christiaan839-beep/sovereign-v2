/**
 * voice-billing.ts — tests.
 *
 * Pure compute tests don't need mocks. Settlement tests mock
 * captureHold/releaseHold/topUp and assert the right one fires
 * with the right amounts for each tier of usage.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCapture, mockRelease, mockTopUp } = vi.hoisted(() => ({
  mockCapture: vi.fn(),
  mockRelease: vi.fn(),
  mockTopUp: vi.fn(),
}));

vi.mock("@/lib/credits", () => ({
  captureHold: mockCapture,
  releaseHold: mockRelease,
  topUp: mockTopUp,
}));

import { computeVoiceCharge, settleVoiceSession } from "@/lib/voice-billing";

beforeEach(() => {
  mockCapture.mockReset();
  mockRelease.mockReset();
  mockTopUp.mockReset();
  mockCapture.mockResolvedValue(undefined);
  mockRelease.mockResolvedValue(undefined);
  mockTopUp.mockResolvedValue(0);
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
