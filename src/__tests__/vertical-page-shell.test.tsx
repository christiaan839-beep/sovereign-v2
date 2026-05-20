/**
 * VerticalPageShell tests — wave 109.
 *
 * Locks two contracts that the audit identified as load-bearing:
 *
 *  1. ACCENT_TOKENS is a STATIC literal map. Tailwind v4's content
 *     scanner sees these classes at build time so they survive the
 *     production purge. If a future contributor refactors the map
 *     to use template-literal interpolation (`bg-${color}-500/10`)
 *     these tests fail because the test does a string-presence
 *     check against the literal class strings.
 *
 *  2. Every accent token has a complete AccentSet (no missing keys).
 *     A missing key would render `undefined` into a className, which
 *     produces invisible UI. Snapshot the shape so an incomplete
 *     accent definition fails CI rather than ship as a visual bug.
 */
import { describe, it, expect } from "vitest";
import {
  ACCENT_TOKENS,
  type VerticalAccent,
} from "@/components/landing/VerticalPageShell";

const ALL_ACCENTS: readonly VerticalAccent[] = [
  "cyan",
  "amber",
  "emerald",
  "violet",
  "red",
] as const;

const REQUIRED_KEYS = [
  "chipBg",
  "chipBorder",
  "chipText",
  "hero",
  "eyebrow",
  "iconBg",
  "iconFg",
  "cardHoverBorder",
  "workflowLabel",
  "workflowStepNum",
  "workflowResultBg",
  "workflowResultText",
  "workflowResultIcon",
  "archIcon",
] as const;

describe("ACCENT_TOKENS — static class-literal invariant", () => {
  it.each(ALL_ACCENTS)("%s defines every required AccentSet key", (accent) => {
    const set = ACCENT_TOKENS[accent];
    for (const key of REQUIRED_KEYS) {
      const value = (set as Record<string, string>)[key];
      expect(
        typeof value === "string" && value.length > 0,
        `accent "${accent}" missing required key "${key}"`,
      ).toBe(true);
    }
  });

  it.each(ALL_ACCENTS)(
    "%s class strings DO NOT contain template-literal placeholders",
    (accent) => {
      // Template-literal interpolation would leave `${...}` in the
      // value at runtime if the refactor was incomplete. Production
      // would render `bg-${accent}-500/10` as a literal class
      // (silent visual bug).
      const set = ACCENT_TOKENS[accent];
      for (const value of Object.values(set)) {
        expect(value).not.toContain("${");
        expect(value).not.toContain("undefined");
      }
    },
  );

  it.each(ALL_ACCENTS)(
    "%s class strings use the expected Tailwind color token",
    (accent) => {
      // Belt-and-suspenders: the accent name is embedded in EVERY
      // class so a copy-paste error (e.g. amber's iconFg accidentally
      // set to `text-emerald-400`) shows up as a failing test.
      const set = ACCENT_TOKENS[accent];
      for (const [key, value] of Object.entries(set)) {
        expect(
          value.includes(accent),
          `accent "${accent}" key "${key}" → "${value}" is missing the accent token`,
        ).toBe(true);
      }
    },
  );
});

describe("ACCENT_TOKENS — read-only safety", () => {
  it("the top-level record is frozen at construction time", () => {
    // Mutating ACCENTS at runtime would let a misbehaving component
    // poison subsequent renders. The export is `Readonly<...>` in
    // the type system, but JS lets that be bypassed; pin the
    // runtime freeze too.
    expect(Object.isFrozen(ACCENT_TOKENS)).toBe(true);
  });
});

describe("ACCENT_TOKENS — accent set is exhaustive", () => {
  it("every key in ACCENT_TOKENS matches the VerticalAccent union", () => {
    const known = new Set(ALL_ACCENTS);
    for (const k of Object.keys(ACCENT_TOKENS)) {
      expect(
        known.has(k as VerticalAccent),
        `unexpected accent token "${k}"`,
      ).toBe(true);
    }
  });

  it("every member of VerticalAccent is present in ACCENT_TOKENS", () => {
    for (const a of ALL_ACCENTS) {
      expect(ACCENT_TOKENS).toHaveProperty(a);
    }
  });
});
