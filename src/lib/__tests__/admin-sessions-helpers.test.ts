/**
 * Tests for src/lib/admin-sessions-helpers.ts — Wave 131.
 *
 * Pure-function tests covering the query-param coercion + JSON blob
 * parsing used by `/api/admin/sessions`. Pins the contract the route
 * + the page UI both depend on.
 */
import { describe, it, expect } from "vitest";
import {
  clampLimit,
  normalizeStatus,
  parseLastStepLabel,
  isMissingTableError,
  bucketFreshness,
} from "@/lib/admin-sessions-helpers";

describe("clampLimit", () => {
  it("returns the default when given null", () => {
    expect(clampLimit(null)).toBe(50);
  });

  it("returns the default when given empty string", () => {
    expect(clampLimit("")).toBe(50);
  });

  it("returns the default when given non-numeric input", () => {
    expect(clampLimit("abc")).toBe(50);
  });

  it("clamps below the minimum to the minimum", () => {
    expect(clampLimit("-100")).toBe(1);
    expect(clampLimit("0")).toBe(1);
  });

  it("clamps above the maximum to the maximum", () => {
    expect(clampLimit("99999")).toBe(200);
    expect(clampLimit("201")).toBe(200);
  });

  it("returns the value within range", () => {
    expect(clampLimit("75")).toBe(75);
    expect(clampLimit("1")).toBe(1);
    expect(clampLimit("200")).toBe(200);
  });

  it("respects custom defaults / ranges", () => {
    expect(clampLimit(null, { defaultValue: 10 })).toBe(10);
    expect(clampLimit("500", { max: 100 })).toBe(100);
    expect(clampLimit("0", { min: 5 })).toBe(5);
  });
});

describe("normalizeStatus", () => {
  it("returns null for missing input", () => {
    expect(normalizeStatus(null)).toBeNull();
    expect(normalizeStatus("")).toBeNull();
  });

  it("returns null for unknown status", () => {
    expect(normalizeStatus("pending")).toBeNull();
    expect(normalizeStatus("running")).toBeNull();
  });

  it("normalizes case + whitespace", () => {
    expect(normalizeStatus("ACTIVE")).toBe("active");
    expect(normalizeStatus("  done  ")).toBe("done");
    expect(normalizeStatus("Failed")).toBe("failed");
  });

  it("accepts the four valid values", () => {
    expect(normalizeStatus("active")).toBe("active");
    expect(normalizeStatus("done")).toBe("done");
    expect(normalizeStatus("failed")).toBe("failed");
    expect(normalizeStatus("abandoned")).toBe("abandoned");
  });
});

describe("parseLastStepLabel", () => {
  it("returns null for empty / missing blob", () => {
    expect(parseLastStepLabel("")).toBeNull();
    expect(parseLastStepLabel("null")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseLastStepLabel("[")).toBeNull();
    expect(parseLastStepLabel("not json")).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(parseLastStepLabel("[]")).toBeNull();
  });

  it("returns null for non-array JSON", () => {
    expect(parseLastStepLabel('{"label":"x"}')).toBeNull();
  });

  it("returns null when last entry has no label", () => {
    expect(parseLastStepLabel('[{"index":0}]')).toBeNull();
    expect(parseLastStepLabel('[{"label":42}]')).toBeNull();
  });

  it("returns the LAST step label", () => {
    expect(
      parseLastStepLabel(
        '[{"label":"step1"},{"label":"step2"},{"label":"step3"}]',
      ),
    ).toBe("step3");
  });

  it("truncates labels longer than 80 chars", () => {
    const longLabel = "x".repeat(120);
    const result = parseLastStepLabel(`[{"label":"${longLabel}"}]`);
    expect(result?.length).toBe(80);
    expect(result).toBe("x".repeat(80));
  });
});

describe("isMissingTableError", () => {
  it("matches PostgreSQL 42P01 code", () => {
    expect(isMissingTableError({ code: "42P01" })).toBe(true);
  });

  it("matches by message substring", () => {
    expect(
      isMissingTableError(new Error('relation "foo" does not exist')),
    ).toBe(true);
    expect(isMissingTableError("table does not exist")).toBe(true);
  });

  it("rejects unrelated errors", () => {
    expect(isMissingTableError(new Error("connection timeout"))).toBe(false);
    expect(isMissingTableError({ code: "23505" })).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
  });
});

describe("bucketFreshness", () => {
  it("returns fresh for sub-5-minute ages", () => {
    expect(bucketFreshness(0)).toBe("fresh");
    expect(bucketFreshness(2)).toBe("fresh");
    expect(bucketFreshness(4.99)).toBe("fresh");
  });

  it("returns cooling for 5-10 minute ages", () => {
    expect(bucketFreshness(5)).toBe("cooling");
    expect(bucketFreshness(7)).toBe("cooling");
    expect(bucketFreshness(10)).toBe("cooling");
  });

  it("returns stuck for >10 minute ages", () => {
    expect(bucketFreshness(10.01)).toBe("stuck");
    expect(bucketFreshness(60)).toBe("stuck");
    expect(bucketFreshness(10_000)).toBe("stuck");
  });
});
