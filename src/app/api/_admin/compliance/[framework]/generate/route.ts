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
 *   2. Use the sample receipt corpus. Reading the tenant's own receipts
 *      is not wired up yet — see the note at the receipt source below.
 *   3. Run the framework-specific exporter against the receipts +
 *      operator-supplied scope.
 *   4. Return { markdown, json, sampleData }.
 *
 * Every document built from the sample corpus is stamped as such, in the
 * Markdown and in the response envelope. A compliance binder that reads as
 * finished but is made of synthetic receipts is worse than no binder: it is
 * the sort of thing that ends up attached to a questionnaire. `sampleData`
 * is how a caller tells the difference, and `SAMPLE_BANNER` is how a reader
 * does.
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
  // Always the sample corpus: reading the tenant's own receipts table via
  // Drizzle is not wired up yet. Nothing here is a real verdict, so the
  // output is stamped before it leaves the route.
  const receipts = buildSampleReceipts();

  // ── Dispatch ────────────────────────────────────────────────────
  try {
    const result = generate(framework as Framework, scope, receipts);
    // The ai-constitution flow is the one case where the operator can
    // supply their own receipts; everything else is sampled by definition.
    const usedOwnReceipts =
      framework === "ai-constitution" &&
      Boolean(scope["receiptsFile"]?.trim()) &&
      parseUploadedReceipts(scope["receiptsFile"] ?? "") !== null;

    return NextResponse.json(
      usedOwnReceipts
        ? { ...result, sampleData: false }
        : {
            markdown: SAMPLE_BANNER + result.markdown,
            json: stampSampleJson(result.json),
            sampleData: true,
          },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
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
      // Three real flows:
      //   1. Operator uploaded a signed constitution AND a receipt set
      //      → audit the uploaded receipts against the uploaded
      //        constitution. This is the production flow.
      //   2. Operator uploaded only a constitution
      //      → audit the sample receipt corpus against their constitution.
      //   3. Operator uploaded nothing
      //      → build a sample constitution from the form fields + audit
      //        the sample receipt corpus. Demo mode.
      const constitution =
        scope["constitutionFile"] && scope["constitutionFile"].trim()
          ? (parseUploadedConstitution(scope["constitutionFile"]) ??
            buildSampleConstitution(scope))
          : buildSampleConstitution(scope);

      const auditReceipts =
        scope["receiptsFile"] && scope["receiptsFile"].trim()
          ? (parseUploadedReceipts(scope["receiptsFile"]) ?? receipts)
          : receipts;

      const audit = auditAgainstConstitution({
        constitution,
        receipts: auditReceipts,
      });
      return { markdown: constMd(audit), json: constJson(audit) };
    }
    default:
      throw new Error(
        `Unknown framework: ${framework}. Valid: annex-iv, iso-42001, nist-ai-rmf, soc2, gdpr-dpia, hipaa, iso-23894, eu-cra, ai-constitution.`,
      );
  }
}

/**
 * Parse an uploaded signed constitution. Accepts either a single
 * SignedConstitution JSON object or `{ constitution: SignedConstitution }`
 * wrapper. Returns null if parsing fails — caller falls back to sample.
 */
function parseUploadedConstitution(
  raw: string,
): ReturnType<typeof buildConstitution> | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const candidate =
      typeof parsed === "object" &&
      parsed !== null &&
      "constitution" in parsed &&
      typeof parsed.constitution === "object"
        ? (parsed.constitution as Record<string, unknown>)
        : parsed;
    // Basic shape validation — fail loud rather than silently accept garbage.
    if (
      typeof candidate.hash !== "string" ||
      !Array.isArray(candidate.articles) ||
      typeof candidate.name !== "string" ||
      typeof candidate.signedBy !== "string"
    ) {
      return null;
    }
    return candidate as unknown as ReturnType<typeof buildConstitution>;
  } catch {
    return null;
  }
}

/**
 * Parse uploaded receipts. Accepts:
 *   - JSONL (one JSON object per non-empty line)
 *   - A single JSON array
 *   - A wrapper { receipts: [...] }
 * Returns null on parse failure so the caller falls back to sample.
 */
function parseUploadedReceipts(raw: string): ReceiptRecord[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // JSON array OR { receipts: [...] }
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const arr: unknown[] | null = Array.isArray(parsed)
        ? parsed
        : typeof parsed === "object" &&
            parsed !== null &&
            Array.isArray((parsed as { receipts?: unknown }).receipts)
          ? (parsed as { receipts: unknown[] }).receipts
          : null;
      if (!arr) return null;
      return arr.filter(
        (r): r is ReceiptRecord => typeof r === "object" && r !== null,
      );
    } catch {
      return null;
    }
  }

  // JSONL — line per object, ignore blank lines + comments.
  const out: ReceiptRecord[] = [];
  for (const line of trimmed.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("//")) continue;
    try {
      const obj = JSON.parse(t);
      if (typeof obj === "object" && obj !== null) {
        out.push(obj as ReceiptRecord);
      }
    } catch {
      // Skip malformed lines — don't fail the whole batch on one bad entry.
    }
  }
  return out.length > 0 ? out : null;
}

/**
 * Build a sample constitution from operator form fields. Used as a
 * fallback when no constitution file is uploaded.
 */
function buildSampleConstitution(scope: Record<string, string>) {
  return buildConstitution({
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
          pack: "hipaa-2026",
          ruleId: "hipaa-no-raw-ssn",
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
}

/**
 * Banner prepended to any document built from the sample corpus.
 *
 * Blockquoted so it survives a paste into anything that renders Markdown,
 * and worded so a reader who skips it still cannot file the document by
 * accident.
 */
const SAMPLE_BANNER = [
  "> **SAMPLE DOCUMENT — NOT EVIDENCE.**",
  "> Built from a synthetic receipt corpus generated by this endpoint, not",
  "> from your agents' verdicts. Every verdict id, timestamp and count below",
  "> is fabricated. Do not submit this to an auditor, a regulator or a",
  "> customer questionnaire. It shows the report's structure and nothing else.",
  "",
  "",
].join("\n");

/** Mark the JSON envelope too, so a machine consumer sees it as well. */
function stampSampleJson(json: string): string {
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return JSON.stringify(
      {
        sampleData: true,
        sampleDataNotice:
          "Built from a synthetic receipt corpus, not from real verdicts. Not evidence.",
        ...parsed,
      },
      null,
      2,
    );
  } catch {
    // An exporter that did not emit an object still gets the banner in the
    // Markdown; returning the JSON unchanged beats dropping the document.
    return json;
  }
}

/**
 * Sample receipt corpus. Nothing here is a real verdict — see SAMPLE_BANNER.
 *
 * The pack ids are real ones from the Guardian registry (packs.ts). They used
 * to be invented — "nist-ai-rmf-govern", "iso42001-aims", "soc2-cc6-iam",
 * "fairness-eval" and the like — which named nothing the system can produce
 * and only counted because the exporters carried catch-all prefixes. With
 * both halves fabricated, every binder reported near-total coverage.
 */
function buildSampleReceipts(): ReceiptRecord[] {
  const base = new Date("2026-01-15T00:00:00Z").getTime();
  const out: ReceiptRecord[] = [];
  const agents = ["loan-underwriter", "credit-analyst", "fraud-detector"];
  const packs = [
    "us-nist-ai-rmf-600-1",
    "iso-42001-2023",
    "eu-ai-act-2026",
    "owasp-agentic-top10-2026",
    "hipaa-2026",
    "pci-dss-v4-2026",
    "uk-ico-ai-2026",
    "nyc-aedt-2026",
    "us-colorado-ai-2026",
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
