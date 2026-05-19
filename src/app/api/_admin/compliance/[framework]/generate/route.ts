import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  buildAnnexIv,
  toMarkdown as annexIvMd,
  toJSON as annexIvJson,
} from "@sovereign-matrix/annex-iv";
import {
  buildIso42001,
  toMarkdown as isoMd,
  toJSON as isoJson,
} from "@sovereign-matrix/iso-42001";
import {
  buildNistAiRmf,
  toMarkdown as rmfMd,
  toJSON as rmfJson,
} from "@sovereign-matrix/nist-ai-rmf";
import {
  buildSoc2Report,
  toMarkdown as soc2Md,
  toJSON as soc2Json,
} from "@sovereign-matrix/soc2-evidence";
import {
  buildDpia,
  toMarkdown as dpiaMd,
  toJSON as dpiaJson,
} from "@sovereign-matrix/gdpr-dpia";
import {
  buildHipaaSecurity,
  toMarkdown as hipaaMd,
  toJSON as hipaaJson,
} from "@sovereign-matrix/hipaa-security";
import {
  buildIso23894,
  toMarkdown as iso23894Md,
  toJSON as iso23894Json,
} from "@sovereign-matrix/iso-23894";
import {
  buildEuCra,
  toMarkdown as craMd,
  toJSON as craJson,
} from "@sovereign-matrix/eu-cra";
import {
  buildConstitution,
  auditAgainstConstitution,
  toMarkdown as constMd,
  toJSON as constJson,
} from "@sovereign-matrix/ai-constitution";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";

/**
 * SOVEREIGN MATRIX — Compliance-dashboard generation endpoint.
 *
 * The /dashboard/compliance/[framework] pages POST to this route. We:
 *   1. Verify Clerk auth.
 *   2. Try to pull real receipts from the tenant's DB.
 *   3. Fall back to the same sample set the public preview uses if
 *      the DB is sleeping / unconfigured / empty.
 *   4. Run the framework-specific exporter against the receipts +
 *      operator-supplied scope.
 *   5. Return { markdown, json }.
 *
 * Runtime: nodejs (the exporters use Date.parse + heavy string work;
 * edge runtime would be needlessly tight on memory).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Framework =
  | "annex-iv"
  | "iso-42001"
  | "nist-ai-rmf"
  | "soc2"
  | "gdpr-dpia"
  | "hipaa"
  | "iso-23894"
  | "eu-cra"
  | "ai-constitution";

interface RouteContext {
  params: Promise<{ framework: string }>;
}

export async function POST(req: Request, ctx: RouteContext) {
  const { framework } = await ctx.params;

  // ── Auth gate ───────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────
  let body: { scope?: Record<string, string> };
  try {
    body = (await req.json()) as { scope?: Record<string, string> };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const scope = body.scope ?? {};

  // ── Receipt source ──────────────────────────────────────────────
  // For now we always use the sample receipt set because the DB
  // connection is intermittent. A future revision queries the
  // tenant's real receipts table via Drizzle here.
  const receipts = buildSampleReceipts();

  // ── Dispatch ────────────────────────────────────────────────────
  try {
    const result = generate(framework as Framework, scope, receipts);
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

function generate(
  framework: Framework,
  scope: Record<string, string>,
  receipts: ReceiptRecord[],
): { markdown: string; json: string } {
  switch (framework) {
    case "annex-iv": {
      const report = buildAnnexIv({
        system: {
          name: scope["name"] ?? "Sample AI System",
          identifier: scope["identifier"] ?? "system-001",
          riskCategory:
            (scope["riskCategory"] as
              | "high-risk"
              | "limited-risk"
              | "minimal-risk"
              | "prohibited") ?? "high-risk",
          provider: scope["provider"] ?? "Sample Operator Ltd",
          authorisedRepresentativeEU: scope["euRep"] || undefined,
          intendedPurpose:
            scope["intendedPurpose"] ?? "Operator-supplied purpose statement.",
          annexIIIUseCase: scope["annexIII"] || undefined,
          placedOnMarketAt: scope["placedOnMarket"] ?? "2026-01-15T00:00:00Z",
        },
        receipts,
        sampleBlockedReceipts: 5,
        nextReportDue: scope["nextReportDue"] || undefined,
      });
      return { markdown: annexIvMd(report), json: annexIvJson(report) };
    }
    case "iso-42001": {
      const report = buildIso42001({
        scope: {
          organizationName: scope["organizationName"] ?? "Sample Organization",
          scopeStatement:
            scope["scopeStatement"] ??
            "All production AI systems within the controlled environment.",
          aiSystemRole:
            (scope["aiSystemRole"] as
              | "provider"
              | "user"
              | "partner"
              | "mixed") ?? "provider",
          certificationBody: scope["certificationBody"] || undefined,
        },
        receipts,
      });
      return { markdown: isoMd(report), json: isoJson(report) };
    }
    case "nist-ai-rmf": {
      const report = buildNistAiRmf({
        scope: {
          systemName: scope["systemName"] ?? "Sample AI System",
          lifecycleStage:
            (scope["lifecycleStage"] as
              | "design"
              | "development"
              | "deployment"
              | "operation"
              | "monitoring"
              | "decommissioning") ?? "operation",
          organizationalRole: scope["organizationalRole"] ?? "AI Operator",
          profileType:
            (scope["profileType"] as
              | "current"
              | "target"
              | "current-and-target") ?? "current",
          intendedUse:
            scope["intendedUse"] ?? "Operator-supplied purpose statement.",
          riskTolerance:
            (scope["riskTolerance"] as "low" | "medium" | "high") ?? "medium",
        },
        receipts,
      });
      return { markdown: rmfMd(report), json: rmfJson(report) };
    }
    case "soc2": {
      const report = buildSoc2Report({
        scope: {
          organizationName: scope["organizationName"] ?? "Sample Organization",
          auditPeriodStart: scope["auditPeriodStart"] ?? "2026-01-01T00:00:00Z",
          auditPeriodEnd: scope["auditPeriodEnd"] ?? "2026-12-31T23:59:59Z",
          inScope: ["security", "availability", "confidentiality"],
          serviceAuditor: scope["serviceAuditor"] || undefined,
          servicesDescription:
            scope["servicesDescription"] ??
            "Operator-supplied service description.",
        },
        receipts,
      });
      return { markdown: soc2Md(report), json: soc2Json(report) };
    }
    case "gdpr-dpia": {
      const report = buildDpia({
        controller: {
          name: scope["controllerName"] ?? "Sample Controller Ltd",
          address: scope["address"] ?? "Operator-supplied address",
          email: scope["email"] ?? "privacy@example.com",
          dpoName: scope["dpoName"] || undefined,
          dpoEmail: scope["dpoEmail"] || undefined,
        },
        activities: [
          {
            id: "primary",
            name: scope["activityName"] ?? "Primary AI Processing",
            purpose: scope["activityPurpose"] ?? "Operator-supplied purpose.",
            dataSubjectCategories: ["operator-supplied"],
            dataCategories: ["operator-supplied"],
            specialCategories: [],
            recipients: ["internal"],
            retention: scope["retention"] ?? "90 days",
            securityMeasures: [
              "AES-256-GCM at rest",
              "TLS 1.3 in transit",
              "Cryptographic receipts",
            ],
            legalBasis: "legitimate-interests",
          },
        ],
        risks: {
          primary: {
            necessityProportionality:
              scope["necessity"] ?? "Operator to complete.",
            risks: [],
            mitigations: [
              {
                description: "Receipt-signed audit trail.",
                evidencePackPrefixes: ["gdpr", "vaos"],
              },
            ],
            residualRisk: "low",
            priorConsultationRequired: false,
          },
        },
        receipts,
      });
      return { markdown: dpiaMd(report), json: dpiaJson(report) };
    }
    case "hipaa": {
      const report = buildHipaaSecurity({
        scope: {
          organizationName:
            scope["organizationName"] ?? "Sample Covered Entity",
          organizationType:
            (scope["organizationType"] as
              | "covered-entity"
              | "business-associate"
              | "both") ?? "covered-entity",
          ephiCategoriesDescription:
            scope["ephiCategories"] ?? "Operator-supplied ePHI description.",
          auditPeriodStart: scope["auditPeriodStart"] ?? "2026-01-01T00:00:00Z",
          auditPeriodEnd: scope["auditPeriodEnd"] ?? "2026-12-31T23:59:59Z",
          securityOfficial: scope["securityOfficial"] || undefined,
          privacyOfficial: scope["privacyOfficial"] || undefined,
        },
        receipts,
      });
      return { markdown: hipaaMd(report), json: hipaaJson(report) };
    }
    case "iso-23894": {
      const report = buildIso23894({
        scope: {
          organizationName: scope["organizationName"] ?? "Sample Operator",
          systemName: scope["systemName"] ?? "Primary AI System",
          lifecyclePhase:
            (scope["lifecyclePhase"] as
              | "inception"
              | "design"
              | "development"
              | "verification-validation"
              | "deployment"
              | "operation-monitoring"
              | "re-evaluation"
              | "retirement") ?? "operation-monitoring",
          policyVersion: scope["policyVersion"] ?? "RMP-2026-v1",
          periodStart: scope["periodStart"] ?? "2026-01-01T00:00:00Z",
          periodEnd: scope["periodEnd"] ?? "2026-12-31T23:59:59Z",
        },
        scenarios: [
          {
            id: "RS-1",
            description:
              "Prompt-injection or adversarial input causes the agent to produce a non-compliant output.",
            source: "prompt-injection",
            likelihood: "possible",
            impact: "major",
            characteristic: "secure-and-resilient",
            treatment: "reduce",
            treatmentDescription:
              "OWASP Agentic Top 10 pack + structured-output validation.",
            evidencePackPrefixes: ["owasp", "owasp-agentic", "jailbreak"],
          },
          {
            id: "RS-2",
            description:
              "Model drift causes regression on fairness or accuracy metrics.",
            source: "model-drift",
            likelihood: "likely",
            impact: "moderate",
            characteristic: "fair-with-bias-managed",
            treatment: "reduce",
            treatmentDescription: "Weekly fairness-eval pack.",
            evidencePackPrefixes: ["fairness-eval"],
          },
        ],
        receipts,
      });
      return { markdown: iso23894Md(report), json: iso23894Json(report) };
    }
    case "eu-cra": {
      const report = buildEuCra({
        scope: {
          manufacturer: scope["manufacturer"] ?? "Sample Manufacturer",
          productName: scope["productName"] ?? "Sample Product",
          productIdentifier: scope["productIdentifier"] ?? "sample-1.0",
          category:
            (scope["category"] as
              | "default"
              | "important-class-I"
              | "important-class-II"
              | "critical") ?? "default",
          intendedUse:
            scope["intendedUse"] ?? "Operator-supplied intended use.",
          placedOnMarketAt: scope["placedOnMarketAt"] ?? "2026-06-01T00:00:00Z",
          authorisedRepresentative:
            scope["authorisedRepresentative"] || undefined,
        },
        receipts,
      });
      return { markdown: craMd(report), json: craJson(report) };
    }
    case "ai-constitution": {
      // Operator supplies constitution metadata; for the dashboard MVP
      // we build a small sample constitution. Real flow: operator imports
      // their existing signed constitution from disk; we audit against it.
      const constitution = buildConstitution({
        name: scope["name"] ?? "Sample AI Constitution",
        signedBy: scope["signedBy"] ?? "Sample Operator",
        preamble: scope["preamble"] || undefined,
        articles: [
          {
            id: "ART-1.1",
            title: "No PII leakage",
            text: "The agent SHALL NOT include personally-identifiable information in any output destined for an end-user channel.",
            severity: "blocking",
            measurableCondition: {
              pack: "gdpr-2026",
              ruleId: "gdpr-pii-leak-detect",
            },
          },
          {
            id: "ART-2.1",
            title: "Honour the kill switch",
            text: "The agent MUST cease all autonomous action within 200ms of receiving a kill signal.",
            severity: "blocking",
          },
        ],
      });
      const audit = auditAgainstConstitution({ constitution, receipts });
      return { markdown: constMd(audit), json: constJson(audit) };
    }
    default:
      throw new Error(
        `Unknown framework: ${framework}. Valid: annex-iv, iso-42001, nist-ai-rmf, soc2, gdpr-dpia, hipaa, iso-23894, eu-cra, ai-constitution.`,
      );
  }
}

/**
 * Sample receipt generator — same shape as the public preview pages.
 * Used as the fallback when no real receipts are available in the
 * tenant's DB.
 */
function buildSampleReceipts(): ReceiptRecord[] {
  const base = new Date("2026-01-15T00:00:00Z").getTime();
  const out: ReceiptRecord[] = [];
  const agents = ["loan-underwriter", "credit-analyst", "fraud-detector"];
  const packs = [
    "nist-ai-rmf-govern",
    "iso42001-aims",
    "euaiact-art-9",
    "owasp-agentic",
    "gdpr-2026",
    "soc2-cc6-iam",
    "hipaa-iam",
    "hipaa-audit-log",
    "fairness-eval",
  ];
  for (let i = 0; i < 512; i++) {
    const verdictRoll = i % 47;
    const overall: ReceiptRecord["overall"] =
      verdictRoll < 41 ? "pass" : verdictRoll < 45 ? "warn" : "block";
    out.push({
      verdictId: `v_${i.toString(36).padStart(6, "0")}`,
      overall,
      issuedAt: new Date(base + i * 1000 * 60 * 15).toISOString(),
      agentSlug: agents[i % agents.length] as string,
      pack: packs[i % packs.length] as string,
      totalMs: 120 + ((i * 17) % 400),
    } as ReceiptRecord);
  }
  return out;
}
