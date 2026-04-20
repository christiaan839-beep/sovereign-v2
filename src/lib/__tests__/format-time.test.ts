/**
 * Tests for src/lib/format-time.ts — timeAgo + formatDuration.
 *
 * Locks down behavior after consolidating 7 near-duplicates across
 * the dashboard (simplifier audit 2026-04-20). Any future edit that
 * breaks one of these assertions will break dashboards with zero
 * visual warning — the test is the warning.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { timeAgo, formatDuration } from "@/lib/format-time";

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for times within the last minute", () => {
    expect(timeAgo(new Date("2026-04-20T11:59:30Z"))).toBe("just now");
    expect(timeAgo(Date.now())).toBe("just now");
  });

  it("returns minutes for < 1 hour", () => {
    expect(timeAgo(new Date("2026-04-20T11:55:00Z"))).toBe("5m ago");
    expect(timeAgo(new Date("2026-04-20T11:01:00Z"))).toBe("59m ago");
  });

  it("returns hours for < 1 day", () => {
    expect(timeAgo(new Date("2026-04-20T09:00:00Z"))).toBe("3h ago");
    expect(timeAgo(new Date("2026-04-19T13:00:00Z"))).toBe("23h ago");
  });

  it("returns days for ≥ 1 day", () => {
    expect(timeAgo(new Date("2026-04-19T12:00:00Z"))).toBe("1d ago");
    expect(timeAgo(new Date("2026-04-10T12:00:00Z"))).toBe("10d ago");
  });

  it("accepts both ISO strings and epoch millis", () => {
    const iso = "2026-04-20T11:55:00Z";
    const ms = new Date(iso).getTime();
    expect(timeAgo(iso)).toBe(timeAgo(ms));
  });
});

describe("formatDuration", () => {
  it("returns '—' by default when input is null/undefined/0", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(undefined)).toBe("—");
    expect(formatDuration(0)).toBe("—");
  });

  it("honors a custom fallback string", () => {
    expect(formatDuration(null, { fallback: "N/A" })).toBe("N/A");
    expect(formatDuration(undefined, { fallback: "n/a" })).toBe("n/a");
  });

  it("returns milliseconds for sub-second durations", () => {
    expect(formatDuration(450)).toBe("450ms");
    expect(formatDuration(999)).toBe("999ms");
  });

  it("returns seconds (1 decimal) for ≥ 1s", () => {
    expect(formatDuration(1000)).toBe("1.0s");
    expect(formatDuration(2350)).toBe("2.4s");
    expect(formatDuration(60_000)).toBe("60.0s");
  });
});
