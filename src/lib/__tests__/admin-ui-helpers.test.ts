/**
 * Tests for src/lib/admin-ui-helpers.ts — Wave 160.
 *
 * Pure-function tests pinning every formatter / accent mapper /
 * status mapper used across the admin pages. Without React Testing
 * Library available in this environment, these helpers ARE the
 * unit-testable surface — change one and the dashboard's class
 * names change.
 */
import { describe, it, expect } from "vitest";
import {
  shortHmsUtc,
  shortDateOrTime,
  ageMinutesSince,
  truncateOrDash,
  truncate,
  fmtNumOrDash,
  fmtPct01,
  accentText,
  accentGradient,
  tickStatusBadgeClass,
  nodeTypeColor,
} from "@/lib/admin-ui-helpers";

describe("shortHmsUtc", () => {
  it("formats a valid ISO to HH:MM:SS", () => {
    expect(shortHmsUtc("2026-05-22T14:30:07.000Z")).toBe("14:30:07");
  });
  it("zero-pads single digits", () => {
    expect(shortHmsUtc("2026-05-22T04:05:09.000Z")).toBe("04:05:09");
  });
  it("returns the raw string on bad input", () => {
    expect(shortHmsUtc("not a date")).toBe("not a date");
  });
});

describe("shortDateOrTime", () => {
  it("returns time-only for today's timestamp", () => {
    const now = new Date();
    const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}T12:34:56.000Z`;
    expect(shortDateOrTime(today)).toMatch(/^\d{2}:\d{2} UTC$/);
  });
  it("returns YYYY-MM-DD for non-today", () => {
    expect(shortDateOrTime("2020-01-15T08:00:00.000Z")).toBe("2020-01-15");
  });
  it("returns the raw string on bad input", () => {
    expect(shortDateOrTime("garbage")).toBe("garbage");
  });
});

describe("ageMinutesSince", () => {
  it("returns 0 for a now timestamp", () => {
    const now = Date.now();
    expect(ageMinutesSince(new Date(now).toISOString(), now)).toBe(0);
  });
  it("returns N for N minutes ago", () => {
    const now = Date.now();
    const tenMinAgo = new Date(now - 10 * 60_000).toISOString();
    expect(ageMinutesSince(tenMinAgo, now)).toBe(10);
  });
  it("clamps negative ages (future timestamps) to 0", () => {
    const now = Date.now();
    const future = new Date(now + 60_000).toISOString();
    expect(ageMinutesSince(future, now)).toBe(0);
  });
  it("returns 0 on malformed input", () => {
    expect(ageMinutesSince("not a date")).toBe(0);
  });
});

describe("truncateOrDash", () => {
  it("returns dash on null / undefined / empty", () => {
    expect(truncateOrDash(null, 10)).toBe("—");
    expect(truncateOrDash(undefined, 10)).toBe("—");
    expect(truncateOrDash("", 10)).toBe("—");
  });
  it("passes through short strings", () => {
    expect(truncateOrDash("abc", 10)).toBe("abc");
  });
  it("truncates with ellipsis above max", () => {
    expect(truncateOrDash("abcdefghij", 5)).toBe("abcde…");
  });
});

describe("truncate", () => {
  it("returns empty string on falsy", () => {
    expect(truncate(null, 10)).toBe("");
    expect(truncate("", 10)).toBe("");
  });
  it("passes through short strings", () => {
    expect(truncate("abc", 10)).toBe("abc");
  });
  it("truncates with ellipsis above max", () => {
    expect(truncate("abcdefghij", 5)).toBe("abcde…");
  });
});

describe("fmtNumOrDash", () => {
  it("returns dash on null / NaN / Infinity", () => {
    expect(fmtNumOrDash(null)).toBe("—");
    expect(fmtNumOrDash(undefined)).toBe("—");
    expect(fmtNumOrDash(NaN)).toBe("—");
    expect(fmtNumOrDash(Infinity)).toBe("—");
  });
  it("formats integers with thousands separators", () => {
    expect(fmtNumOrDash(12345)).toBe("12,345");
    expect(fmtNumOrDash(1_000_000)).toBe("1,000,000");
  });
  it("rounds fractions", () => {
    expect(fmtNumOrDash(1234.7)).toBe("1,235");
  });
});

describe("fmtPct01", () => {
  it("formats 0..1 → percentage", () => {
    expect(fmtPct01(0)).toBe("0.0%");
    expect(fmtPct01(0.5)).toBe("50.0%");
    expect(fmtPct01(1)).toBe("100.0%");
  });
  it("clamps below 0 to 0", () => {
    expect(fmtPct01(-0.5)).toBe("0.0%");
  });
  it("clamps above 1 to 100", () => {
    expect(fmtPct01(1.5)).toBe("100.0%");
  });
  it("respects digits param", () => {
    expect(fmtPct01(0.12345, 2)).toBe("12.35%");
    expect(fmtPct01(0.5, 0)).toBe("50%");
  });
  it("returns sentinel on NaN", () => {
    expect(fmtPct01(NaN)).toBe("—%");
  });
});

describe("accentText", () => {
  it("returns the foreground class for each accent", () => {
    expect(accentText("cyan")).toContain("text-cyan");
    expect(accentText("emerald")).toContain("text-emerald");
    expect(accentText("red")).toContain("text-red");
    expect(accentText("amber")).toContain("text-amber");
    expect(accentText("violet")).toContain("text-violet");
    expect(accentText("neutral")).toContain("text-neutral");
  });
});

describe("accentGradient", () => {
  it("returns a non-empty class for every accent", () => {
    for (const a of [
      "cyan",
      "emerald",
      "red",
      "amber",
      "violet",
      "neutral",
    ] as const) {
      expect(accentGradient(a)).toMatch(/from-/);
      expect(accentGradient(a)).toMatch(/to-transparent/);
    }
  });
});

describe("tickStatusBadgeClass", () => {
  it("emerald for auto-approved", () => {
    expect(tickStatusBadgeClass("auto-approved")).toContain("emerald");
  });
  it("red for blocked", () => {
    expect(tickStatusBadgeClass("blocked")).toContain("red");
  });
  it("amber for needs-approval", () => {
    expect(tickStatusBadgeClass("needs-approval")).toContain("amber");
  });
  it("neutral fallback for unknown", () => {
    expect(tickStatusBadgeClass("anything-else")).toContain("neutral");
  });
});

describe("nodeTypeColor", () => {
  it("agent → cyan", () => {
    expect(nodeTypeColor("agent")).toContain("cyan");
  });
  it("domain + url → violet (same family)", () => {
    expect(nodeTypeColor("domain")).toContain("violet");
    expect(nodeTypeColor("url")).toContain("violet");
  });
  it("amount → emerald", () => {
    expect(nodeTypeColor("amount")).toContain("emerald");
  });
  it("date → amber", () => {
    expect(nodeTypeColor("date")).toContain("amber");
  });
  it("entity → rose", () => {
    expect(nodeTypeColor("entity")).toContain("rose");
  });
  it("unknown defaults to neutral", () => {
    expect(nodeTypeColor("something-else")).toContain("neutral");
  });
});
