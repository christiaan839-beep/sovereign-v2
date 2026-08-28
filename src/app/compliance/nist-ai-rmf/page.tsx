import type { Metadata } from "next";
import Link from "next/link";
import {
  buildComplianceReport,
  byCategory,
  byMeta,
  groupTally,
  renderMarkdown,
  type ControlEvidence,
} from "@sovereign-matrix/compliance";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";
import { packageUrl } from "@/lib/package-links";

export const metadata: Metadata = {
  title: "NIST AI RMF 1.0 Profile — Live Preview · Sovereign Matrix",
  description:
    "First-of-its-kind Apache 2.0 NIST AI Risk Management Framework 1.0 profile exporter. Receipts in, GOVERN/MAP/MEASURE/MANAGE profile out. Live preview from a sample receipt set.",
};

// Sample receipts spanning the four NIST AI RMF function pack tags.
const SAMPLE_RECEIPTS: ReceiptRecord[] = (() => {
  const base = new Date("2026-01-15T00:00:00Z").getTime();
  const out: ReceiptRecord[] = [];
  const agents = ["loan-underwriter", "credit-analyst", "fraud-detector"];
  const packs = [
    "nist-ai-rmf-govern",
    "nist-ai-rmf-map",
    "nist-ai-rmf-measure",
    "nist-ai-rmf-manage",
    "iso42001-aims",
    "euaiact-art-9",
    "owasp-agentic",
    "gdpr-2026",
    "fairness-eval",
  ];
  for (let i = 0; i < 612; i++) {
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
})();

/**
 * Operator self-assessed maturity, 0-4. Receipts cannot establish this —
 * it is a human judgement about how embedded a practice is — so it sits
 * beside the sample scope rather than coming out of the report.
 */
const MATURITY: Record<string, number> = {
  "GOVERN-1.1": 3,
  "GOVERN-2.1": 4,
  "MEASURE-2.7": 3,
  "MANAGE-2.4": 4,
};

export default function NistAiRmfPreview() {
  const report = buildComplianceReport({
    regulation: "nist-ai-rmf",
    scope: {
      organizationName: "Sample Operator — Acme Financial AI Ltd",
      systemName: "Acme Loan Underwriting AI",
      periodStart: "2026-01-01T00:00:00Z",
      periodEnd: "2026-06-30T23:59:59Z",
      declarations: {
        "Lifecycle stage": "operation",
        "Organizational role": "AI Operator (financial services)",
        "Profile type": "current",
        "Intended use":
          "Automated decisioning for consumer loan applications EUR 1k-50k.",
        "Risk tolerance": "medium",
        GOVERN:
          "AI Governance Committee meets quarterly. Chair: Chief Risk Officer. Charter and minutes published at docs/governance/ai-committee.md.",
      },
    },
    receipts: SAMPLE_RECEIPTS,
  });

  const md = renderMarkdown(report);
  const functions = byCategory(report);
  const characteristics = byMeta(report, "characteristic");

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
            NIST AI RMF 1.0 profile,
            <br />
            <em className="not-italic text-[#B5532C]">
              generated from receipts.
            </em>
          </h1>
          <p className="text-[17px] text-neutral-400 leading-[1.6] mb-3">
            NIST AI RMF 1.0 (NIST AI 100-1, January 2023) is the de-facto US
            federal AI risk-management standard. This page generates the GOVERN
            / MAP / MEASURE / MANAGE profile from a sample receipt set using{" "}
            <code className="font-mono text-[14px] text-cyan-300/90">
              @sovereign-matrix/compliance
            </code>
            .
          </p>
          <p className="text-[14px] text-neutral-500 leading-relaxed">
            Each subcategory carries a receipt-derived evidence count and an
            operator self-assessment maturity level (0-4 scale per the RMF
            Playbook).
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
            {`npm install @sovereign-matrix/compliance`}
          </pre>
        </div>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-6 tracking-tight">
            Coverage by function
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(["GOVERN", "MAP", "MEASURE", "MANAGE"] as const).map((fn) => {
              const summary = groupTally(functions, fn);
              return (
                <div
                  key={fn}
                  className="rounded-[6px] border border-white/[0.06] bg-white/[0.015] p-5"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#B5532C] mb-2">
                    {fn}
                  </p>
                  <p className="font-serif text-[28px] tracking-tight mb-1">
                    {summary.withEvidence}{" "}
                    <span className="text-neutral-600 text-[16px]">
                      / {summary.total}
                    </span>
                  </p>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    subcategories evidenced ·{" "}
                    {summary.evidenceCount.toLocaleString()} receipts
                    attributable
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-6 tracking-tight">
            Trustworthy-AI characteristics
          </h2>
          <p className="text-[13px] text-neutral-500 mb-6 max-w-2xl">
            The seven characteristics from NIST AI RMF Appendix B. Each
            subcategory is tagged with one — this view shows which properties
            your receipt set evidences strongly.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {characteristics.map(({ key: k, withEvidence: v }) => (
              <div
                key={k}
                className="rounded-[6px] border border-white/[0.06] bg-white/[0.015] px-4 py-3 flex items-baseline justify-between"
              >
                <span className="text-[12px] text-neutral-400">
                  {k.replace(/-/g, " ")}
                </span>
                <span
                  className={`font-mono text-[14px] font-semibold ${v > 0 ? "text-emerald-400" : "text-neutral-600"}`}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-2 tracking-tight">
            Subcategory evidence
          </h2>
          <p className="text-[13px] text-neutral-500 mb-6 max-w-2xl">
            All {report.controls.length} subcategories with receipt-
            derived evidence counts. Maturity column reflects operator
            self-assessment (0 = not implemented, 4 = optimized).
          </p>
          <div className="rounded-[6px] border border-white/[0.06] overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-white/[0.02] text-neutral-500 font-mono uppercase tracking-[0.14em] text-[10px]">
                <tr>
                  <th className="text-left px-4 py-2.5">ID</th>
                  <th className="text-left px-4 py-2.5">Outcome</th>
                  <th className="text-right px-4 py-2.5">Evidence</th>
                  <th className="text-right px-4 py-2.5">Maturity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {report.controls.slice(0, 30).map((s: ControlEvidence) => (
                  <tr
                    key={s.id}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-2 font-mono text-cyan-300/90 text-[11px]">
                      {s.id}
                    </td>
                    <td className="px-4 py-2 text-neutral-300">{s.title}</td>
                    <td className="px-4 py-2 text-right font-mono">
                      {s.evidence.count > 0 ? (
                        <span className="text-emerald-400">
                          {s.evidence.count}
                        </span>
                      ) : (
                        <span className="text-neutral-600">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-neutral-400">
                      {MATURITY[s.id] ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-neutral-600 mt-3 italic">
            Showing 30 of {report.controls.length} subcategories. Full
            report available via renderMarkdown / toJSON.
          </p>
        </section>

        <section className="mt-16">
          <h2 className="font-serif text-3xl md:text-4xl mb-2 tracking-tight">
            Markdown preview
          </h2>
          <p className="text-[13px] text-neutral-500 mb-6 max-w-2xl">
            The exact bytes{" "}
            <code className="text-cyan-300/90">renderMarkdown(report)</code>{" "}
            returned. Hand to your federal procurement officer; ingest the JSON
            into GovRAMP/FedRAMP tooling.
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
            US federal procurement
          </p>
          <h3 className="font-serif text-3xl md:text-4xl mb-4 tracking-tight">
            Three lines around your AI calls.
            <br />
            <em className="not-italic text-[#B5532C]">
              NIST RMF profile, automatic.
            </em>
          </h3>
          <p className="text-[14px] text-neutral-400 leading-relaxed mb-6 max-w-2xl">
            Sovereign Matrix runs the receipt pipeline and produces these
            profiles automatically. Free tier: 50 verified runs / month.
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
              href="/compliance/soc2"
              className="inline-flex items-center gap-2 px-5 py-3 text-neutral-500 hover:text-white font-mono text-[13px] transition-colors"
            >
              See SOC 2 binder →
            </Link>
          </div>
        </section>

        <footer className="mt-16 pt-8 border-t border-white/[0.04] text-[12px] font-mono text-neutral-600">
          Generated by{" "}
          <code className="text-cyan-300/80">
            @sovereign-matrix/compliance
          </code>{" "}
          v0.1.0 · Apache 2.0 · schema{" "}
          <code className="text-cyan-300/80">vaos-nist-ai-rmf-v1</code>
        </footer>
      </main>
    </div>
  );
}
