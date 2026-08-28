import type { Metadata } from "next";
import Link from "next/link";
import { buildAnnexIv, toMarkdown } from "@sovereign-matrix/annex-iv";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";
import { packageUrl } from "@/lib/package-links";

export const metadata: Metadata = {
  title: "EU AI Act Annex IV — Live Preview · Sovereign Matrix",
  description:
    "First-of-its-kind Apache 2.0 EU AI Act Annex IV technical-documentation exporter. Receipts in, regulator-ready Article 11 report out. Live preview generated from a sample receipt set.",
};

const SAMPLE_RECEIPTS: ReceiptRecord[] = (() => {
  const base = new Date("2026-01-15T00:00:00Z").getTime();
  const out: ReceiptRecord[] = [];
  const agents = [
    "loan-underwriter",
    "credit-analyst",
    "fraud-detector",
    "kyc-classifier",
  ];
  const packs = [
    "euAiAct-art-9",
    "euAiAct-art-13",
    "euAiAct-art-14",
    "cfpb-2026",
    "gdpr-2026",
  ];
  for (let i = 0; i < 482; i++) {
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
      ...(i % 89 === 0 ? { anomalyKind: "block-rate-spike" } : {}),
    } as ReceiptRecord);
  }
  return out;
})();

export default function AnnexIvPreview() {
  const report = buildAnnexIv({
    system: {
      name: "Sample High-Risk AI — Acme Loan Underwriting",
      identifier: "acme-loan-2026",
      riskCategory: "high-risk",
      provider: "Acme Financial AI Ltd",
      authorisedRepresentativeEU: "Acme EU GmbH",
      intendedPurpose:
        "Automated decisioning for consumer loan applications EUR 1k-50k.",
      annexIIIUseCase: "creditworthiness assessment",
      placedOnMarketAt: "2026-01-15T00:00:00Z",
    },
    receipts: SAMPLE_RECEIPTS,
    sampleBlockedReceipts: 5,
    nextReportDue: "2026-08-15T00:00:00Z",
    operatorActions: [
      "Tightened block-rate threshold (2026-04-12).",
      "Added FAIR Act pack (2026-04-21).",
      "Quarterly post-market monitoring review — no new substantial modifications.",
    ],
  });

  const md = toMarkdown(report);

  return (
    <div className="relative min-h-dvh bg-[#030303] text-white antialiased">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-30"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 50% 0%, rgba(181,83,44,0.18) 0%, transparent 70%)",
        }}
      />

      <main className="relative max-w-6xl mx-auto px-6 md:px-10 py-20 md:py-28">
        <div className="mb-12">
          <Link
            href="/"
            className="text-[12px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors tracking-tight"
          >
            ← Sovereign Matrix
          </Link>
        </div>

        <div className="max-w-3xl">
          <p className="text-[10px] font-mono tracking-[0.22em] uppercase text-[#B5532C] mb-5">
            Live preview · Apache-2.0 OSS
          </p>
          <h1 className="font-serif text-5xl md:text-6xl leading-[1.04] tracking-[-0.02em] mb-6">
            EU AI Act Annex IV,
            <br />
            <em className="not-italic text-[#B5532C]">
              generated from receipts.
            </em>
          </h1>
          <p className="text-[17px] text-neutral-400 leading-[1.6] mb-3">
            Article 11 of Regulation (EU) 2024/1689 requires every provider of a
            high-risk AI system to maintain Annex IV technical documentation.
            This page generates the §3 / §4 / §6 / §9 sections from a sample
            receipt set using{" "}
            <code className="font-mono text-[14px] text-cyan-300/90">
              @sovereign-matrix/annex-iv
            </code>
            .
          </p>
          <p className="text-[14px] text-neutral-500 leading-relaxed">
            Operator-authored sections (§1 / §2 / §5 / §7 / §8) emit as
            structured stubs with regulation-clause schema hints. Enforcement of
            Article 6 (high-risk obligations) begins{" "}
            <span className="text-neutral-300">2026-08-02</span>.
          </p>
        </div>

        <div className="mt-12 rounded-[6px] border border-cyan-500/20 bg-black/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Install · Apache 2.0
            </p>
            <p className="text-[10px] font-mono text-neutral-600">
              Zero runtime deps beyond verifiable-receipts
            </p>
          </div>
          <pre className="px-5 py-4 overflow-x-auto font-mono text-[13px] leading-[1.6] text-cyan-300/95">
            {`npm install @sovereign-matrix/annex-iv @sovereign-matrix/verifiable-receipts`}
          </pre>
        </div>

        {/* System metadata */}
        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-6 tracking-tight">
            System metadata
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-[14px]">
            <KV k="Name" v={report.system.name} />
            <KV k="Risk category" v={report.system.riskCategory} />
            <KV k="Provider" v={report.system.provider} />
            {report.system.authorisedRepresentativeEU && (
              <KV
                k="Authorised representative (EU)"
                v={report.system.authorisedRepresentativeEU}
              />
            )}
            <KV k="Intended purpose" v={report.system.intendedPurpose} wide />
            {report.system.annexIIIUseCase && (
              <KV k="Annex III use-case" v={report.system.annexIIIUseCase} />
            )}
            <KV k="Placed on market" v={report.system.placedOnMarketAt} />
          </div>
        </section>

        {/* §3 §4 §6 §9 derived */}
        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-2 tracking-tight">
            Derived from receipts
          </h2>
          <p className="text-[13px] text-neutral-500 mb-6 max-w-2xl">
            §3 (Monitoring), §4 (Performance), §6 (Lifecycle changes), §9
            (Post-market monitoring) are computed from the receipt set —
            byte-deterministic and auditor-reproducible.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            <ClauseCard
              n="3"
              title="Monitoring, functioning and control"
              rows={[
                [
                  "Pass",
                  report.monitoringFunctioning.verdictCounts.pass.toString(),
                ],
                [
                  "Warn",
                  report.monitoringFunctioning.verdictCounts.warn.toString(),
                ],
                [
                  "Block",
                  report.monitoringFunctioning.verdictCounts.block.toString(),
                ],
                [
                  "Block-rate",
                  `${(report.monitoringFunctioning.blockRate * 100).toFixed(2)}%`,
                ],
                [
                  "Agents observed",
                  report.monitoringFunctioning.agentsObserved.length.toString(),
                ],
                [
                  "Packs exercised",
                  report.monitoringFunctioning.packsExercised.length.toString(),
                ],
              ]}
            />
            <ClauseCard
              n="4"
              title="Performance metrics"
              rows={[
                [
                  "Receipts/day",
                  report.performanceMetrics.receiptsPerDay.toFixed(1),
                ],
                [
                  "p50 latency",
                  `${report.performanceMetrics.p50LatencyMs ?? "n/a"} ms`,
                ],
                [
                  "p99 latency",
                  `${report.performanceMetrics.p99LatencyMs ?? "n/a"} ms`,
                ],
                [
                  "Consistency",
                  report.performanceMetrics.consistencyIndicator.toFixed(4),
                ],
              ]}
            />
            <ClauseCard
              n="6"
              title="Lifecycle changes"
              rows={[
                [
                  "Distinct agents launched",
                  report.lifecycleChanges.distinctAgentsLaunched.toString(),
                ],
                [
                  "Distinct packs adopted",
                  report.lifecycleChanges.distinctPacksAdopted.toString(),
                ],
              ]}
            />
            <ClauseCard
              n="9"
              title="Post-market monitoring (Article 72)"
              rows={[
                [
                  "Receipts anchored",
                  report.postMarketMonitoring.receiptsAnchored.toString(),
                ],
                [
                  "Anomalies detected",
                  report.postMarketMonitoring.anomaliesDetected.toString(),
                ],
                [
                  "Operator actions",
                  report.postMarketMonitoring.operatorActions.length.toString(),
                ],
                [
                  "Next report due",
                  report.postMarketMonitoring.nextReportDue ?? "n/a",
                ],
              ]}
            />
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-2 tracking-tight">
            Markdown preview
          </h2>
          <p className="text-[13px] text-neutral-500 mb-6 max-w-2xl">
            The exact bytes{" "}
            <code className="text-cyan-300/90">toMarkdown(report)</code>{" "}
            returned. File with the EU AI Office; hand to your conformity-
            assessment body.
          </p>
          <div className="rounded-[6px] border border-white/[0.06] bg-black/40 max-h-[560px] overflow-y-auto">
            <pre className="px-5 py-4 font-mono text-[11px] leading-[1.55] text-neutral-300 whitespace-pre-wrap break-words">
              {md.slice(0, 4500)}
              {md.length > 4500 &&
                "\n\n… (truncated — full output is ~" +
                  (md.length / 1000).toFixed(1) +
                  "kB)"}
            </pre>
          </div>
        </section>

        <section className="mt-20 mb-8 rounded-[10px] border border-[#B5532C]/20 bg-[#1a0f0a]/40 px-6 md:px-10 py-10 md:py-14">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-[#B5532C] mb-4">
            EU AI Act enforcement: 2026-08-02
          </p>
          <h3 className="font-serif text-3xl md:text-4xl mb-4 tracking-tight">
            Three lines around your AI calls.
            <br />
            <em className="not-italic text-[#B5532C]">
              Article 11 documentation, automatic.
            </em>
          </h3>
          <p className="text-[14px] text-neutral-400 leading-relaxed mb-6 max-w-2xl">
            Sovereign Matrix runs the receipt pipeline and produces these
            reports automatically. Free tier: 50 verified runs / month. EU AI
            Act high-risk enforcement begins August 2026 — start now.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#B5532C] text-white font-semibold text-[13px] rounded-[3px] hover:bg-[#C96234] transition-colors tracking-tight"
            >
              Start free — 50 runs/mo
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href={packageUrl("@sovereign-matrix/annex-iv")}
              className="inline-flex items-center gap-2 px-5 py-3 border border-white/[0.12] text-neutral-300 font-mono text-[13px] rounded-[3px] hover:text-white hover:border-white/25 transition-colors"
            >
              View source
            </Link>
            <Link
              href="/compliance/iso-42001"
              className="inline-flex items-center gap-2 px-5 py-3 text-neutral-500 hover:text-white font-mono text-[13px] transition-colors"
            >
              See ISO 42001 →
            </Link>
          </div>
        </section>

        <footer className="mt-16 pt-8 border-t border-white/[0.04] text-[12px] font-mono text-neutral-600">
          Generated by{" "}
          <code className="text-cyan-300/80">@sovereign-matrix/annex-iv</code>{" "}
          v0.1.0 · Apache 2.0 · schema{" "}
          <code className="text-cyan-300/80">vaos-annex-iv-v1</code>
        </footer>
      </main>
    </div>
  );
}

function KV({ k, v, wide }: { k: string; v: string; wide?: boolean }) {
  return (
    <div
      className={`rounded-[6px] border border-white/[0.06] bg-white/[0.015] px-4 py-3 ${wide ? "md:col-span-2" : ""}`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500 mb-1">
        {k}
      </p>
      <p className="text-neutral-200 text-[14px]">{v}</p>
    </div>
  );
}

function ClauseCard({
  n,
  title,
  rows,
}: {
  n: string;
  title: string;
  rows: [string, string][];
}) {
  return (
    <div className="rounded-[6px] border border-white/[0.06] bg-white/[0.015] p-5">
      <div className="flex items-baseline gap-3 mb-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#B5532C]">
          § {n}
        </span>
        <h3 className="font-serif text-[18px] tracking-tight">{title}</h3>
      </div>
      <ul className="space-y-1.5 text-[13px]">
        {rows.map(([k, v]) => (
          <li key={k} className="flex items-baseline justify-between gap-3">
            <span className="text-neutral-500">{k}</span>
            <span className="font-mono text-neutral-200">{v}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
