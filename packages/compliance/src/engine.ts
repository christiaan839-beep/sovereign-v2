/**
 * One engine, every regulation.
 *
 * Each supported standard is a `RegulationPack` — a catalogue of
 * controls plus the vocabulary used to render them. This module turns
 * a pack and a set of receipts into an evidence matrix, and renders it
 * as markdown or JSON. Nothing here knows what SOC 2 or HIPAA is.
 *
 * The arithmetic is deliberately plain: count receipts whose Guardian
 * pack name matches a control's prefixes, and count the distinct days
 * they span. An auditor handed the same receipts can re-derive every
 * number in the report by hand. Nothing is weighted, scored or
 * inferred, because a number an auditor cannot reproduce is worse than
 * no number at all.
 *
 * @packageDocumentation
 */

import type {
  BuildControlMatrixOptions,
  ControlEvidence,
  ControlMatrixReport,
  EvidenceTally,
  ReceiptLike,
  RegulationPack,
} from "./types.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Per-distinct-pack aggregate, so control matching stays cheap. */
interface PackBucket {
  count: number;
  earliest: string | null;
  latest: string | null;
  days: Set<string>;
}

/**
 * Group receipts by their (lower-cased) pack name.
 *
 * Catalogues run to ~50 controls and receipt sets to millions, but the
 * number of distinct pack names is small. Bucketing first turns the
 * match from controls × receipts into controls × distinct-packs.
 */
function bucketByPack(receipts: readonly ReceiptLike[]): {
  buckets: Map<string, PackBucket>;
  packless: number;
} {
  const buckets = new Map<string, PackBucket>();
  let packless = 0;

  for (const r of receipts) {
    const pack = typeof r.pack === "string" ? r.pack.toLowerCase() : "";
    if (!pack) {
      packless++;
      continue;
    }
    let b = buckets.get(pack);
    if (!b) {
      b = { count: 0, earliest: null, latest: null, days: new Set() };
      buckets.set(pack, b);
    }
    b.count++;
    if (typeof r.issuedAt === "string" && r.issuedAt) {
      if (b.earliest === null || r.issuedAt < b.earliest) b.earliest = r.issuedAt;
      if (b.latest === null || r.issuedAt > b.latest) b.latest = r.issuedAt;
      b.days.add(r.issuedAt.slice(0, 10));
    }
  }
  return { buckets, packless };
}

/**
 * Count the receipts evidencing one control.
 *
 * A receipt evidences a control when its `pack` starts with any of the
 * control's prefixes, compared case-insensitively. Exported because
 * it is useful on its own — to check a single control before building
 * a whole report.
 */
export function tallyEvidence(
  receipts: readonly ReceiptLike[],
  evidencePackPrefixes: readonly string[],
): EvidenceTally {
  const { buckets } = bucketByPack(receipts);
  return tallyFromBuckets(buckets, evidencePackPrefixes).tally;
}

function tallyFromBuckets(
  buckets: Map<string, PackBucket>,
  prefixes: readonly string[],
): { tally: EvidenceTally; matchedPacks: string[] } {
  const lowered = prefixes.map((p) => p.toLowerCase());
  let count = 0;
  let earliest: string | null = null;
  let latest: string | null = null;
  const days = new Set<string>();
  const matchedPacks: string[] = [];

  for (const [pack, b] of buckets) {
    if (!lowered.some((p) => pack.startsWith(p))) continue;
    matchedPacks.push(pack);
    count += b.count;
    if (b.earliest !== null && (earliest === null || b.earliest < earliest)) {
      earliest = b.earliest;
    }
    if (b.latest !== null && (latest === null || b.latest > latest)) {
      latest = b.latest;
    }
    for (const d of b.days) days.add(d);
  }

  return {
    tally: { count, earliest, latest, daysOfCoverage: days.size },
    matchedPacks,
  };
}

/**
 * Which catalogue entries are in scope for this run.
 *
 * The pack's `alwaysInScope` categories are included unconditionally;
 * `scope.inScope` adds to them. Omitting `scope.inScope` entirely
 * means the whole catalogue, which is the right default for standards
 * that have no optional parts.
 */
function applicableControls(
  pack: RegulationPack,
  inScope: readonly string[] | undefined,
): RegulationPack["controls"] {
  if (!inScope) return pack.controls;
  const selected = new Set<string>([...(pack.alwaysInScope ?? []), ...inScope]);
  return pack.controls.filter((c) => selected.has(c.category));
}

/**
 * Build the evidence matrix for one regulation.
 *
 * Throws when `controlOwners` names a control id the catalogue does
 * not contain — a typo there silently drops an accountable owner from
 * an audit document, so it fails loudly instead.
 */
export function buildControlMatrix(
  opts: BuildControlMatrixOptions,
): ControlMatrixReport {
  const {
    pack,
    scope,
    receipts,
    controlOwners = {},
    annotations = {},
    coverageThresholdDays = 30,
  } = opts;

  const catalogIds = new Set(pack.controls.map((c) => c.id));
  for (const [field, supplied] of [
    ["controlOwners", controlOwners],
    ["annotations", annotations],
  ] as const) {
    const unknown = Object.keys(supplied).filter((k) => !catalogIds.has(k));
    if (unknown.length > 0) {
      throw new Error(
        `buildControlMatrix: ${field} referenced unknown ${pack.controlNoun.singular} id(s) for ` +
          `${pack.standard}: ${unknown.join(", ")}. ` +
          `Valid ids: ${[...catalogIds].sort().join(", ")}`,
      );
    }
  }

  const generatedAt = new Date().toISOString();
  const { buckets, packless } = bucketByPack(receipts);
  const applicable = applicableControls(pack, scope.inScope);
  const mappedPacks = new Set<string>();

  const controls: ControlEvidence[] = applicable.map((c) => {
    const { tally, matchedPacks } = tallyFromBuckets(
      buckets,
      c.evidencePackPrefixes,
    );
    for (const p of matchedPacks) mappedPacks.add(p);
    const entry: ControlEvidence = { ...c, evidence: tally };
    const owner = controlOwners[c.id];
    if (owner) entry.controlOwner = owner;
    const annotation = annotations[c.id];
    if (annotation) entry.annotation = annotation;
    return entry;
  });

  // Receipts carrying a pack no in-scope control claims. Worth
  // surfacing: it is usually either a missing catalogue mapping or
  // evidence being generated for something nobody is auditing.
  let unmappedReceipts = packless;
  for (const [p, b] of buckets) {
    if (!mappedPacks.has(p)) unmappedReceipts += b.count;
  }

  const byCategory: Record<string, { total: number; withEvidence: number }> = {};
  for (const c of controls) {
    const bucket = (byCategory[c.category] ??= { total: 0, withEvidence: 0 });
    bucket.total++;
    if (c.evidence.count > 0) bucket.withEvidence++;
  }

  // An annotated control is not a gap. The operator has already said
  // something about it — "not applicable, because …" — and repeating it
  // in the gap list would bury the controls nobody has answered for.
  const gaps = controls.filter(
    (c) =>
      !c.annotation &&
      (c.evidence.count === 0 ||
        c.evidence.daysOfCoverage < coverageThresholdDays),
  );

  const withEvidence = controls.filter((c) => c.evidence.count > 0).length;
  const totalDays = controls.reduce((s, c) => s + c.evidence.daysOfCoverage, 0);

  const fromMs = Date.parse(scope.periodStart);
  const toMs = Date.parse(scope.periodEnd);
  const durationDays =
    Number.isFinite(fromMs) && Number.isFinite(toMs)
      ? Math.max(1, Math.round((toMs - fromMs) / MS_PER_DAY))
      : 1;

  return {
    schema: pack.schema,
    standard: pack.standard,
    reportTitle: pack.reportTitle,
    generatedAt,
    scope,
    reportingWindow: {
      from: scope.periodStart,
      to: scope.periodEnd,
      durationDays,
      totalReceipts: receipts.length,
    },
    controls,
    byCategory,
    gaps,
    summary: {
      controlsTotal: controls.length,
      controlsWithEvidence: withEvidence,
      controlsAnnotated: controls.filter((c) => c.annotation).length,
      coverageRate: controls.length > 0 ? withEvidence / controls.length : 0,
      averageDaysOfCoverage:
        controls.length > 0 ? totalDays / controls.length : 0,
      unmappedReceipts,
    },
  };
}

// ── Rendering ────────────────────────────────────────────────────────

/** Category order: the pack's declared vocabulary first, then the rest. */
function orderedCategories(
  pack: RegulationPack,
  present: readonly string[],
): string[] {
  const seen = new Set(present);
  const ordered = pack.categories.filter((c) => seen.has(c));
  const extra = present.filter((c) => !pack.categories.includes(c)).sort();
  return [...ordered, ...extra];
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

/** Escape a table cell so a pipe in regulation text cannot break the row. */
function cell(text: string, max = 0): string {
  const t = max > 0 && text.length > max ? `${text.slice(0, max)}…` : text;
  return t.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** Who generated a report, for its provenance footer. */
export interface Generator {
  name: string;
  url: string;
}

/**
 * The engine ships in more than one distribution, so the provenance
 * footer names the spec rather than any one package. Callers that want
 * to name themselves pass a `generator`.
 */
const DEFAULT_GENERATOR: Generator = {
  name: "the Sovereign Matrix compliance engine",
  url: "https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/compliance",
};

/**
 * Render the report as markdown — the artifact you hand an auditor.
 *
 * `pack` is required: the report carries the regulation's vocabulary,
 * but the ordered category list and meta-column headers live in the
 * pack, not in the (serialisable) report.
 */
export function toMarkdown(
  report: ControlMatrixReport,
  pack: RegulationPack,
  opts: { generator?: Generator } = {},
): string {
  const generator = opts.generator ?? DEFAULT_GENERATOR;
  const lines: string[] = [];
  const h = (level: number, text: string): void => {
    lines.push(`${"#".repeat(level)} ${text}`, "");
  };
  const kv = (k: string, v: unknown): void => {
    lines.push(`- **${k}:** ${String(v)}`);
  };
  const noun = pack.controlNoun;
  const Noun = (w: string): string => `${w[0]!.toUpperCase()}${w.slice(1)}`;

  h(1, report.reportTitle);
  lines.push(`*Generated by ${generator.name} at ${report.generatedAt}*`, "");
  lines.push(`*${pack.preamble}*`, "");

  h(2, "Scope");
  kv("Organization", report.scope.organizationName);
  kv("System", report.scope.systemName);
  kv("Standard", report.standard);
  kv("Period", `${report.scope.periodStart} → ${report.scope.periodEnd}`);
  kv("Period length", `${report.reportingWindow.durationDays} days`);
  kv("Receipts in window", report.reportingWindow.totalReceipts);
  for (const [k, v] of Object.entries(report.scope.declarations ?? {})) {
    kv(k, v);
  }
  lines.push("");

  h(2, "Summary");
  kv(`${Noun(noun.plural)} in scope`, report.summary.controlsTotal);
  kv("With evidence", report.summary.controlsWithEvidence);
  kv("Coverage rate", pct(report.summary.coverageRate));
  kv(
    "Average days of coverage",
    report.summary.averageDaysOfCoverage.toFixed(1),
  );
  kv("Gaps", report.gaps.length);
  kv("Operator-annotated", report.summary.controlsAnnotated);
  kv(`Receipts mapped to no ${noun.singular}`, report.summary.unmappedReceipts);
  lines.push("");

  const cats = orderedCategories(pack, Object.keys(report.byCategory));
  h(3, "Coverage by category");
  lines.push("| Category | In scope | With evidence | Coverage |", "|---|---:|---:|---:|");
  for (const c of cats) {
    const b = report.byCategory[c];
    if (!b) continue;
    const rate = b.total > 0 ? b.withEvidence / b.total : 0;
    lines.push(`| ${cell(c)} | ${b.total} | ${b.withEvidence} | ${pct(rate)} |`);
  }
  lines.push("");

  const metaCols = pack.metaColumns ?? [];
  const metaHeaders = metaCols.map((m) => ` ${m.header} |`).join("");
  const metaDashes = metaCols.map(() => "---|").join("");

  h(2, `${Noun(noun.singular)} matrix`);
  lines.push(
    `| ID |${metaHeaders} Title | Evidence | Days | First | Last | Owner | Operator note |`,
    `|---|${metaDashes}---|---:|---:|---|---|---|---|`,
  );
  for (const c of report.controls) {
    const meta = metaCols
      .map((m) => ` ${cell(c.meta?.[m.key] ?? "—")} |`)
      .join("");
    const note = c.annotation
      ? [c.annotation.status, c.annotation.note].filter(Boolean).join(" — ")
      : "";
    lines.push(
      `| \`${cell(c.id)}\` |${meta} ${cell(c.title, 72)} | ${c.evidence.count} | ` +
        `${c.evidence.daysOfCoverage} | ${c.evidence.earliest?.slice(0, 10) ?? "—"} | ` +
        `${c.evidence.latest?.slice(0, 10) ?? "—"} | ${cell(c.controlOwner ?? "—")} | ` +
        `${cell(note || "—", 72)} |`,
    );
  }
  lines.push("");

  h(2, "Gaps");
  if (report.gaps.length === 0) {
    lines.push(
      `No gaps: every in-scope ${noun.singular} carries evidence across the coverage threshold.`,
      "",
    );
  } else {
    lines.push(
      `${report.gaps.length} ${report.gaps.length === 1 ? noun.singular : noun.plural} ` +
        `carry no evidence, or evidence spanning fewer days than the threshold. ` +
        `Each needs either operator narrative or a Guardian pack emitting receipts against it.`,
      "",
      `| ID | Title | Evidence | Days | Objective |`,
      `|---|---|---:|---:|---|`,
    );
    for (const g of report.gaps) {
      lines.push(
        `| \`${cell(g.id)}\` | ${cell(g.title, 56)} | ${g.evidence.count} | ` +
          `${g.evidence.daysOfCoverage} | ${cell(g.objective, 96)} |`,
      );
    }
    lines.push("");
  }

  h(2, "Provenance");
  lines.push(
    `Generated by [${generator.name}](${generator.url}) · Apache-2.0. ` +
      `Every number above is a count over the supplied receipts: evidence is the number of receipts whose ` +
      `Guardian pack name starts with one of the ${noun.singular}'s mapped prefixes, and days is the number ` +
      `of distinct UTC days those receipts span. Given the same receipt set, an auditor re-derives this ` +
      `document exactly. Mapping a ${noun.singular} to a pack prefix is an operator judgement, and this ` +
      `document is evidence, not a certification of conformity.`,
  );

  return lines.join("\n");
}

/** Render the report as JSON. */
export function toJSON(report: ControlMatrixReport): string {
  return JSON.stringify(report, null, 2);
}
