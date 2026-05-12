/**
 * Tests for src/lib/soc2-monitor.ts — Cook 58 continuous SOC 2 posture.
 *
 *   - buildPosture:
 *       - all-passing readings → overallPassFraction = 1
 *       - missing readings → status not-applicable
 *       - reading below warnAt → fail; between → warn; >= passAt → pass
 *       - byTsc aggregates per category
 *       - extra rules merge
 *       - JSON-serializable
 */

import { describe, it, expect } from "vitest";
import {
  buildPosture,
  SOC2_RULES,
  type IndicatorReading,
  type ControlRule,
} from "../soc2-monitor";

function reading(id: string, value: number): IndicatorReading {
  return { id, value };
}

const PASS_ALL: IndicatorReading[] = [
  reading("encryption-at-rest-coverage", 1.0),
  reading("mfa-admin-fraction", 1.0),
  reading("failed-deploy-rate", 0.98),
  reading("incident-mttr-score", 0.95),
  reading("receipt-pass-rate", 0.995),
  reading("receipt-non-drift-rate", 0.999),
  reading("red-team-critical-zero", 1.0),
  reading("pii-scanner-coverage", 1.0),
  reading("dsr-response-sla", 0.96),
];

describe("buildPosture — happy path", () => {
  it("overallPassFraction = 1 when every reading passes", () => {
    const p = buildPosture(PASS_ALL);
    expect(p.overallPassFraction).toBe(1);
    for (const c of p.controls) expect(c.status).toBe("pass");
  });

  it("evaluates every baseline rule", () => {
    const p = buildPosture(PASS_ALL);
    expect(p.controls.length).toBe(SOC2_RULES.length);
  });
});

describe("buildPosture — status bucketing", () => {
  it("status=fail when reading is below warnAt", () => {
    const p = buildPosture([
      ...PASS_ALL,
      { id: "receipt-pass-rate", value: 0.5 },
    ]);
    const c = p.controls.find((c) => c.rule.id === "PI1.1-pass-rate")!;
    expect(c.status).toBe("fail");
  });

  it("status=warn when reading is between warnAt and passAt", () => {
    const p = buildPosture([
      ...PASS_ALL,
      { id: "receipt-pass-rate", value: 0.96 },
    ]);
    const c = p.controls.find((c) => c.rule.id === "PI1.1-pass-rate")!;
    expect(c.status).toBe("warn");
  });

  it("status=not-applicable when reading is missing", () => {
    const p = buildPosture([reading("encryption-at-rest-coverage", 1.0)]);
    const c = p.controls.find((c) => c.rule.id === "PI1.1-pass-rate")!;
    expect(c.status).toBe("not-applicable");
  });
});

describe("buildPosture — aggregation", () => {
  it("byTsc counts statuses per Trust Services Criterion", () => {
    const p = buildPosture(PASS_ALL);
    const totalPass = Object.values(p.byTsc).reduce((n, b) => n + b.pass, 0);
    expect(totalPass).toBe(SOC2_RULES.length);
  });

  it("excludes not-applicable controls from overallPassFraction", () => {
    const p = buildPosture([
      // Only one reading; rest will be not-applicable.
      reading("encryption-at-rest-coverage", 1.0),
    ]);
    expect(p.overallPassFraction).toBe(1);
  });
});

describe("buildPosture — extra rules + serialization", () => {
  it("merges caller-supplied extra rules", () => {
    const extra: ControlRule = {
      id: "CUSTOM-1",
      title: "Custom control",
      tsc: "security",
      indicator: "custom-x",
      threshold: { passAt: 0.5, warnAt: 0.1 },
    };
    const p = buildPosture([reading("custom-x", 0.6)], { extraRules: [extra] });
    const c = p.controls.find((c) => c.rule.id === "CUSTOM-1");
    expect(c).toBeDefined();
    expect(c!.status).toBe("pass");
  });

  it("emits a JSON-serializable posture", () => {
    const p = buildPosture(PASS_ALL);
    expect(() => JSON.parse(JSON.stringify(p))).not.toThrow();
  });

  it("generatedAt is ISO-8601", () => {
    const p = buildPosture(PASS_ALL, { now: new Date("2026-05-12T11:30Z") });
    expect(p.generatedAt).toBe("2026-05-12T11:30:00.000Z");
  });
});
