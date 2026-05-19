/**
 * @sovereign-matrix/gdpr-dpia tests.
 */
import { describe, it, expect } from "vitest";
import {
  buildDpia,
  toMarkdown,
  toJSON,
  type ControllerIdentity,
  type ProcessingActivity,
} from "../src/index.js";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";

const CONTROLLER: ControllerIdentity = {
  name: "Acme Health AI Ltd",
  address: "Königsallee 1, Düsseldorf, Germany",
  email: "privacy@acmehealth.example",
  dpoName: "Dr. Anna Müller",
  dpoEmail: "dpo@acmehealth.example",
};

const ACTIVITY_DIAG: ProcessingActivity = {
  id: "diag-triage",
  name: "AI-Assisted Diagnostic Triage",
  purpose:
    "Real-time triage recommendations to emergency-department clinicians based on patient symptoms.",
  dataSubjectCategories: ["patients", "emergency-department staff"],
  dataCategories: [
    "demographics",
    "vital-signs",
    "presenting symptoms",
    "medical history snippet",
  ],
  specialCategories: ["health data (Art. 9(1)(h))"],
  recipients: ["internal clinicians"],
  retention: "90 days after discharge",
  securityMeasures: [
    "AES-256-GCM encryption at rest",
    "TLS 1.3 in transit",
    "RBAC + audit log",
  ],
  legalBasis: "vital-interests",
};

const ACTIVITY_CHATBOT: ProcessingActivity = {
  id: "patient-chatbot",
  name: "Patient FAQ Chatbot",
  purpose: "Answer patient questions about appointments and medications.",
  dataSubjectCategories: ["patients"],
  dataCategories: ["name", "appointment context", "question text"],
  specialCategories: [],
  recipients: ["internal support team"],
  transfers: [{ country: "United States", safeguard: "SCCs" }],
  retention: "30 days",
  securityMeasures: ["TLS 1.3", "no audio recording"],
  legalBasis: "consent",
};

function rec(
  overrides: Partial<ReceiptRecord> & Record<string, unknown>,
): ReceiptRecord {
  return {
    verdictId: `v_${Math.random().toString(36).slice(2, 10)}`,
    overall: "pass",
    issuedAt: "2026-03-15T12:00:00Z",
    agentSlug: "diag-agent",
    pack: "gdpr-art-9",
    ...overrides,
  } as ReceiptRecord;
}

describe("buildDpia — structure", () => {
  it("schema id is stable", () => {
    const report = buildDpia({
      controller: CONTROLLER,
      activities: [],
      risks: {},
      receipts: [],
    });
    expect(report.schema).toBe("vaos-gdpr-dpia-v1");
    expect(report.regulationVersion).toBe("GDPR-2016-679");
  });

  it("preserves every activity in the RoPA section", () => {
    const report = buildDpia({
      controller: CONTROLLER,
      activities: [ACTIVITY_DIAG, ACTIVITY_CHATBOT],
      risks: {
        "diag-triage": {
          necessityProportionality: "yes",
          risks: [
            { description: "data leak", likelihood: "low", severity: "high" },
          ],
          mitigations: [{ description: "encryption" }],
          residualRisk: "low",
          priorConsultationRequired: false,
        },
        "patient-chatbot": {
          necessityProportionality: "yes",
          risks: [],
          mitigations: [],
          residualRisk: "low",
          priorConsultationRequired: false,
        },
      },
      receipts: [],
    });
    expect(report.ropa.length).toBe(2);
    expect(report.ropa[0]!.id).toBe("diag-triage");
    expect(report.dpia.length).toBe(2);
  });
});

describe("buildDpia — missing risk assessment", () => {
  it("auto-flags activities without risk assessment as high-risk", () => {
    const report = buildDpia({
      controller: CONTROLLER,
      activities: [ACTIVITY_DIAG],
      risks: {}, // no risk provided
      receipts: [],
    });
    const d = report.dpia[0]!;
    expect(d.residualRisk).toBe("high");
    expect(d.priorConsultationRequired).toBe(true);
    expect(d.risks[0]!.description).toContain("not provided");
  });
});

describe("buildDpia — fail loud on unknown activity ids", () => {
  it("throws when risks references an activity id not in activities", () => {
    expect(() =>
      buildDpia({
        controller: CONTROLLER,
        activities: [ACTIVITY_DIAG],
        risks: {
          "diag-triage": {
            necessityProportionality: "yes",
            risks: [],
            mitigations: [],
            residualRisk: "low",
            priorConsultationRequired: false,
          },
          "ghost-activity": {
            necessityProportionality: "yes",
            risks: [],
            mitigations: [],
            residualRisk: "low",
            priorConsultationRequired: false,
          },
        },
        receipts: [],
      }),
    ).toThrow(/ghost-activity/);
  });
});

describe("buildDpia — evidence counting", () => {
  it("counts receipt evidence per mitigation pack-prefix", () => {
    const report = buildDpia({
      controller: CONTROLLER,
      activities: [ACTIVITY_DIAG],
      risks: {
        "diag-triage": {
          necessityProportionality: "yes",
          risks: [],
          mitigations: [
            {
              description: "AES-256-GCM encryption at rest",
              evidencePackPrefixes: ["gdpr-art-32", "encryption", "gdpr-art-9"],
            },
            {
              description: "RBAC + audit log",
              evidencePackPrefixes: ["soc2-cc6", "rbac"],
            },
          ],
          residualRisk: "low",
          priorConsultationRequired: false,
        },
      },
      receipts: [
        rec({ pack: "gdpr-art-9-health" }),
        rec({ pack: "encryption-aes" }),
        rec({ pack: "soc2-cc6-rbac" }),
        rec({ pack: "totally-unrelated" }),
      ],
    });
    // 3 of 4 receipts match the mitigations' prefixes.
    expect(report.dpia[0]!.evidenceCount).toBe(3);
  });
});

describe("buildDpia — summary stats", () => {
  it("counts special-category activities", () => {
    const report = buildDpia({
      controller: CONTROLLER,
      activities: [ACTIVITY_DIAG, ACTIVITY_CHATBOT],
      risks: {},
      receipts: [],
    });
    expect(report.summary.specialCategoriesActivities).toBe(1);
  });

  it("counts third-country transfers", () => {
    const report = buildDpia({
      controller: CONTROLLER,
      activities: [ACTIVITY_CHATBOT],
      risks: {},
      receipts: [],
    });
    expect(report.summary.thirdCountryTransfers).toBe(1);
  });

  it("counts prior-consultation activities", () => {
    const report = buildDpia({
      controller: CONTROLLER,
      activities: [ACTIVITY_DIAG, ACTIVITY_CHATBOT],
      risks: {
        "diag-triage": {
          necessityProportionality: "yes",
          risks: [],
          mitigations: [],
          residualRisk: "high",
          priorConsultationRequired: true,
        },
      },
      receipts: [],
    });
    // diag-triage → required (set explicitly), patient-chatbot → required
    // (auto-flagged because no risk provided).
    expect(report.summary.priorConsultationsRequired).toBe(2);
  });
});

describe("toMarkdown", () => {
  it("emits every required section", () => {
    const report = buildDpia({
      controller: CONTROLLER,
      activities: [ACTIVITY_DIAG, ACTIVITY_CHATBOT],
      risks: {
        "diag-triage": {
          necessityProportionality: "Triage saves lives.",
          risks: [
            { description: "data leak", likelihood: "low", severity: "high" },
          ],
          mitigations: [{ description: "AES-256-GCM" }],
          residualRisk: "low",
          priorConsultationRequired: false,
        },
        "patient-chatbot": {
          necessityProportionality: "Improves patient experience.",
          risks: [],
          mitigations: [],
          residualRisk: "low",
          priorConsultationRequired: false,
        },
      },
      receipts: [rec({})],
    });
    const md = toMarkdown(report);
    expect(md).toContain("GDPR DPIA + RoPA Report");
    expect(md).toContain("Controller identity");
    expect(md).toContain("Article 30");
    expect(md).toContain("Article 35");
    expect(md).toContain("diag-triage");
    expect(md).toContain("Provenance");
  });
});

describe("toJSON", () => {
  it("round-trips with stable schema id", () => {
    const report = buildDpia({
      controller: CONTROLLER,
      activities: [ACTIVITY_DIAG],
      risks: {},
      receipts: [rec({})],
    });
    const json = toJSON(report);
    const parsed = JSON.parse(json);
    expect(parsed.schema).toBe("vaos-gdpr-dpia-v1");
    expect(parsed.controller.name).toBe(CONTROLLER.name);
    expect(parsed.ropa.length).toBe(1);
  });
});
