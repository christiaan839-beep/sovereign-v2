/**
 * Tests for src/lib/webhook-replay-guard.ts — Cook 180.
 */

import { describe, it, expect } from "vitest";
import {
  PROVIDER_PROFILES,
  checkReplay,
  checkReplayForProvider,
  parseTimestamp,
} from "../webhook-replay-guard";

const NOW = 1_700_000_000_000;
const SECOND = 1000;
const MINUTE = 60 * SECOND;

describe("checkReplay", () => {
  it("accepts an event from 30 seconds ago under defaults", () => {
    expect(checkReplay({ timestampMs: NOW - 30 * SECOND, now: NOW })).toEqual({
      ok: true,
    });
  });

  it("rejects events older than the default 5-minute window", () => {
    const v = checkReplay({ timestampMs: NOW - 10 * MINUTE, now: NOW });
    expect(v.ok).toBe(false);
    if (!v.ok) {
      expect(v.reason).toBe("stale");
      expect(v.ageMs).toBe(10 * MINUTE);
    }
  });

  it("rejects events from the far future (clock-skew attack)", () => {
    const v = checkReplay({ timestampMs: NOW + 5 * MINUTE, now: NOW });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("future-skew");
  });

  it("accepts events with small positive skew (clock drift)", () => {
    expect(checkReplay({ timestampMs: NOW + 30 * SECOND, now: NOW })).toEqual({
      ok: true,
    });
  });

  it("rejects null timestamp", () => {
    const v = checkReplay({ timestampMs: null, now: NOW });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("missing-timestamp");
  });

  it("rejects undefined timestamp", () => {
    const v = checkReplay({ timestampMs: undefined, now: NOW });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("missing-timestamp");
  });

  it("rejects NaN / Infinity", () => {
    expect(checkReplay({ timestampMs: NaN, now: NOW }).ok).toBe(false);
    expect(checkReplay({ timestampMs: Infinity, now: NOW }).ok).toBe(false);
  });

  it("rejects zero/negative timestamp", () => {
    const v1 = checkReplay({ timestampMs: 0, now: NOW });
    expect(v1.ok).toBe(false);
    if (!v1.ok) expect(v1.reason).toBe("bad-timestamp");
    const v2 = checkReplay({ timestampMs: -1000, now: NOW });
    expect(v2.ok).toBe(false);
  });

  it("honors a caller-supplied maxAgeMs override", () => {
    expect(
      checkReplay({
        timestampMs: NOW - 30 * MINUTE,
        now: NOW,
        config: { maxAgeMs: 60 * MINUTE },
      }).ok,
    ).toBe(true);
  });
});

describe("checkReplayForProvider", () => {
  it("applies the Telegram 30-minute window", () => {
    expect(
      checkReplayForProvider({
        provider: "telegram",
        timestampMs: NOW - 25 * MINUTE,
        now: NOW,
      }).ok,
    ).toBe(true);
    expect(
      checkReplayForProvider({
        provider: "telegram",
        timestampMs: NOW - 35 * MINUTE,
        now: NOW,
      }).ok,
    ).toBe(false);
  });

  it("applies the strict Stripe 5-minute window", () => {
    expect(
      checkReplayForProvider({
        provider: "stripe",
        timestampMs: NOW - 4 * MINUTE,
        now: NOW,
      }).ok,
    ).toBe(true);
    expect(
      checkReplayForProvider({
        provider: "stripe",
        timestampMs: NOW - 6 * MINUTE,
        now: NOW,
      }).ok,
    ).toBe(false);
  });

  it("applies the PayPal 10-minute window", () => {
    expect(
      checkReplayForProvider({
        provider: "paypal",
        timestampMs: NOW - 9 * MINUTE,
        now: NOW,
      }).ok,
    ).toBe(true);
    expect(
      checkReplayForProvider({
        provider: "paypal",
        timestampMs: NOW - 11 * MINUTE,
        now: NOW,
      }).ok,
    ).toBe(false);
  });

  it("falls back to defaults for unknown providers", () => {
    expect(
      checkReplayForProvider({
        provider: "made-up-provider",
        timestampMs: NOW - 4 * MINUTE,
        now: NOW,
      }).ok,
    ).toBe(true);
    expect(
      checkReplayForProvider({
        provider: "made-up-provider",
        timestampMs: NOW - 10 * MINUTE,
        now: NOW,
      }).ok,
    ).toBe(false);
  });
});

describe("parseTimestamp", () => {
  it("returns ms for already-ms numeric input", () => {
    expect(parseTimestamp(1_700_000_000_000)).toBe(1_700_000_000_000);
  });
  it("converts seconds to ms", () => {
    expect(parseTimestamp(1_700_000_000)).toBe(1_700_000_000_000);
  });
  it("parses ISO 8601 strings", () => {
    const t = parseTimestamp("2026-05-15T12:00:00Z");
    expect(t).toBeGreaterThan(1_700_000_000_000);
  });
  it("returns null for null / undefined", () => {
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
  });
  it("returns null for garbage", () => {
    expect(parseTimestamp("not a date")).toBeNull();
    expect(parseTimestamp(NaN)).toBeNull();
    expect(parseTimestamp(0)).toBeNull();
  });
  it("parses numeric-string seconds", () => {
    expect(parseTimestamp("1700000000")).toBe(1_700_000_000_000);
  });
});

describe("PROVIDER_PROFILES", () => {
  it("includes every webhook provider Sovereign integrates with", () => {
    const required = [
      "stripe",
      "clerk",
      "paypal",
      "moonpay",
      "hubspot",
      "calcom",
      "twilio",
      "telegram",
      "yoco",
      "payfast",
      "paystack",
      "coinbase",
    ];
    for (const p of required) {
      expect(PROVIDER_PROFILES[p]).toBeDefined();
    }
  });
});
