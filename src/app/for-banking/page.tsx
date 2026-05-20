// ISR — vertical pages are static marketing surfaces; regenerate hourly.
export const revalidate = 3600;

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  LineChart,
  ShieldCheck,
  Banknote,
  Activity,
} from "lucide-react";
import type { Metadata } from "next";

/**
 * /for-banking — Tier-1 ICP vertical landing (Cook 76).
 *
 * Hook: SR 11-7, MaRisk AT 4.3, PRA SS1/23 all demand model lifecycle
 * audit + drift detection + human oversight. Sovereign's drift
 * detector (Cook 35), hallucination detector (Cook 41), audit-bundle
 * subscription (Cook 56), and SOC 2 monitor (Cook 58) map to every
 * control out of the box.
 */

export const metadata: Metadata = {
  title:
    "AI for Banking & Model Risk · SR 11-7 / PRA SS1/23 Ready · Sovereign Matrix",
  description:
    "Audit-grade AI for credit-decisioning narratives, KYC pre-screening, AML alert triage, and audit prep. Continuous model-risk evidence with cryptographic receipts.",
  alternates: { canonical: "/for-banking" },
};

const PRIMITIVES = [
  {
    icon: ShieldCheck,
    title: "SR 11-7 + PRA SS1/23 model governance",
    desc: "Every agent run produces a signed receipt the model risk team can replay. Drift detector compares each output against the baseline at validation; deviations trigger an MRMG review automatically.",
  },
  {
    icon: LineChart,
    title: "Continuous drift + bias monitoring",
    desc: "Hallucination detector (verifier layer 6) + bias auditor + cost telemetry feed a live SOC 2 control posture board. Quarterly attestation letters auto-generate for your bank examiners.",
  },
  {
    icon: Banknote,
    title: "Credit-decisioning narrative drafting",
    desc: "Compose ECOA-compliant adverse-action letters and approval rationales. Hallucination guard ensures every claim ties back to a customer file or policy cite. Multi-party attestation lets compliance + risk + line-of-business co-sign.",
  },
  {
    icon: Activity,
    title: "KYC / AML alert triage",
    desc: "RAG over your sanctions + adverse-media feeds. Every triage decision is reproducible — exam-ready audit trail without an analyst writing case notes from memory.",
  },
  {
    icon: FileText,
    title: "Audit-prep automation",
    desc: "Cook 18 audit-bundle subscription delivers monthly evidence packs to your internal audit team. Signed by sovereign + your compliance officer; replayable by the examiner from day one.",
  },
];

const USE_CASES = [
  {
    trigger: '"Draft adverse-action letters for yesterday\'s credit denials."',
    steps: [
      "Agent pulls the denied applications + the model decisioning factors.",
      "Composes ECOA-compliant letters citing the specific reason codes.",
      "Hallucination detector verifies every cited reason ties back to a credit-bureau pull or policy file.",
      "Compliance officer + line-of-business head co-sign via multi-party attestation.",
    ],
    result:
      "Letters + receipts + replay-ready audit trail. -90% on adverse-action processing time, zero ECOA exceptions in the audit log.",
  },
  {
    trigger:
      '"Sweep last week\'s AML alerts and prepare SAR drafts for the top tier."',
    steps: [
      "Agent ingests TM alerts ranked by score.",
      "RAG retrieves transaction history, beneficial-owner records, prior SAR filings.",
      "Generates FinCEN-format SAR drafts with citations.",
      "Bias auditor flags any demographically-skewed narrative language.",
    ],
    result:
      "Draft SAR + cited evidence map + signed attestation. Reviewer time -60%.",
  },
  {
    trigger: '"Prep the quarterly model-risk validation package."',
    steps: [
      "Drift detector reports every model that exceeded tolerance in the period.",
      "Receipt timeline shows what was run, when, by whom, and with what input.",
      "Audit-bundle subscription auto-emails the package to internal audit.",
    ],
    result:
      "Quarterly validation package without an analyst stitching screenshots. Signed, dated, replayable.",
  },
];

const COMPLIANCE = [
  "Fed SR 11-7 — Guidance on Model Risk Management",
  "PRA SS1/23 — Model Risk Management Principles",
  "ECB / EBA TRIM — Targeted Review of Internal Models",
  "ECOA — Equal Credit Opportunity Act",
  "FCRA — Fair Credit Reporting Act",
  "BSA / AML — Bank Secrecy Act / FinCEN",
  "EU AI Act — High-Risk Credit Scoring (Annex III)",
  "SOC 2 readiness controls — continuous monitoring (audit-ready posture; formal Type 2 attestation in progress)",
];

export default function ForBankingPage() {
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
        <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-400 mb-4">
          Banking & Model Risk
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          AI you can put in front of your{" "}
          <span className="text-cyan-400">model-risk examiner.</span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          SR 11-7 + PRA SS1/23 + EU AI Act high-risk credit-scoring rules demand
          continuous validation + cryptographic auditability. Sovereign Matrix
          is the only AI agent stack that ships this out of the box.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/contact?vertical=banking"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Talk to a model-risk engineer
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
          Primitives shipped for banking
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {PRIMITIVES.map((p) => (
            <div
              key={p.title}
              className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/15 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <p.icon className="w-5 h-5 text-cyan-400" />
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
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-cyan-400 font-medium">{u.result}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Pre-mapped to bank-examination controls
        </h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {COMPLIANCE.map((c) => (
            <div
              key={c}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05]"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
              <span className="text-xs text-neutral-300">{c}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-cyan-500/15 bg-cyan-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            Continuous validation, not a quarterly fire drill.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Sovereign&rsquo;s drift detector + SOC 2 monitor + audit-bundle
            subscription replace the spreadsheet-stitch your MRMG team is doing
            today. Every model gets a live posture board; every output is
            replayable.
          </p>
          <Link
            href="/contact?vertical=banking"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
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
