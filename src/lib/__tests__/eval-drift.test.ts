import { describe, it, expect } from "vitest";
import { detectDrift } from "@/lib/eval-drift";

// Helper to build fixture runs
const run = (passRate: number, results: Array<[string, "passed" | "failed" | "skipped", string | null]>) => ({
  summary: {
    id: `run_${passRate}`,
    passRate,
    passed: results.filter((r) => r[1] === "passed").length,
    failed: results.filter((r) => r[1] === "failed").length,
    skipped: results.filter((r) => r[1] === "skipped").length,
    total: results.length,
  },
  results: results.map(([slug, status, hash]) => ({
    evalSlug: slug,
    agentSlug: slug, // simplification — real rows distinguish slug vs agent
    status,
    outputHash: hash,
  })),
});

describe("detectDrift", () => {
  it("returns clean report for the first run (no baseline)", () => {
    const report = detectDrift(null, run(0.95, [["a", "passed", "h1"]]));
    expect(report.drifted).toBe(false);
    expect(report.severity).toBe("none");
    expect(report.summary).toContain("first run");
  });

  it("detects pass-rate regression > 5pp as warning", () => {
    const prev = run(1.0, [["a", "passed", "h1"], ["b", "passed", "h2"]]);
    const cur = run(0.5, [["a", "passed", "h1"], ["b", "failed", null]]);
    const report = detectDrift(prev, cur);
    expect(report.drifted).toBe(true);
    expect(report.passRateDeltaPp).toBeCloseTo(50, 0);
    expect(report.severity).toBe("critical"); // >10pp
    expect(report.newlyFailed).toContain("b:b");
  });

  it("does not flag regressions under threshold", () => {
    // 95% → 92% = 3pp drop, under 5pp threshold
    const prev = run(0.95, Array.from({ length: 20 }, (_, i) => [`e${i}`, "passed" as const, `h${i}`]));
    const cur = run(0.92, Array.from({ length: 20 }, (_, i) => [`e${i}`, "passed" as const, `h${i}`]));
    // Same hashes, same statuses — only the summary number differs
    const report = detectDrift(prev, cur);
    expect(report.drifted).toBe(false);
    expect(report.severity).toBe("none");
  });

  it("flags newly-failed evals even if pass rate within threshold", () => {
    // 20 evals, 1 newly failed = 95% rate → still above threshold but
    // a fail-flip is NEVER acceptable
    const prev = run(1.0, Array.from({ length: 20 }, (_, i) => [`e${i}`, "passed" as const, `h${i}`]));
    const cur = run(0.95, [
      ...Array.from({ length: 19 }, (_, i) => [`e${i}`, "passed", `h${i}`] as [string, "passed", string]),
      ["e19", "failed", null] as [string, "failed", null],
    ]);
    const report = detectDrift(prev, cur);
    expect(report.drifted).toBe(true);
    expect(report.newlyFailed).toEqual(["e19:e19"]);
    expect(report.severity).toBe("warning"); // 5pp exactly, 1 failed
  });

  it("detects silent drift (output hash changed, status unchanged)", () => {
    const prev = run(1.0, [["a", "passed", "hash-old"]]);
    const cur = run(1.0, [["a", "passed", "hash-new"]]);
    const report = detectDrift(prev, cur);
    expect(report.silentDrift).toEqual(["a:a"]);
    // Silent drift alone doesn't set drifted=true — it's informational
    expect(report.drifted).toBe(false);
  });

  it("surfaces newly-passed as informational, not drift", () => {
    const prev = run(0.5, [["a", "failed", null], ["b", "passed", "h2"]]);
    const cur = run(1.0, [["a", "passed", "hA"], ["b", "passed", "h2"]]);
    const report = detectDrift(prev, cur);
    expect(report.newlyPassed).toContain("a:a");
    expect(report.drifted).toBe(false); // improvement, not drift
  });

  it("classifies 3+ newly-failed as critical regardless of pass rate", () => {
    const prev = run(1.0, [
      ["a", "passed", "h1"],
      ["b", "passed", "h2"],
      ["c", "passed", "h3"],
      ["d", "passed", "h4"],
      ["e", "passed", "h5"],
      ["f", "passed", "h6"],
    ]);
    const cur = run(0.5, [
      ["a", "failed", null],
      ["b", "failed", null],
      ["c", "failed", null],
      ["d", "passed", "h4"],
      ["e", "passed", "h5"],
      ["f", "passed", "h6"],
    ]);
    const report = detectDrift(prev, cur);
    expect(report.newlyFailed.length).toBe(3);
    expect(report.severity).toBe("critical");
  });
});
