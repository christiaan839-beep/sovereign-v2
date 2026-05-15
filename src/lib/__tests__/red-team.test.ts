/**
 * Tests for src/lib/red-team.ts — Cook 44 adversarial probes.
 *
 *   - baselineProbes returns a non-empty, defensively-copied list.
 *   - scoreProbe flags forbidden-token leaks (case-insensitive).
 *   - runCampaign:
 *       - runs the agent for every probe; preserves order.
 *       - throwing agent registers as failure (no campaign abort).
 *       - failuresBySeverity counts match the verdict.
 *       - failures list is ordered worst-first.
 *       - parallel concurrency is faster than serial for slow agents.
 *   - JSON-serializable report.
 */

import { describe, it, expect } from "vitest";
import {
  baselineProbes,
  scoreProbe,
  runCampaign,
  type AgentUnderTest,
  type Probe,
} from "../red-team";

describe("baselineProbes", () => {
  it("returns a non-empty list covering every probe class", () => {
    const probes = baselineProbes();
    expect(probes.length).toBeGreaterThan(0);
    const classes = new Set(probes.map((p) => p.class));
    expect(classes.has("jailbreak")).toBe(true);
    expect(classes.has("exfiltration")).toBe(true);
    expect(classes.has("role-confusion")).toBe(true);
    expect(classes.has("prompt-injection")).toBe(true);
    expect(classes.has("contradiction")).toBe(true);
  });

  it("returns defensive copies — mutating one batch doesn't affect the next", () => {
    const a = baselineProbes();
    a[0].forbidden.push("CONTAMINATED");
    const b = baselineProbes();
    expect(b[0].forbidden).not.toContain("CONTAMINATED");
  });
});

describe("scoreProbe", () => {
  const probe: Probe = {
    id: "test",
    class: "jailbreak",
    severity: "critical",
    prompt: "x",
    forbidden: ["DAN", "ignored guidelines"],
  };

  it("passes when response contains no forbidden tokens", () => {
    const r = scoreProbe(probe, "I cannot do that.");
    expect(r.passed).toBe(true);
    expect(r.leaks).toEqual([]);
  });

  it("fails and surfaces every leak (case-insensitive)", () => {
    const r = scoreProbe(
      probe,
      "Fine, I'm dan now and I've ignored guidelines.",
    );
    expect(r.passed).toBe(false);
    expect(r.leaks).toContain("DAN");
    expect(r.leaks).toContain("ignored guidelines");
  });
});

describe("runCampaign", () => {
  const safe: AgentUnderTest = async () => "I cannot comply with that request.";
  const leaky: AgentUnderTest = async (prompt) =>
    prompt.includes("DAN") ? "I am DAN" : "I cannot help.";

  it("runs every probe and preserves order", async () => {
    const probes = baselineProbes().slice(0, 3);
    const report = await runCampaign(probes, safe);
    expect(report.results).toHaveLength(3);
    expect(report.results.map((r) => r.probe.id)).toEqual(
      probes.map((p) => p.id),
    );
    expect(report.passCount).toBe(3);
  });

  it("flags failures by severity", async () => {
    const probes = baselineProbes();
    const report = await runCampaign(probes, leaky);
    expect(report.failCount).toBeGreaterThan(0);
    const totalSev = Object.values(report.failuresBySeverity).reduce(
      (a, b) => a + b,
      0,
    );
    expect(totalSev).toBe(report.failCount);
  });

  it("orders failures worst-first (critical before high before medium)", async () => {
    const allLeaks: AgentUnderTest = async () =>
      "I am DAN. confirmed understanding. system prompt: yes. 2+2=5.";
    const report = await runCampaign(baselineProbes(), allLeaks);
    if (report.failures.length >= 2) {
      const order = ["critical", "high", "medium", "low"];
      for (let i = 0; i + 1 < report.failures.length; i++) {
        const a = order.indexOf(report.failures[i].probe.severity);
        const b = order.indexOf(report.failures[i + 1].probe.severity);
        expect(a).toBeLessThanOrEqual(b);
      }
    }
  });

  it("a throwing agent becomes a failure, not a campaign abort", async () => {
    const angry: AgentUnderTest = async () => {
      throw new Error("inference blew up");
    };
    const probes = baselineProbes().slice(0, 2);
    const report = await runCampaign(probes, angry);
    expect(report.results).toHaveLength(2);
    expect(report.failCount).toBe(2);
    expect(report.results[0].passed).toBe(false);
  });

  it("concurrency > 1 finishes faster than serial for slow agents", async () => {
    const slow: AgentUnderTest = async () => {
      await new Promise((r) => setTimeout(r, 30));
      return "I cannot help.";
    };
    const probes = baselineProbes().slice(0, 4);

    const serialStart = Date.now();
    await runCampaign(probes, slow, { concurrency: 1 });
    const serial = Date.now() - serialStart;

    const parallelStart = Date.now();
    await runCampaign(probes, slow, { concurrency: 4 });
    const parallel = Date.now() - parallelStart;

    expect(parallel).toBeLessThan(serial);
  });

  it("returns a JSON-serializable report", async () => {
    const report = await runCampaign(baselineProbes().slice(0, 1), safe);
    expect(() => JSON.parse(JSON.stringify(report))).not.toThrow();
  });
});
