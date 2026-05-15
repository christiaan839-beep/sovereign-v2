/**
 * Tests for src/lib/compliance-regression.ts — Cook 115.
 */

import { describe, it, expect } from "vitest";
import {
  renderReport,
  runCompliance,
  type ComplianceTest,
} from "../compliance-regression";

function test(
  id: string,
  pass: boolean,
  severity: ComplianceTest["severity"] = "high",
): ComplianceTest {
  return {
    controlId: id,
    name: `${id} test`,
    severity,
    run: async () => ({
      pass,
      evidence: pass ? `${id} ok` : `${id} failed`,
    }),
  };
}

describe("runCompliance — empty", () => {
  it("returns zero-totals report", async () => {
    const r = await runCompliance([]);
    expect(r.total).toBe(0);
    expect(r.blocking).toBe(false);
  });
});

describe("runCompliance — all pass", () => {
  it("returns passed=total + blocking=true", async () => {
    const r = await runCompliance([
      test("a", true),
      test("b", true, "critical"),
    ]);
    expect(r.passed).toBe(2);
    expect(r.failed).toBe(0);
    expect(r.blocking).toBe(true);
  });
});

describe("runCompliance — failures", () => {
  it("flags non-blocking when only low/medium fail", async () => {
    const r = await runCompliance([
      test("a", true),
      test("b", false, "low"),
      test("c", false, "medium"),
    ]);
    expect(r.passed).toBe(1);
    expect(r.failed).toBe(2);
    expect(r.blocking).toBe(true);
    expect(r.failuresBySeverity.low).toBe(1);
    expect(r.failuresBySeverity.medium).toBe(1);
  });

  it("flags blocking=false when any critical or high fail", async () => {
    const r = await runCompliance([
      test("a", true),
      test("b", false, "critical"),
    ]);
    expect(r.blocking).toBe(false);
    expect(r.failuresBySeverity.critical).toBe(1);
  });
});

describe("runCompliance — throwing tests", () => {
  it("a thrown test counts as a failure with the message in evidence", async () => {
    const r = await runCompliance([
      {
        controlId: "boom",
        name: "throws",
        severity: "high",
        run: async () => {
          throw new Error("test bug");
        },
      },
    ]);
    expect(r.failed).toBe(1);
    expect(r.results[0].evidence).toContain("test bug");
  });
});

describe("runCompliance — durationMs", () => {
  it("records non-negative duration per test", async () => {
    const r = await runCompliance([test("a", true)]);
    expect(r.results[0].durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("renderReport", () => {
  it("emits a CI-friendly summary", async () => {
    const r = await runCompliance([test("a", true), test("b", false, "high")]);
    const text = renderReport(r);
    expect(text).toContain("compliance:");
    expect(text).toContain("✓ [high] a");
    expect(text).toContain("✗ [high] b");
    expect(text).toContain("failures:");
  });
});
