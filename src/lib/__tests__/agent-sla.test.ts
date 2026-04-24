/**
 * Tests for agent-sla — SLA parsing, confidence scoring, verdict.
 *
 * These functions are pure — all paths exhaustively unit-testable
 * with zero mocks.
 */

import { describe, expect, it } from "vitest";
import {
  evaluateSla,
  parseSlaFromManifest,
  scoreConfidence,
} from "../agent-sla";

/* ─── parseSlaFromManifest ────────────────────────────────────── */

describe("parseSlaFromManifest()", () => {
  it("returns null when manifest has no sla block", () => {
    expect(parseSlaFromManifest({})).toBeNull();
    expect(parseSlaFromManifest({ purpose: "x" })).toBeNull();
  });

  it("returns null for non-object manifest input", () => {
    expect(parseSlaFromManifest(null)).toBeNull();
    expect(parseSlaFromManifest(undefined)).toBeNull();
    expect(parseSlaFromManifest([])).toBeNull();
    expect(parseSlaFromManifest("string")).toBeNull();
  });

  it("returns null when confidenceMin is missing or out of range", () => {
    expect(parseSlaFromManifest({ sla: {} })).toBeNull();
    expect(parseSlaFromManifest({ sla: { confidenceMin: -0.1 } })).toBeNull();
    expect(parseSlaFromManifest({ sla: { confidenceMin: 1.5 } })).toBeNull();
    expect(parseSlaFromManifest({ sla: { confidenceMin: "high" } })).toBeNull();
  });

  it("parses a valid SLA block with all fields", () => {
    const r = parseSlaFromManifest({
      sla: {
        confidenceMin: 0.85,
        refundPctIfBreach: 50,
        description: "Custom description",
      },
    });
    expect(r).toEqual({
      confidenceMin: 0.85,
      refundPctIfBreach: 50,
      description: "Custom description",
    });
  });

  it("defaults refundPctIfBreach to 100 when unspecified", () => {
    const r = parseSlaFromManifest({ sla: { confidenceMin: 0.7 } });
    expect(r?.refundPctIfBreach).toBe(100);
  });

  it("synthesises a description when unspecified", () => {
    const r = parseSlaFromManifest({ sla: { confidenceMin: 0.9 } });
    expect(r?.description).toContain("90%");
    expect(r?.description).toContain("100%");
  });

  it("clamps an invalid refundPctIfBreach to the 100% default", () => {
    const r = parseSlaFromManifest({
      sla: { confidenceMin: 0.8, refundPctIfBreach: 150 },
    });
    expect(r?.refundPctIfBreach).toBe(100);
  });
});

/* ─── scoreConfidence ─────────────────────────────────────────── */

describe("scoreConfidence()", () => {
  it("returns 0 for empty or whitespace-only output", () => {
    expect(scoreConfidence({ output: "" })).toBe(0);
    expect(scoreConfidence({ output: "   \n\t  " })).toBe(0);
  });

  it("gives high scores to confident, substantive output", () => {
    const out = "Invoice #1234 from Acme Corp dated 2026-04-24. Total: $1,250.00 due 2026-05-08. Three line items extracted successfully.";
    expect(scoreConfidence({ output: out })).toBeGreaterThan(0.75);
  });

  it("penalises refusal phrases heavily", () => {
    expect(
      scoreConfidence({ output: "I cannot help with that request." }),
    ).toBeLessThan(0.4);
    expect(
      scoreConfidence({ output: "I'm sorry, but I can't process this image." }),
    ).toBeLessThan(0.4);
  });

  it("penalises uncertainty language incrementally", () => {
    const certain = "The vendor is Acme Corp. The total is $500.";
    const uncertain = "I think the vendor might be Acme Corp. I believe the total is possibly $500. It's not entirely sure.";
    expect(scoreConfidence({ output: certain })).toBeGreaterThan(
      scoreConfidence({ output: uncertain }),
    );
  });

  it("penalises output below the minimum-length floor", () => {
    const r = scoreConfidence({ output: "Yes.", minLengthChars: 50 });
    expect(r).toBeLessThan(0.3);
  });

  it("penalises non-JSON output when JSON is expected", () => {
    const nonJson = "Here is a nice human summary of the invoice fields, all prose, no JSON at all.";
    const withJsonExpected = scoreConfidence({
      output: nonJson,
      expectedJson: true,
    });
    const withoutJsonExpected = scoreConfidence({
      output: nonJson,
      expectedJson: false,
    });
    expect(withJsonExpected).toBeLessThan(withoutJsonExpected);
  });

  it("accepts valid JSON as high confidence even with expectedJson", () => {
    const json = '{"vendor":"Acme","total":1250,"date":"2026-04-24","items":3}';
    expect(
      scoreConfidence({ output: json, expectedJson: true, minLengthChars: 20 }),
    ).toBeGreaterThan(0.7);
  });

  it("penalises repetitive / looping output", () => {
    const repetitive =
      "This is a fixed slice here. ".repeat(20) + " normal text at end";
    expect(scoreConfidence({ output: repetitive })).toBeLessThan(0.75);
  });

  it("always returns a value in [0, 1]", () => {
    const samples = [
      "",
      "no",
      "I cannot I cannot I cannot.",
      "real normal output with some content in it",
      "short",
    ];
    for (const s of samples) {
      const v = scoreConfidence({ output: s });
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

/* ─── evaluateSla ─────────────────────────────────────────────── */

describe("evaluateSla()", () => {
  it("returns enforced:false for a manifest without SLA block", () => {
    const v = evaluateSla({
      manifestRaw: { purpose: "do stuff" },
      output: "anything",
    });
    expect(v.enforced).toBe(false);
    expect(v.breached).toBe(false);
    expect(v.refundPct).toBe(0);
  });

  it("reports no breach when confidence meets the threshold", () => {
    const v = evaluateSla({
      manifestRaw: { sla: { confidenceMin: 0.5 } },
      output: "Solid output with substantive text and no refusals here.",
    });
    expect(v.enforced).toBe(true);
    expect(v.breached).toBe(false);
    expect(v.refundPct).toBe(0);
  });

  it("reports a breach when confidence is below the threshold", () => {
    const v = evaluateSla({
      manifestRaw: {
        sla: { confidenceMin: 0.9, refundPctIfBreach: 100 },
      },
      output: "I cannot help with that.",
    });
    expect(v.enforced).toBe(true);
    expect(v.breached).toBe(true);
    expect(v.refundPct).toBe(100);
    expect(v.reason).toMatch(/Confidence/);
  });

  it("partial-refund case — custom refundPctIfBreach is honored", () => {
    const v = evaluateSla({
      manifestRaw: { sla: { confidenceMin: 0.9, refundPctIfBreach: 50 } },
      output: "I cannot help with that.",
    });
    expect(v.breached).toBe(true);
    expect(v.refundPct).toBe(50);
  });

  it("includes the buyer-facing description on enforced verdicts", () => {
    const v = evaluateSla({
      manifestRaw: {
        sla: { confidenceMin: 0.8, description: "Excellent extraction or free." },
      },
      output: "reasonable output",
    });
    expect(v.description).toBe("Excellent extraction or free.");
  });
});
