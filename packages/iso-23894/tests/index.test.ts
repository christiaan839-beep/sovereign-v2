import { describe, it, expect } from "vitest";
import {
  buildIso23894,
  toMarkdown,
  toJSON,
  type RiskMgmtScope,
  type RiskScenario,
} from "../src/index.js";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";

const SCOPE: RiskMgmtScope = {
  organizationName: "Acme AI Inc.",
  systemName: "Loan Underwriting AI",
  lifecyclePhase: "operation-monitoring",
  policyVersion: "RMP-2026-v3",
  periodStart: "2026-01-01T00:00:00Z",
  periodEnd: "2026-12-31T00:00:00Z",
};

const SCENARIOS: RiskScenario[] = [
  {
    id: "RS-1",
    description: "Prompt-injection causes bias-disclosure leak.",
    source: "prompt-injection",
    likelihood: "possible",
    impact: "major",
    characteristic: "secure-and-resilient",
    treatment: "reduce",
    treatmentDescription:
      "OWASP Agentic Top 10 pack + structured-output validation.",
    evidencePackPrefixes: ["owasp", "owasp-agentic"],
  },
  {
    id: "RS-2",
    description: "Model drift over time causes fairness regression.",
    source: "model-drift",
    likelihood: "likely",
    impact: "moderate",
    characteristic: "fair-with-bias-managed",
    treatment: "reduce",
    treatmentDescription: "Weekly fairness-eval rule pack.",
    evidencePackPrefixes: ["fairness-eval"],
  },
];

function rec(
  overrides: Partial<ReceiptRecord> & Record<string, unknown>,
): ReceiptRecord {
  return {
    verdictId: `v_${Math.random().toString(36).slice(2, 10)}`,
    overall: "pass",
    issuedAt: "2026-06-01T00:00:00Z",
    agentSlug: "underwriter",
    pack: "owasp-agentic",
    ...overrides,
  } as ReceiptRecord;
}

describe("buildIso23894 — structure", () => {
  it("ships stable schema id", () => {
    const r = buildIso23894({
      scope: SCOPE,
      scenarios: SCENARIOS,
      receipts: [],
    });
    expect(r.schema).toBe("vaos-iso-23894-v1");
    expect(r.standardVersion).toBe("23894:2023");
  });

  it("preserves every scenario", () => {
    const r = buildIso23894({
      scope: SCOPE,
      scenarios: SCENARIOS,
      receipts: [],
    });
    expect(r.scenarios.length).toBe(2);
    expect(r.scenarios[0]!.id).toBe("RS-1");
  });

  it("throws on duplicate scenario ids", () => {
    expect(() =>
      buildIso23894({
        scope: SCOPE,
        scenarios: [SCENARIOS[0]!, SCENARIOS[0]!],
        receipts: [],
      }),
    ).toThrow(/duplicate scenario id/);
  });
});

describe("buildIso23894 — risk scoring", () => {
  it("possible × major → high inherent", () => {
    const r = buildIso23894({
      scope: SCOPE,
      scenarios: [SCENARIOS[0]!],
      receipts: [],
    });
    expect(r.scenarios[0]!.inherentRisk).toBe("high");
  });

  it("likely × moderate → high inherent", () => {
    const r = buildIso23894({
      scope: SCOPE,
      scenarios: [SCENARIOS[1]!],
      receipts: [],
    });
    expect(r.scenarios[0]!.inherentRisk).toBe("high");
  });

  it("almost-certain × catastrophic → extreme inherent", () => {
    const r = buildIso23894({
      scope: SCOPE,
      scenarios: [
        {
          ...SCENARIOS[0]!,
          likelihood: "almost-certain",
          impact: "catastrophic",
        },
      ],
      receipts: [],
    });
    expect(r.scenarios[0]!.inherentRisk).toBe("extreme");
  });

  it("rare × negligible → very-low inherent", () => {
    const r = buildIso23894({
      scope: SCOPE,
      scenarios: [
        { ...SCENARIOS[0]!, likelihood: "rare", impact: "negligible" },
      ],
      receipts: [],
    });
    expect(r.scenarios[0]!.inherentRisk).toBe("very-low");
  });
});

describe("buildIso23894 — residual attenuation", () => {
  it("0 evidence → no attenuation", () => {
    const r = buildIso23894({
      scope: SCOPE,
      scenarios: [SCENARIOS[0]!],
      receipts: [],
    });
    expect(r.scenarios[0]!.residualRisk).toBe(r.scenarios[0]!.inherentRisk);
  });

  it("10+ evidence → 1 band lower", () => {
    const receipts = Array.from({ length: 15 }, () =>
      rec({ pack: "owasp-agentic-1" }),
    );
    const r = buildIso23894({
      scope: SCOPE,
      scenarios: [SCENARIOS[0]!],
      receipts,
    });
    expect(r.scenarios[0]!.evidenceCount).toBe(15);
    // high → medium
    expect(r.scenarios[0]!.residualRisk).toBe("medium");
  });

  it("100+ evidence → 2 bands lower", () => {
    const receipts = Array.from({ length: 150 }, () =>
      rec({ pack: "owasp-agentic-x" }),
    );
    const r = buildIso23894({
      scope: SCOPE,
      scenarios: [SCENARIOS[0]!],
      receipts,
    });
    expect(r.scenarios[0]!.evidenceCount).toBe(150);
    // high → low
    expect(r.scenarios[0]!.residualRisk).toBe("low");
  });

  it("residual cannot go below very-low", () => {
    const receipts = Array.from({ length: 200 }, () =>
      rec({ pack: "owasp-x" }),
    );
    const r = buildIso23894({
      scope: SCOPE,
      scenarios: [
        {
          ...SCENARIOS[0]!,
          likelihood: "rare",
          impact: "negligible",
        },
      ],
      receipts,
    });
    expect(r.scenarios[0]!.residualRisk).toBe("very-low");
  });
});

describe("buildIso23894 — aggregation", () => {
  it("byLevel counts residual buckets", () => {
    const r = buildIso23894({
      scope: SCOPE,
      scenarios: SCENARIOS,
      receipts: [],
    });
    const sum =
      r.byLevel["very-low"] +
      r.byLevel.low +
      r.byLevel.medium +
      r.byLevel.high +
      r.byLevel.extreme;
    expect(sum).toBe(2);
  });

  it("untreated counts scenarios with zero evidence", () => {
    const r = buildIso23894({
      scope: SCOPE,
      scenarios: SCENARIOS,
      receipts: [],
    });
    expect(r.summary.untreated).toBe(2);
  });

  it("byCharacteristic counts the right buckets", () => {
    const r = buildIso23894({
      scope: SCOPE,
      scenarios: SCENARIOS,
      receipts: [],
    });
    expect(r.byCharacteristic["secure-and-resilient"]).toBe(1);
    expect(r.byCharacteristic["fair-with-bias-managed"]).toBe(1);
  });
});

describe("toMarkdown / toJSON", () => {
  it("toMarkdown emits required sections", () => {
    const r = buildIso23894({
      scope: SCOPE,
      scenarios: SCENARIOS,
      receipts: [],
    });
    const md = toMarkdown(r);
    expect(md).toContain("ISO/IEC 23894:2023");
    expect(md).toContain("Risk scenarios");
    expect(md).toContain("RS-1");
    expect(md).toContain("Provenance");
  });

  it("toJSON round-trips", () => {
    const r = buildIso23894({
      scope: SCOPE,
      scenarios: SCENARIOS,
      receipts: [],
    });
    const parsed = JSON.parse(toJSON(r));
    expect(parsed.schema).toBe("vaos-iso-23894-v1");
    expect(parsed.scenarios.length).toBe(2);
  });
});
