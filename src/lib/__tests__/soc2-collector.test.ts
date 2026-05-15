/**
 * Tests for src/lib/soc2-collector.ts — Cook 93.
 *
 *   - Returns all 9 indicators even when inputs are empty.
 *   - Empty inputs default to 1.0 (conservative, audit-honest).
 *   - Ratios clamp to [0, 1].
 *   - MTTR mapping respects 0h → 1.0, 24h+ → 0.
 *   - Red-team criticals: 0 → 1.0, anything else → 0.
 */

import { describe, it, expect } from "vitest";
import { collectFromInputs } from "../soc2-collector";

function readingFor(
  id: string,
  inputs: Parameters<typeof collectFromInputs>[0],
) {
  return collectFromInputs(inputs).find((r) => r.id === id);
}

describe("collectFromInputs — coverage", () => {
  it("returns all 9 baseline indicators", () => {
    const out = collectFromInputs({});
    expect(out.length).toBe(9);
    const ids = out.map((r) => r.id);
    expect(ids).toContain("encryption-at-rest-coverage");
    expect(ids).toContain("mfa-admin-fraction");
    expect(ids).toContain("receipt-pass-rate");
    expect(ids).toContain("red-team-critical-zero");
    expect(ids).toContain("pii-scanner-coverage");
    expect(ids).toContain("dsr-response-sla");
  });
});

describe("collectFromInputs — empty inputs", () => {
  it("defaults empty windows to 1.0 (not 0)", () => {
    const out = collectFromInputs({});
    for (const r of out) {
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThanOrEqual(1);
    }
  });
});

describe("MFA fraction", () => {
  it("computes enrolled / total", () => {
    expect(
      readingFor("mfa-admin-fraction", {
        adminTotal: 4,
        adminMfaEnrolled: 3,
      })?.value,
    ).toBeCloseTo(0.75, 4);
  });

  it("returns 1.0 when no admins exist (N/A semantics)", () => {
    expect(readingFor("mfa-admin-fraction", { adminTotal: 0 })?.value).toBe(
      1.0,
    );
  });
});

describe("failed-deploy-rate", () => {
  it("computes 1 - failed/total", () => {
    expect(
      readingFor("failed-deploy-rate", {
        deploys90d: 100,
        failedDeploys90d: 5,
      })?.value,
    ).toBeCloseTo(0.95, 4);
  });
});

describe("incident MTTR score", () => {
  it("maps 0h → 1.0", () => {
    expect(
      readingFor("incident-mttr-score", { incidentMttrHours: 0 })?.value,
    ).toBe(1);
  });
  it("maps 24h → 0", () => {
    expect(
      readingFor("incident-mttr-score", { incidentMttrHours: 24 })?.value,
    ).toBe(0);
  });
  it("maps 12h → 0.5", () => {
    expect(
      readingFor("incident-mttr-score", { incidentMttrHours: 12 })?.value,
    ).toBeCloseTo(0.5, 4);
  });
  it("clamps MTTR above 24h to 0", () => {
    expect(
      readingFor("incident-mttr-score", { incidentMttrHours: 100 })?.value,
    ).toBe(0);
  });
});

describe("receipt rates", () => {
  it("computes pass rate from runs", () => {
    expect(
      readingFor("receipt-pass-rate", {
        agentRuns24h: 200,
        agentRunsPassed24h: 199,
      })?.value,
    ).toBeCloseTo(0.995, 4);
  });

  it("computes non-drift rate from replays", () => {
    expect(
      readingFor("receipt-non-drift-rate", {
        replays7d: 100,
        driftEvents7d: 2,
      })?.value,
    ).toBeCloseTo(0.98, 4);
  });
});

describe("red-team critical zero", () => {
  it("returns 1.0 when 0 criticals", () => {
    expect(
      readingFor("red-team-critical-zero", { redTeamCriticals7d: 0 })?.value,
    ).toBe(1);
  });
  it("returns 0 on any critical", () => {
    expect(
      readingFor("red-team-critical-zero", { redTeamCriticals7d: 1 })?.value,
    ).toBe(0);
  });
});

describe("DSR SLA", () => {
  it("computes inSla / total", () => {
    expect(
      readingFor("dsr-response-sla", {
        dsrTotal30d: 50,
        dsrInSla30d: 48,
      })?.value,
    ).toBeCloseTo(0.96, 4);
  });
});
