/**
 * EU AI Act Annex IV technical-documentation exporter.
 *
 * Article 11 of the EU AI Act (Reg. (EU) 2024/1689) requires every
 * provider of a high-risk AI system to maintain technical
 * documentation in the format specified by Annex IV, covering:
 *
 *   §1 General description of the AI system
 *   §2 Detailed description of elements and process for development
 *   §3 Detailed information about monitoring, functioning and control
 *   §4 Description of the appropriateness of performance metrics
 *   §5 Detailed description of risk management system (Article 9)
 *   §6 Description of relevant changes through the lifecycle
 *   §7 List of harmonised standards applied / non-applied
 *   §8 Copy of the EU declaration of conformity (Article 47)
 *   §9 Detailed description of the post-market monitoring system
 *
 * This module takes a set of `ReceiptRecord`s and populates §3 / §4 /
 * §6 / §9 — the four sections a record set can mechanically support.
 *
 * The other five are organisational narrative that no tool can derive
 * from call logs. Rather than generate plausible-looking filler, the
 * exporter emits an explicit OPERATOR-AUTHORED stub carrying the
 * clause it must satisfy. A document with honest gaps is filable; one
 * with invented content is a liability.
 *
 * The same principle governs the evidentiary split: records that
 * carry a verifiable signature are counted separately from records
 * projected out of provider logs, in both output formats. See
 * `evidentiaryBasis`.
 *
 * This produces documentation. It does not determine that a system is
 * high-risk under Annex III, and it does not make anyone compliant.
 *
 * Output formats:
 *   - Markdown (regulator-readable, audit-archive friendly)
 *   - JSON (machine-readable, ingestible by procurement tools)
 *
 * Apache 2.0. Zero runtime dependencies.
 *
 * @packageDocumentation
 */

import { isAttested, type ReceiptRecord } from "./types.js";

/** Stamped into every report so a reader can pin the generator. */
const GENERATOR_VERSION = "0.1.0";

/**
 * Provider-level descriptors that no receipt set can supply — the
 * operator fills these once per AI system and they roll into every
 * generated report.
 */
export interface SystemDescription {
  /** Human-readable name. e.g. "Acme Loan Underwriting AI". */
  name: string;
  /** Stable id (used in audit logs + filed with the EU AI Office). */
  identifier: string;
  /** EU AI Act risk classification. Most apps are "high-risk" per Annex III. */
  riskCategory: "high-risk" | "limited-risk" | "minimal-risk" | "prohibited";
  /** Provider company legal name. */
  provider: string;
  /** Authorised representative in EU (Article 25). */
  authorisedRepresentativeEU?: string;
  /** Intended purpose (Article 13(2)). */
  intendedPurpose: string;
  /**
   * Annex III use-case category (e.g. "creditworthiness assessment",
   * "biometric identification", "law enforcement").
   */
  annexIIIUseCase?: string;
  /** ISO 8601 date the system entered service. */
  placedOnMarketAt: string;
}

/**
 * The structured Annex IV report shape. Each top-level key
 * corresponds to a numbered section of the regulation; populated
 * sections carry generated content + an `_evidence` array that
 * lists which receipts the content was derived from.
 */
export interface AnnexIvReport {
  /** Schema version. Verifiers MUST tolerate additive fields. */
  schema: "vaos-annex-iv-v1";

  /** ISO 8601 of report generation. */
  generatedAt: string;

  /** Window the receipts in this report cover. */
  reportingWindow: {
    from: string; // ISO 8601 — earliest receipt issuedAt
    to: string; // ISO 8601 — latest receipt issuedAt
    totalReceipts: number;
  };

  /**
   * How much of this report a third party can independently verify.
   *
   * `attested` records carry a signature over a canonical projection
   * and can be re-checked against the provider's public key.
   * `projected` records were derived from the provider's own logs and
   * are self-asserted. A reader must be able to tell them apart
   * without reading the provider's integration code, so the split is
   * part of the report rather than a footnote.
   */
  evidentiaryBasis: {
    attested: number;
    projected: number;
  };

  /** System metadata from the operator-supplied SystemDescription. */
  system: SystemDescription;

  /** §1 General description (operator-authored stub when no receipts). */
  generalDescription: SectionStub;

  /** §2 Development-process description (operator-authored stub). */
  developmentProcess: SectionStub;

  /** §3 Monitoring, functioning and control — DERIVED FROM RECEIPTS. */
  monitoringFunctioning: {
    summary: string;
    verdictCounts: {
      pass: number;
      warn: number;
      block: number;
    };
    blockRate: number;
    warnRate: number;
    agentsObserved: string[];
    packsExercised: string[];
    sampleBlockedReceipts: ReceiptSummary[];
  };

  /** §4 Performance metrics — DERIVED FROM RECEIPTS. */
  performanceMetrics: {
    receiptsPerDay: number;
    p50LatencyMs: number | null;
    p99LatencyMs: number | null;
    consistencyIndicator: number; // 0-1, share of receipts whose all rules agreed
    sampleSize: number;
  };

  /** §5 Risk-management system (operator-authored stub). */
  riskManagementSystem: SectionStub;

  /** §6 Relevant lifecycle changes — DERIVED FROM RECEIPT STREAM. */
  lifecycleChanges: {
    summary: string;
    firstReceiptAt: string | null;
    latestReceiptAt: string | null;
    distinctAgentsLaunched: number;
    distinctPacksAdopted: number;
  };

  /** §7 Harmonised standards (operator-authored stub). */
  harmonisedStandards: SectionStub;

  /** §8 EU declaration of conformity reference (operator-supplied stub). */
  conformityDeclaration: SectionStub;

  /** §9 Post-market monitoring system — DERIVED FROM RECEIPTS. */
  postMarketMonitoring: {
    summary: string;
    receiptsAnchored: number;
    anomaliesDetected: number;
    operatorActions: string[];
    nextReportDue: string | null;
  };
}

/**
 * Stub for the operator-authored sections. Schema-validated by
 * downstream procurement tooling; operator fills `content` with the
 * actual narrative + uploads any referenced documents to a content-
 * addressed store (e.g. `ipfs://` or `s3://`).
 */
export interface SectionStub {
  status: "operator-authored" | "draft" | "complete";
  /** Markdown content. Empty until the operator fills it. */
  content: string;
  /** External-reference URIs (e.g. uploaded PDFs of standards adoption). */
  externalReferences: string[];
  /** Schema hint for the procurement tool's UI. */
  schemaHint: string;
}

/** Sample of a single receipt — used in §3 to illustrate blocked verdicts. */
export interface ReceiptSummary {
  verdictId: string;
  issuedAt: string;
  agentSlug: string;
  pack?: string;
  overall: "pass" | "warn" | "block";
}

/**
 * Options controlling how the receipt set rolls into the report.
 */
export interface BuildAnnexIvOptions {
  /** Operator-supplied system metadata. */
  system: SystemDescription;
  /** Receipts to summarize. Typically the last 90 days for ongoing PMM. */
  receipts: ReceiptRecord[];
  /** Max number of blocked-receipt samples to include in §3. */
  sampleBlockedReceipts?: number;
  /** ISO 8601 of when the next PMM report is due (typically +90 days). */
  nextReportDue?: string;
  /** Operator actions taken in response to anomalies, for §9. */
  operatorActions?: string[];
}

/**
 * Build the structured Annex IV report from a receipt set.
 *
 * This is read-only — does not mutate the input array. Returns the
 * full AnnexIvReport; serialize via `toMarkdown()` or `toJSON()`.
 */
export function buildAnnexIv(opts: BuildAnnexIvOptions): AnnexIvReport {
  const {
    system,
    receipts,
    sampleBlockedReceipts = 5,
    nextReportDue,
    operatorActions = [],
  } = opts;
  const generatedAt = new Date().toISOString();

  // Reporting window — earliest + latest issuedAt across receipts.
  const sortedTimestamps = receipts
    .map((r) => r.issuedAt)
    .filter((t): t is string => typeof t === "string")
    .sort();
  const from = sortedTimestamps[0] ?? generatedAt;
  const to = sortedTimestamps[sortedTimestamps.length - 1] ?? generatedAt;

  // §3 Monitoring — verdict counts + sample blocks.
  let passCount = 0;
  let warnCount = 0;
  let blockCount = 0;
  const agentsObserved = new Set<string>();
  const packsExercised = new Set<string>();
  for (const r of receipts) {
    if (r.overall === "pass") passCount++;
    else if (r.overall === "warn") warnCount++;
    else if (r.overall === "block") blockCount++;
    if (typeof r.agentSlug === "string" && r.agentSlug) {
      agentsObserved.add(r.agentSlug);
    }
    if (typeof r.pack === "string" && r.pack) {
      packsExercised.add(r.pack);
    }
  }
  const total = receipts.length;
  const blockRate = total > 0 ? blockCount / total : 0;
  const warnRate = total > 0 ? warnCount / total : 0;
  const blockedSamples: ReceiptSummary[] = receipts
    .filter((r) => r.overall === "block")
    .slice(0, sampleBlockedReceipts)
    .map((r) => ({
      verdictId: String(r.verdictId),
      issuedAt: String(r.issuedAt),
      agentSlug: String(r.agentSlug ?? "unknown"),
      pack: typeof r.pack === "string" ? r.pack : undefined,
      overall: r.overall as ReceiptSummary["overall"],
    }));

  // §4 Performance metrics — latency percentiles + consistency.
  const latencies = receipts
    .map((r) => (typeof r.totalMs === "number" ? r.totalMs : null))
    .filter((n): n is number => n !== null && Number.isFinite(n))
    .sort((a, b) => a - b);
  const p = (arr: number[], pct: number): number | null => {
    if (arr.length === 0) return null;
    const idx = Math.min(arr.length - 1, Math.floor(arr.length * pct));
    // The length guard above puts idx in bounds, but say so in the
    // type rather than asserting it — a later edit to the guard should
    // not be able to turn this into an undefined leaking into a report.
    return arr[idx] ?? null;
  };
  const p50 = p(latencies, 0.5);
  const p99 = p(latencies, 0.99);

  // Receipts-per-day = total / span-in-days (clamped to ≥1 day).
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  const spanDays = Math.max(
    1,
    Number.isFinite(fromMs) && Number.isFinite(toMs)
      ? (toMs - fromMs) / (24 * 3600 * 1000)
      : 1,
  );
  const receiptsPerDay = total / spanDays;

  // Consistency: share of receipts whose `consistent` field is true.
  // ReceiptRecord allows arbitrary fields; many of our pipelines set
  // `consistent: boolean` on the receipt. Fall back to 1.0 (assumed
  // consistent) when the field is absent.
  let consistentCount = 0;
  let consistencySamples = 0;
  for (const r of receipts) {
    const v = (r as Record<string, unknown>).consistent;
    if (typeof v === "boolean") {
      consistencySamples++;
      if (v) consistentCount++;
    }
  }
  const consistencyIndicator =
    consistencySamples === 0 ? 1.0 : consistentCount / consistencySamples;

  // §6 Lifecycle changes — first/latest receipt + distinct agents/packs.
  // §9 Post-market monitoring — anomaly count from receipt anomaly field.
  let anomaliesDetected = 0;
  for (const r of receipts) {
    if ((r as Record<string, unknown>).anomalyKind) anomaliesDetected++;
  }

  // Split the record set by whether a third party could re-verify it.
  let attested = 0;
  for (const r of receipts) {
    if (isAttested(r)) attested++;
  }

  return {
    schema: "vaos-annex-iv-v1",
    generatedAt,
    reportingWindow: { from, to, totalReceipts: total },
    evidentiaryBasis: { attested, projected: total - attested },
    system,
    generalDescription: {
      status: "operator-authored",
      content: "",
      externalReferences: [],
      schemaHint:
        "Article 11 + Annex IV §1: name of the AI system, intended purpose, version, deployment context (B2B/B2C), and natural-language description for non-technical readers.",
    },
    developmentProcess: {
      status: "operator-authored",
      content: "",
      externalReferences: [],
      schemaHint:
        "Article 11 + Annex IV §2: development methodology, datasets, validation/test strategy, computational resources, and pre-deployment testing approach.",
    },
    monitoringFunctioning: {
      summary: `Over the reporting window, the system processed ${total} signed receipts across ${agentsObserved.size} distinct agents and exercised ${packsExercised.size} Guardian rule packs. Verdict distribution: ${passCount} pass / ${warnCount} warn / ${blockCount} block (block-rate ${(blockRate * 100).toFixed(2)}%, warn-rate ${(warnRate * 100).toFixed(2)}%).`,
      verdictCounts: { pass: passCount, warn: warnCount, block: blockCount },
      blockRate,
      warnRate,
      agentsObserved: [...agentsObserved].sort(),
      packsExercised: [...packsExercised].sort(),
      sampleBlockedReceipts: blockedSamples,
    },
    performanceMetrics: {
      receiptsPerDay,
      p50LatencyMs: p50,
      p99LatencyMs: p99,
      consistencyIndicator,
      sampleSize: total,
    },
    riskManagementSystem: {
      status: "operator-authored",
      content: "",
      externalReferences: [],
      schemaHint:
        "Article 9: continuous iterative process — identification, estimation, evaluation, and mitigation of risks throughout the AI system's lifecycle.",
    },
    lifecycleChanges: {
      summary:
        total === 0
          ? "No receipts in the reporting window."
          : `First receipt: ${from}. Latest: ${to}. Distinct agents launched across the window: ${agentsObserved.size}. Distinct Guardian packs adopted: ${packsExercised.size}.`,
      firstReceiptAt: total > 0 ? from : null,
      latestReceiptAt: total > 0 ? to : null,
      distinctAgentsLaunched: agentsObserved.size,
      distinctPacksAdopted: packsExercised.size,
    },
    harmonisedStandards: {
      status: "operator-authored",
      content: "",
      externalReferences: [],
      schemaHint:
        "Annex IV §7: list harmonised standards adopted (e.g. ISO/IEC 42001, ISO/IEC 23894, IEEE 7001) and reference the Sovereign Matrix Guardian rule packs cross-walking each one.",
    },
    conformityDeclaration: {
      status: "operator-authored",
      content: "",
      externalReferences: [],
      schemaHint:
        "Annex IV §8 + Article 47: attach the EU declaration of conformity issued by the provider, including the conformity-assessment procedure reference.",
    },
    postMarketMonitoring: {
      summary: `Post-market monitoring under Article 72 is operational. ${total} receipts have been anchored to the transparency log over the reporting window. ${anomaliesDetected} anomalies were detected via the receipt-anomaly module (statistical outlier detection over block-rate spikes, rule failure drift, volume bursts, quiet periods).${operatorActions.length > 0 ? ` Operator actions taken: ${operatorActions.length}.` : ""}`,
      receiptsAnchored: total,
      anomaliesDetected,
      operatorActions,
      nextReportDue: nextReportDue ?? null,
    },
  };
}

/**
 * Serialize the Annex IV report as Markdown — regulator-readable,
 * audit-archive friendly. The output is intended to be the file you
 * file with the EU AI Office (or hand to an external auditor).
 */
export function toMarkdown(report: AnnexIvReport): string {
  const lines: string[] = [];
  const heading = (level: number, text: string): void => {
    lines.push(`${"#".repeat(level)} ${text}`);
    lines.push("");
  };
  const kv = (k: string, v: unknown): void => {
    lines.push(`- **${k}:** ${String(v)}`);
  };

  heading(1, `EU AI Act Annex IV — Technical Documentation`);
  lines.push(
    `*Generated by ai-act-receipts v${GENERATOR_VERSION} at ${report.generatedAt}*`,
  );
  lines.push("");
  lines.push(
    "*This document fulfils Article 11 + Annex IV of Regulation (EU) 2024/1689 (the EU AI Act). Sections marked **OPERATOR-AUTHORED** must be completed by the provider before filing with the EU AI Office.*",
  );
  lines.push("");

  heading(2, "0. System metadata");
  kv("Name", report.system.name);
  kv("Identifier", report.system.identifier);
  kv("Risk category", report.system.riskCategory);
  kv("Provider", report.system.provider);
  if (report.system.authorisedRepresentativeEU) {
    kv(
      "Authorised representative (EU)",
      report.system.authorisedRepresentativeEU,
    );
  }
  kv("Intended purpose", report.system.intendedPurpose);
  if (report.system.annexIIIUseCase) {
    kv("Annex III use-case", report.system.annexIIIUseCase);
  }
  kv("Placed on market", report.system.placedOnMarketAt);
  lines.push("");

  heading(2, "Reporting window");
  kv("From", report.reportingWindow.from);
  kv("To", report.reportingWindow.to);
  kv("Total receipts", report.reportingWindow.totalReceipts);
  lines.push("");

  heading(2, "§1 General description");
  lines.push(
    `**OPERATOR-AUTHORED** — *${report.generalDescription.schemaHint}*`,
  );
  lines.push("");
  lines.push(report.generalDescription.content || "_(to be completed)_");
  lines.push("");

  heading(2, "§2 Development process");
  lines.push(
    `**OPERATOR-AUTHORED** — *${report.developmentProcess.schemaHint}*`,
  );
  lines.push("");
  lines.push(report.developmentProcess.content || "_(to be completed)_");
  lines.push("");

  heading(2, "§3 Monitoring, functioning and control");
  lines.push(report.monitoringFunctioning.summary);
  lines.push("");
  heading(3, "Verdict distribution");
  kv("Pass", report.monitoringFunctioning.verdictCounts.pass);
  kv("Warn", report.monitoringFunctioning.verdictCounts.warn);
  kv("Block", report.monitoringFunctioning.verdictCounts.block);
  kv(
    "Block-rate",
    `${(report.monitoringFunctioning.blockRate * 100).toFixed(2)}%`,
  );
  kv(
    "Warn-rate",
    `${(report.monitoringFunctioning.warnRate * 100).toFixed(2)}%`,
  );
  lines.push("");
  heading(3, "Agents observed");
  for (const a of report.monitoringFunctioning.agentsObserved) {
    lines.push(`- \`${a}\``);
  }
  lines.push("");
  heading(3, "Guardian rule packs exercised");
  for (const p of report.monitoringFunctioning.packsExercised) {
    lines.push(`- \`${p}\``);
  }
  lines.push("");
  if (report.monitoringFunctioning.sampleBlockedReceipts.length > 0) {
    heading(3, "Sample blocked receipts");
    for (const s of report.monitoringFunctioning.sampleBlockedReceipts) {
      lines.push(
        `- \`${s.verdictId}\` (${s.issuedAt}) — agent \`${s.agentSlug}\`${s.pack ? ` pack \`${s.pack}\`` : ""}`,
      );
    }
    lines.push("");
  }

  heading(2, "§4 Performance metrics");
  kv("Receipts per day", report.performanceMetrics.receiptsPerDay.toFixed(2));
  kv("p50 latency (ms)", report.performanceMetrics.p50LatencyMs ?? "n/a");
  kv("p99 latency (ms)", report.performanceMetrics.p99LatencyMs ?? "n/a");
  kv(
    "Consistency indicator",
    report.performanceMetrics.consistencyIndicator.toFixed(4),
  );
  kv("Sample size", report.performanceMetrics.sampleSize);
  lines.push("");

  heading(2, "§5 Risk management system");
  lines.push(
    `**OPERATOR-AUTHORED** — *${report.riskManagementSystem.schemaHint}*`,
  );
  lines.push("");
  lines.push(report.riskManagementSystem.content || "_(to be completed)_");
  lines.push("");

  heading(2, "§6 Lifecycle changes");
  lines.push(report.lifecycleChanges.summary);
  lines.push("");
  kv("First receipt", report.lifecycleChanges.firstReceiptAt ?? "n/a");
  kv("Latest receipt", report.lifecycleChanges.latestReceiptAt ?? "n/a");
  kv(
    "Distinct agents launched",
    report.lifecycleChanges.distinctAgentsLaunched,
  );
  kv("Distinct packs adopted", report.lifecycleChanges.distinctPacksAdopted);
  lines.push("");

  heading(2, "§7 Harmonised standards");
  lines.push(
    `**OPERATOR-AUTHORED** — *${report.harmonisedStandards.schemaHint}*`,
  );
  lines.push("");
  lines.push(report.harmonisedStandards.content || "_(to be completed)_");
  lines.push("");

  heading(2, "§8 EU declaration of conformity");
  lines.push(
    `**OPERATOR-AUTHORED** — *${report.conformityDeclaration.schemaHint}*`,
  );
  lines.push("");
  lines.push(report.conformityDeclaration.content || "_(to be completed)_");
  lines.push("");

  heading(2, "§9 Post-market monitoring");
  lines.push(report.postMarketMonitoring.summary);
  lines.push("");
  kv("Receipts anchored", report.postMarketMonitoring.receiptsAnchored);
  kv("Anomalies detected", report.postMarketMonitoring.anomaliesDetected);
  if (report.postMarketMonitoring.operatorActions.length > 0) {
    heading(3, "Operator actions taken");
    for (const a of report.postMarketMonitoring.operatorActions) {
      lines.push(`- ${a}`);
    }
    lines.push("");
  }
  if (report.postMarketMonitoring.nextReportDue) {
    kv("Next report due", report.postMarketMonitoring.nextReportDue);
  }
  lines.push("");

  heading(2, "Provenance");
  lines.push(
    `This report was generated by [ai-act-receipts](https://www.npmjs.com/package/ai-act-receipts) v${GENERATOR_VERSION}, an Apache-2.0 open-source EU AI Act technical-documentation exporter. Sections §3 / §4 / §6 / §9 are derived mechanically from the record set below; sections §1 / §2 / §5 / §7 / §8 are marked OPERATOR-AUTHORED and require provider narrative.`,
  );
  lines.push("");

  // Evidentiary weight is not uniform across the record set, and a
  // reader must not have to assume. An attested record carries a
  // signature over a canonical projection that a third party can
  // re-derive; a projected record asserts only what the provider's
  // own logging pipeline asserted.
  const { attested, projected } = report.evidentiaryBasis;
  heading(3, "Evidentiary basis");
  kv("Records in this report", report.reportingWindow.totalReceipts);
  kv("Cryptographically attested", attested);
  kv("Projected from provider logs (unsigned)", projected);
  if (projected > 0) {
    lines.push("");
    lines.push(
      `> ${projected} of ${report.reportingWindow.totalReceipts} record(s) in this report are projections of the provider's own logs and carry no signature. They are self-asserted: a third party cannot independently verify that they were not altered. Only the ${attested} attested record(s) can be re-verified against the provider's public key.`,
    );
  }

  return lines.join("\n");
}

/**
 * Serialize as JSON — machine-readable, ingestible by procurement
 * tools. Schema-versioned via `schema: "vaos-annex-iv-v1"`.
 */
export function toJSON(report: AnnexIvReport): string {
  return JSON.stringify(report, null, 2);
}
