import type { Metadata } from "next";
import Link from "next/link";
import {
  buildComplianceReport,
  byCategory,
  groupTally,
  renderMarkdown,
  type ControlEvidence,
} from "@sovereign-matrix/compliance";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";
import { packageUrl } from "@/lib/package-links";

export const metadata: Metadata = {
  title: "SOC 2 Evidence Binder — Live Preview · Sovereign Matrix",
  description:
    "Apache 2.0 SOC 2 evidence-binder exporter. Receipts in, AICPA TSC 2017 evidence package out. Live preview from a sample receipt set spanning a 6-month audit period.",
};

const SAMPLE_RECEIPTS: ReceiptRecord[] = (() => {
  const base = new Date("2026-01-01T00:00:00Z").getTime();
  const audit_end = new Date("2026-06-30T23:59:59Z").getTime();
  const span = audit_end - base;
  const out: ReceiptRecord[] = [];
  const agents = [
    "auth-service",
    "ingest-pipeline",
    "loan-underwriter",
    "backup-orchestrator",
    "incident-bot",
  ];
  const packs = [
    "soc2-cc1",
    "soc2-cc6-iam",
    "soc2-cc6-rbac",
    "soc2-cc7-anomaly",
    "soc2-cc8-change",
    "soc2-availability",
    "soc2-confidentiality",
    "soc2-processing-integrity",
    "auth-mfa",
    "anomaly-detection",
    "incident-response",
    "encryption-tls",
    "change-management-pr",
    "dr-test",
  ];
  for (let i = 0; i < 1820; i++) {
    const verdictRoll = i % 47;
    const overall: ReceiptRecord["overall"] =
      verdictRoll < 43 ? "pass" : verdictRoll < 46 ? "warn" : "block";
    out.push({
      verdictId: `v_${i.toString(36).padStart(6, "0")}`,
      overall,
      issuedAt: new Date(base + (i * span) / 1820).toISOString(),
      agentSlug: agents[i % agents.length] as string,
      pack: packs[i % packs.length] as string,
    } as ReceiptRecord);
  }
  return out;
})();

export default function Soc2Preview() {
  const report = buildComplianceReport({
    regulation: "soc2",
    scope: {
      organizationName: "Sample Operator — Acme AI Operations Ltd",
      systemName: "Loan underwriting platform",
      periodStart: "2026-01-01T00:00:00Z",
      periodEnd: "2026-06-30T23:59:59Z",
      inScope: ["availability", "confidentiality", "processing-integrity"],
      declarations: {
        "Service auditor": "Sample Big-4 CPA Firm LLP",
        Services:
          "AI-powered loan-underwriting platform delivering automated decisions for consumer loans 1k-50k EUR with cryptographic receipts on every output.",
      },
    },
    receipts: SAMPLE_RECEIPTS,
    controlOwners: {
      "CC6.1": "Sarah Chen, Director of Security",
      "CC7.4": "Incident Response Team Lead",
      "CC8.1": "VP Engineering",
      "A1.1": "Director of Platform Engineering",
    },
    coverageThresholdDays: 30,
  });

  const md = renderMarkdown(report);
  const categories = byCategory(report);
  const security = groupTally(categories, "security");
  const securityCount = security.total;
  const securityEvidenced = security.withEvidence;

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
            SOC 2 evidence binder,
            <br />
            <em className="not-italic text-[#B5532C]">
              generated from receipts.
            </em>
          </h1>
          <p className="text-[17px] text-neutral-400 leading-[1.6] mb-3">
            AICPA Trust Service Criteria 2017 evidence package, generated from a
            sample 6-month audit window using{" "}
            <code className="font-mono text-[14px] text-cyan-300/90">
              @sovereign-matrix/compliance
            </code>
            .
          </p>
          <p className="text-[14px] text-neutral-500 leading-relaxed">
            Vanta and Drata charge $5-50K/year for the same deliverable. Each
            criterion carries a receipt-derived evidence count + days-of-
            coverage metric so the auditor can spot evidence gaps before the
            engagement kickoff.
          </p>
        </div>

        <div className="mt-12 rounded-[6px] border border-cyan-500/20 bg-black/40 overflow-hidden">
          <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Install · Apache 2.0
            </p>
            <p className="text-[10px] font-mono text-neutral-600">
              Zero runtime dependencies
            </p>
          </div>
          <pre className="px-5 py-4 overflow-x-auto font-mono text-[13px] leading-[1.6] text-cyan-300/95">
            {`npm install @sovereign-matrix/compliance`}
          </pre>
        </div>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-6 tracking-tight">
            Audit window
          </h2>
          <div className="grid md:grid-cols-2 gap-4 text-[14px]">
            <KV k="Organization" v={report.scope.organizationName} />
            <KV
              k="Audit period"
              v={`${report.scope.periodStart.slice(0, 10)} → ${report.scope.periodEnd.slice(0, 10)}`}
            />
            <KV
              k="Duration"
              v={`${report.reportingWindow.durationDays} days`}
            />
            <KV
              k="Categories in scope"
              v={categories.map((c) => c.key).join(", ")}
            />
            <KV
              k="Service auditor"
              v={report.scope.declarations?.["Service auditor"] ?? "n/a"}
            />
            <KV
              k="Total receipts"
              v={report.reportingWindow.totalReceipts.toLocaleString()}
            />
            <KV k="Services" v={report.scope.declarations?.Services ?? ""} wide />
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-6 tracking-tight">
            Coverage summary
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatBig
              label="Criteria evidenced"
              value={`${report.summary.controlsWithEvidence} / ${report.summary.controlsTotal}`}
              tone="emerald"
            />
            <StatBig
              label="Coverage rate"
              value={`${(report.summary.coverageRate * 100).toFixed(1)}%`}
              tone="emerald"
            />
            <StatBig
              label="Avg days of coverage"
              value={`${report.summary.averageDaysOfCoverage.toFixed(1)} / ${report.reportingWindow.durationDays}`}
              tone="neutral"
            />
            <StatBig
              label="Evidence gaps"
              value={report.gaps.length.toString()}
              tone={report.gaps.length > 0 ? "amber" : "emerald"}
            />
          </div>

          <h3 className="font-serif text-[18px] mt-8 mb-3 tracking-tight">
            By category
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {(
              [
                "security",
                "availability",
                "processing-integrity",
                "confidentiality",
                "privacy",
              ] as const
            ).map((cat) => {
              const { total, withEvidence: evidenced } = groupTally(
                categories,
                cat,
              );
              if (total === 0) {
                return (
                  <div
                    key={cat}
                    className="rounded-[6px] border border-white/[0.04] bg-white/[0.005] px-4 py-3 opacity-50"
                  >
                    <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-neutral-600 mb-1">
                      {cat}
                    </p>
                    <p className="text-[11px] text-neutral-600">out of scope</p>
                  </div>
                );
              }
              return (
                <div
                  key={cat}
                  className="rounded-[6px] border border-white/[0.06] bg-white/[0.015] px-4 py-3"
                >
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[#B5532C] mb-1">
                    {cat}
                  </p>
                  <p className="font-mono text-[18px]">
                    <span className="text-emerald-400">{evidenced}</span>
                    <span className="text-neutral-600 text-[14px]">
                      {" "}
                      / {total}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-2 tracking-tight">
            Security criteria (CC1-CC9)
          </h2>
          <p className="text-[13px] text-neutral-500 mb-6 max-w-2xl">
            {securityEvidenced} of {securityCount} Common Criteria evidenced
            over the {report.reportingWindow.durationDays}-day audit period.
            Days-of-coverage column flags sparse evidence (less than 30 days)
            that would be a finding.
          </p>
          <div className="rounded-[6px] border border-white/[0.06] overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-white/[0.02] text-neutral-500 font-mono uppercase tracking-[0.14em] text-[10px]">
                <tr>
                  <th className="text-left px-4 py-2.5">ID</th>
                  <th className="text-left px-4 py-2.5">Title</th>
                  <th className="text-right px-4 py-2.5">Evidence</th>
                  <th className="text-right px-4 py-2.5">Days</th>
                  <th className="text-left px-4 py-2.5">Owner</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {report.controls
                  .filter((c: ControlEvidence) => c.category === "security")
                  .map((c: ControlEvidence) => (
                    <tr
                      key={c.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-2 font-mono text-cyan-300/90 text-[11px]">
                        {c.id}
                      </td>
                      <td className="px-4 py-2 text-neutral-300">{c.title}</td>
                      <td className="px-4 py-2 text-right font-mono">
                        {c.evidence.count > 0 ? (
                          <span className="text-emerald-400">
                            {c.evidence.count}
                          </span>
                        ) : (
                          <span className="text-neutral-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {c.evidence.daysOfCoverage < 30 &&
                        c.evidence.count > 0 ? (
                          <span className="text-amber-400">
                            {c.evidence.daysOfCoverage}
                          </span>
                        ) : c.evidence.daysOfCoverage >= 30 ? (
                          <span className="text-emerald-400">
                            {c.evidence.daysOfCoverage}
                          </span>
                        ) : (
                          <span className="text-neutral-600">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-neutral-500 text-[11px]">
                        {c.controlOwner ?? "-"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        {report.gaps.length > 0 && (
          <section className="mt-12 rounded-[6px] border border-amber-500/20 bg-amber-500/[0.04] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-400 mb-3">
              Evidence gaps · {report.gaps.length}
            </p>
            <p className="text-[13px] text-neutral-400 mb-4 max-w-2xl">
              Criteria below the {30}-day coverage threshold OR with zero
              evidence. Close these with either supplementary manual evidence or
              expanded pack coverage before the audit kickoff.
            </p>
            <ul className="grid md:grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
              {report.gaps.slice(0, 20).map((g: ControlEvidence) => (
                <li key={g.id} className="flex items-baseline gap-2">
                  <span className="font-mono text-amber-400/90 text-[11px]">
                    {g.id}
                  </span>
                  <span className="text-neutral-500 truncate">{g.title}</span>
                </li>
              ))}
              {report.gaps.length > 20 && (
                <li className="text-neutral-600 italic">
                  … + {report.gaps.length - 20} more
                </li>
              )}
            </ul>
          </section>
        )}

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-2 tracking-tight">
            Markdown preview
          </h2>
          <p className="text-[13px] text-neutral-500 mb-6 max-w-2xl">
            The exact bytes{" "}
            <code className="text-cyan-300/90">renderMarkdown(report)</code>{" "}
            returned. Walk into the audit kickoff with this binder.
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
            Audit-ready in one quarter
          </p>
          <h3 className="font-serif text-3xl md:text-4xl mb-4 tracking-tight">
            Three lines around your AI calls.
            <br />
            <em className="not-italic text-[#B5532C]">
              SOC 2 evidence, automatic.
            </em>
          </h3>
          <p className="text-[14px] text-neutral-400 leading-relaxed mb-6 max-w-2xl">
            Sovereign Matrix runs the receipt pipeline and produces these
            binders automatically. Free tier: 50 verified runs / month.
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
              href={packageUrl("@sovereign-matrix/compliance")}
              className="inline-flex items-center gap-2 px-5 py-3 border border-white/[0.12] text-neutral-300 font-mono text-[13px] rounded-[3px] hover:text-white hover:border-white/25 transition-colors"
            >
              View source
            </Link>
            <Link
              href="/compliance/nist-ai-rmf"
              className="inline-flex items-center gap-2 px-5 py-3 text-neutral-500 hover:text-white font-mono text-[13px] transition-colors"
            >
              See NIST AI RMF →
            </Link>
          </div>
        </section>

        <footer className="mt-16 pt-8 border-t border-white/[0.04] text-[12px] font-mono text-neutral-600">
          Generated by{" "}
          <code className="text-cyan-300/80">@sovereign-matrix/compliance</code>{" "}
          v0.1.0 · Apache 2.0 · schema{" "}
          <code className="text-cyan-300/80">vaos-soc2-evidence-v1</code>
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

function StatBig({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "emerald" | "neutral" | "amber";
}) {
  const colorClass =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "amber"
        ? "text-amber-400"
        : "text-neutral-300";
  return (
    <div className="rounded-[6px] border border-white/[0.06] bg-white/[0.015] px-5 py-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#B5532C] mb-2">
        {label}
      </p>
      <p className={`font-serif text-[28px] tracking-tight ${colorClass}`}>
        {value}
      </p>
    </div>
  );
}
