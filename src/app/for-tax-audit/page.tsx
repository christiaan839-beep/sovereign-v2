// ISR — vertical pages are static marketing surfaces; regenerate hourly.
export const revalidate = 3600;

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Calculator,
  ShieldCheck,
  Scale,
  ClipboardCheck,
} from "lucide-react";
import type { Metadata } from "next";

/**
 * /for-tax-audit — Tier-1 ICP vertical landing (Cook 76).
 *
 * Hook: SOX ICFR + PCAOB AS 2201 audit trail + IRS 21 CFR-style
 * e-record requirements. Banker's-rounding (Cook 19) solves the
 * off-by-one-cent problem auditors hunt for. Audit-bundle (Cook 18)
 * + SOC 2 monitor (Cook 34) maps to every PCAOB control.
 */

export const metadata: Metadata = {
  title:
    "AI for Tax & Audit · SOX / PCAOB / IRS Audit-Trail Ready · Sovereign Matrix",
  description:
    "Audit-grade AI for control-narrative drafting, audit work-paper assistance, transfer-pricing memos. Banker's-rounded math, cryptographic receipts.",
  alternates: { canonical: "/for-tax-audit" },
};

const PRIMITIVES = [
  {
    icon: ShieldCheck,
    title: "PCAOB AS 2201 audit trail",
    desc: "Every workpaper AI generates is signed + replayable. Audit-bundle subscription auto-emails monthly evidence to engagement partners. Multi-party attestation lets engagement partner + concurring reviewer co-sign.",
  },
  {
    icon: Calculator,
    title: "Banker's-rounded math",
    desc: "Cook 19 billing math + Cook 16 marketplace revenue split both use half-to-even rounding. No systemic drift over time. Auditors can't find the off-by-one-cent gotcha that breaks PCAOB workpapers.",
  },
  {
    icon: Scale,
    title: "Control-narrative drafting",
    desc: "Generate ICFR control narratives that cite specific transactions + policy files. Hallucination guard ensures every control reference is grounded.",
  },
  {
    icon: ClipboardCheck,
    title: "Transfer-pricing memo first drafts",
    desc: "RAG over your intercompany agreements + comparable-set databases. Output cites Sec 482 + OECD BEPS 2.0 controls. Bias auditor flags any one-sided allocations.",
  },
  {
    icon: FileText,
    title: "Continuous SOX monitoring",
    desc: "SOC 2 indicator collector feeds a live control-posture board. Drift detector compares each quarter's outputs to the prior period. Quarterly attestation letter goes straight to your audit committee.",
  },
];

const USE_CASES = [
  {
    trigger:
      '"Draft SOX 404 control narratives for the new revenue-recognition system."',
    steps: [
      "Agent ingests the SDLC + cutover documentation.",
      "Composes narratives mapped to COSO 2013 components.",
      "Hallucination detector verifies every control cites a real policy.",
      "Engagement partner co-signs via multi-party attestation.",
    ],
    result:
      "Narratives + signed receipts + replay-ready audit trail. Q-close prep -75%.",
  },
  {
    trigger: '"Prep the Q3 audit work-paper bundle for KPMG."',
    steps: [
      "Audit-bundle subscription assembles all workpapers in scope.",
      "Banker's-rounded reconciliations attached as evidence.",
      "Quarterly attestation letter signed by CFO + Controller.",
    ],
    result: "Bundle delivered to engagement team before fieldwork starts.",
  },
  {
    trigger: '"Draft the transfer-pricing memo for the German subsidiary."',
    steps: [
      "Agent pulls intercompany agreements + comparable transactions.",
      "Composes memo citing Sec 482 + BEPS Action 13 + German DPA.",
      "Bias auditor flags any one-sided allocations.",
      "Multi-party attestation: Tax Director + Big-4 advisor co-sign.",
    ],
    result: "TP memo + signed evidence map. -80% on routine TP documentation.",
  },
];

const COMPLIANCE = [
  "SOX Section 404 — Internal Controls over Financial Reporting",
  "PCAOB AS 2201 — Audit of Internal Control over Financial Reporting",
  "COSO 2013 Framework — Internal Control",
  "IRS Sec 6001 / Treas. Reg. 1.6001-1 — Records",
  "OECD BEPS 2.0 — Transfer Pricing",
  "PCAOB AS 1215 — Audit Documentation",
  "EU CSRD — Corporate Sustainability Reporting Directive",
  "SOC 2 Type 2 — continuous monitoring",
];

export default function ForTaxAuditPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white tracking-wide">
            Sovereign Matrix
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/agents"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Agents
            </Link>
            <Link
              href="/trust"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Trust
            </Link>
            <Link
              href="/dashboard"
              className="text-xs px-4 py-2 rounded-full bg-white text-black font-semibold hover:bg-neutral-200 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <header className="max-w-6xl mx-auto px-6 pt-20 pb-12">
        <p className="text-[10px] uppercase tracking-[0.4em] text-rose-400 mb-4">
          Tax & Audit
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          Banker&rsquo;s rounding,{" "}
          <span className="text-rose-400">replayable workpapers.</span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          PCAOB AS 2201 and SOX 404 demand audit trail + reproducibility. Every
          Sovereign agent produces a workpaper an auditor can paste back into
          our replay endpoint to verify what was true at the time of the
          engagement.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/contact?vertical=tax-audit"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-rose-500 text-black font-semibold text-sm hover:bg-rose-400 transition-colors"
          >
            Talk to a former-Big-4 partner
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/spec"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 text-neutral-300 hover:text-white hover:border-white/20 transition-colors text-sm"
          >
            Read the receipts spec
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Primitives shipped for tax + audit
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {PRIMITIVES.map((p) => (
            <div
              key={p.title}
              className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/15 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <p.icon className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-semibold text-white">{p.title}</h3>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Three workflows landing on day one
        </h2>
        <div className="space-y-4">
          {USE_CASES.map((u, i) => (
            <div
              key={i}
              className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
            >
              <p className="text-sm text-white italic mb-4">{u.trigger}</p>
              <ul className="space-y-2 mb-4">
                {u.steps.map((s, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-xs text-neutral-400"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-rose-400 font-medium">{u.result}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Pre-mapped to audit-firm controls
        </h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {COMPLIANCE.map((c) => (
            <div
              key={c}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05]"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0" />
              <span className="text-xs text-neutral-300">{c}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-rose-500/15 bg-rose-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            Every audit firm asks: &ldquo;Where&rsquo;s the workpaper that ties
            this AI output to the policy?&rdquo;
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Sovereign Matrix is the answer: every agent emits a signed,
            replayable receipt. Every control narrative cites a real
            transaction. Every reconciliation uses banker&rsquo;s rounding so
            half-cents never drift. That&rsquo;s the audit trail PCAOB
            inspectors are pricing into next year&rsquo;s peer reviews.
          </p>
          <Link
            href="/contact?vertical=tax-audit"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-rose-500 text-black font-semibold text-sm hover:bg-rose-400 transition-colors"
          >
            Schedule a procurement deep-dive
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-6xl mx-auto text-[11px] text-neutral-500 flex flex-wrap gap-6">
          <Link href="/spec" className="hover:text-neutral-300">
            VAOS 2.0 receipts spec
          </Link>
          <Link href="/trust" className="hover:text-neutral-300">
            Trust posture
          </Link>
          <Link href="/agents" className="hover:text-neutral-300">
            140 agents
          </Link>
        </div>
      </footer>
    </div>
  );
}
