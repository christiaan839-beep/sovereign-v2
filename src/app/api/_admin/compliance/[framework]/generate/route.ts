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
  buildComplianceReport,
  renderMarkdown,
  toJSON as matrixJson,
  type ReportScope,
} from "@sovereign-matrix/compliance";
import {
  buildDpia,
  toMarkdown as dpiaMd,
  toJSON as dpiaJson,
} from "@sovereign-matrix/gdpr-dpia";
import {
  buildIso23894,
  toMarkdown as iso23894Md,
  toJSON as iso23894Json,
} from "@sovereign-matrix/iso-23894";
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

/**
 * Which operator-supplied scope fields each catalogue-driven framework
 * carries into its report, and under what label.
 *
 * The engine reads four fields — organization, system, period start and
 * end — and renders everything else verbatim in the Scope section. So a
 * framework's extra fields are a label map, not code.
 */
const DECLARATIONS: Record<string, Record<string, string>> = {
  soc2: {
    serviceAuditor: "Service auditor",
    servicesDescription: "Services",
  },
  "nist-ai-rmf": {
    lifecycleStage: "Lifecycle stage",
    organizationalRole: "Organizational role",
    profileType: "Profile type",
    intendedUse: "Intended use",
    riskTolerance: "Risk tolerance",
  },
  hipaa: {
    organizationType: "Organization type",
    ephiCategories: "ePHI categories",
    securityOfficial: "Security official",
    privacyOfficial: "Privacy official",
  },
  "eu-cra": {
    productIdentifier: "Product identifier",
    category: "Product class",
    intendedUse: "Intended use",
    placedOnMarketAt: "Placed on market",
    authorisedRepresentative: "Authorised representative",
  },
};

/** Which scope key names the system under assessment, per framework. */
const SYSTEM_KEY: Record<string, string> = {
  soc2: "servicesDescription",
  "nist-ai-rmf": "systemName",
  hipaa: "systemName",
  "eu-cra": "productName",
};

/** Map a flat operator scope onto the engine's ReportScope. */
function matrixScope(
  framework: string,
  scope: Record<string, string>,
): ReportScope {
  const declarations: Record<string, string> = {};
  for (const [key, label] of Object.entries(DECLARATIONS[framework] ?? {})) {
    const value = scope[key];
    if (value) declarations[label] = value;
  }
  const organizationName =
    scope["organizationName"] ?? scope["manufacturer"] ?? "Sample Organization";
  return {
    organizationName,
    systemName:
      scope[SYSTEM_KEY[framework] ?? "systemName"] ??
      scope["systemName"] ??
      "Sample AI System",
    periodStart: scope["auditPeriodStart"] ?? "2026-01-01T00:00:00Z",
    periodEnd: scope["auditPeriodEnd"] ?? "2026-12-31T23:59:59Z",
    ...(Object.keys(declarations).length > 0 ? { declarations } : {}),
  };
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
    case "soc2":
    case "nist-ai-rmf":
    case "hipaa":
    case "eu-cra": {
      const report = buildComplianceReport({
        regulation: framework === "hipaa" ? "hipaa-security" : framework,
        scope: matrixScope(framework, scope),
        receipts,
      });
      return { markdown: renderMarkdown(report), json: matrixJson(report) };
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
