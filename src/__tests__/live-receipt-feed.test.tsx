/**
 * LiveReceiptFeed `ago()` helper tests — wave 109.6.
 *
 * The component is mostly stateful UI driven by polling — visual
 * verification (Playwright) covers the rendering. These tests pin
 * the only piece of pure logic in the component: the relative-age
 * formatter that powers the rightmost column of every receipt row.
 *
 * Why test `ago()` specifically:
 *   - It runs every second (the `now` ticker) for every receipt on
 *     the landing — a regression here paints visible wrong values
 *     to every visitor.
 *   - Boundary behaviour (60 → 1m, 3600 → 1h, 86400 → 1d) is the
 *     kind of off-by-one that gets re-introduced by "cleanup" PRs
 *     if not pinned.
 *   - Invalid input (malformed ISO) must return a sentinel, not
 *     `NaNs` or `Invalid Date` strings.
 */
import { describe, it, expect } from "vitest";
import { ago } from "@/components/landing/LiveReceiptFeed";

const NOW = Date.parse("2026-05-20T12:00:00.000Z");

describe("ago — wave-109.6 relative-age formatter", () => {
  it("returns seconds for ages under 60s", () => {
    expect(ago(new Date(NOW - 0).toISOString(), NOW)).toBe("0s");
    expect(ago(new Date(NOW - 500).toISOString(), NOW)).toBe("0s");
    expect(ago(new Date(NOW - 30_000).toISOString(), NOW)).toBe("30s");
    expect(ago(new Date(NOW - 59_000).toISOString(), NOW)).toBe("59s");
  });

  it("returns minutes starting at exactly 60s (boundary pin)", () => {
    expect(ago(new Date(NOW - 60_000).toISOString(), NOW)).toBe("1m");
    expect(ago(new Date(NOW - 90_000).toISOString(), NOW)).toBe("1m");
    expect(ago(new Date(NOW - 3_540_000).toISOString(), NOW)).toBe("59m");
  });

  it("returns hours starting at exactly 60m (boundary pin)", () => {
    expect(ago(new Date(NOW - 3_600_000).toISOString(), NOW)).toBe("1h");
    expect(ago(new Date(NOW - 86_340_000).toISOString(), NOW)).toBe("23h");
  });

  it("returns days starting at exactly 24h (boundary pin)", () => {
    expect(ago(new Date(NOW - 86_400_000).toISOString(), NOW)).toBe("1d");
    expect(ago(new Date(NOW - 7 * 86_400_000).toISOString(), NOW)).toBe("7d");
  });

  it("clamps negative deltas (clock skew) to 0s rather than emitting negatives", () => {
    // Server clock briefly ahead of client clock is the realistic case.
    // We never want '-3s' painted onto the landing.
    expect(ago(new Date(NOW + 5_000).toISOString(), NOW)).toBe("0s");
  });

  it("returns sentinel '—' on malformed ISO input (no crash, no Invalid Date)", () => {
    expect(ago("not-an-iso", NOW)).toBe("—");
    expect(ago("", NOW)).toBe("—");
  });

  it("handles real createdAt strings from the receipts API", () => {
    // The endpoint emits ISO strings via Date.toISOString(); pin the
    // round-trip works.
    const realIso = "2026-05-20T11:59:55.123Z";
    expect(ago(realIso, NOW)).toBe("4s");
  });
});
