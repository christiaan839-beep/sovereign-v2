// ISR — vertical pages are static marketing surfaces; regenerate hourly.
export const revalidate = 3600;

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Leaf,
  ShieldCheck,
  LineChart,
  Wind,
} from "lucide-react";
import type { Metadata } from "next";

/**
 * /for-esg — Tier-1 ICP vertical landing (Cook 87).
 *
 * Hook: CSRD + ISSB IFRS S1/S2 + SEC climate rule all demand
 * quarterly attestation + assurance-grade audit trail. Sovereign's
 * climate-scope-calculation rubric + attestation letter +
 * audit-bundle subscription = quarterly disclosure assist.
 */

export const metadata: Metadata = {
  title:
    "AI for ESG & Climate Disclosure · CSRD / ISSB / SEC Ready · Sovereign Matrix",
  description:
    "AI for Scope 1-3 narratives, CSRD assurance, ISSB IFRS S1/S2. Audit-grade receipts, replayable methodologies, attestation letters.",
  alternates: { canonical: "/for-esg" },
};

const PRIMITIVES = [
  {
    icon: Leaf,
    title: "Climate-scope-calculation rubric",
    desc: "Expert-critic rubric specifically tuned for Scope 1-3 boundary errors, double-counting, and emission-factor mismatches. Ships in the core platform.",
  },
  {
    icon: LineChart,
    title: "Replayable methodology",
    desc: "Every disclosure narrative cites the specific emission factor + activity data + boundary assumption. Hallucination detector flags any unsupported claim. Drift detector compares year-over-year for restatement risk.",
  },
  {
    icon: ShieldCheck,
    title: "Assurance-ready audit trail",
    desc: "Big-4 assurance providers can paste a receipt id and reproduce the exact emission calculation as it was at the time of issuance. That's the audit signal IFRS S2 + CSRD limited-assurance demand.",
  },
  {
    icon: Wind,
    title: "Quarterly attestation letter",
    desc: "Auto-generated PDF signed by Sustainability Officer + CFO. Maps directly to CSRD Article 19a + ISSB IFRS S2.30. Audit-bundle subscription delivers monthly to your reporting team.",
  },
  {
    icon: FileText,
    title: "TCFD + SEC climate-rule mapping",
    desc: "Pre-mapped controls library. Every output cites which TCFD pillar / SEC paragraph it supports — board-pack ready.",
  },
];

const USE_CASES = [
  {
    trigger:
      '"Draft the Scope 3 Category 11 (use of sold products) narrative for the annual report."',
    steps: [
      "Agent ingests product-mix + sold-unit data + emission factors.",
      "Composes narrative citing GHG Protocol + product lifecycle factors.",
      "Climate-scope-calculation rubric flags double-counting across Cat 11 and Cat 12.",
      "Sustainability Officer + Group Controller co-sign via multi-party attestation.",
    ],
    result:
      "Scope 3 narrative + cited factor map + signed receipt. Assurance prep -75%.",
  },
  {
    trigger: '"Restate prior-year baseline after the methodology update."',
    steps: [
      "Drift detector flags the methodology change vs prior baseline.",
      "Agent composes restatement narrative + reconciliation table.",
      "Hallucination detector verifies every cited factor maps to the updated GHG protocol.",
    ],
    result: "Restatement narrative + audit-traceable methodology change log.",
  },
  {
    trigger: '"Prep the Q3 CSRD limited-assurance evidence bundle."',
    steps: [
      "Audit-bundle subscription assembles every disclosure narrative in scope.",
      "SOC 2 indicator collector emits live data-quality posture.",
      "Quarterly attestation letter signed by Sustainability Officer + CFO.",
    ],
    result: "CSRD bundle delivered to the auditor before they ask.",
  },
];

const COMPLIANCE = [
  "EU CSRD — Corporate Sustainability Reporting Directive",
  "ISSB IFRS S1/S2 — Climate-related Disclosures",
  "SEC Climate Disclosure Rule (2024)",
  "TCFD — Task Force on Climate-related Financial Disclosures",
  "GHG Protocol — Scope 1, 2, 3 Standards",
  "CDP Climate Change Questionnaire",
  "EU Taxonomy Regulation",
  "SOC 2 readiness controls — continuous monitoring (audit-ready posture; formal Type 2 attestation in progress)",
];

export default function ForEsgPage() {
  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#030303]/80 backdrop-blur-xl sticky top-0 z-50">
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
              className="text-xs px-4 py-2 rounded-[3px] bg-white/[0.04] border border-white/[0.08] font-medium text-neutral-300 hover:bg-white/[0.07] hover:text-white transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <header className="max-w-6xl mx-auto px-6 pt-20 pb-12">
        <p className="text-[10px] uppercase tracking-[0.4em] text-teal-400 mb-4">
          ESG & Climate Disclosure
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          The only AI assurance{" "}
          <span className="text-teal-400">your Big-4 reviewer can replay.</span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          CSRD + ISSB IFRS S2 + SEC climate rule all demand the same: cited
          emission factors + reproducible methodology + signed attestation.
          Sovereign ships the rubric, the receipts, and the quarterly letter —
          out-of-box.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/contact?vertical=esg"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-teal-500 text-black font-semibold text-sm hover:bg-teal-400 transition-colors"
          >
            Talk to a sustainability engineer
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
          Primitives shipped for ESG
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {PRIMITIVES.map((p) => (
            <div
              key={p.title}
              className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/15 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <p.icon className="w-5 h-5 text-teal-400" />
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
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-teal-400 font-medium">{u.result}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Pre-mapped to disclosure frameworks
        </h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {COMPLIANCE.map((c) => (
            <div
              key={c}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05]"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shrink-0" />
              <span className="text-xs text-neutral-300">{c}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-teal-500/15 bg-teal-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            Limited assurance shouldn&rsquo;t mean unlimited spreadsheet.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Big-4 ESG assurance teams price every restatement. Sovereign ships
            the cited methodology + replayable receipt + drift log in one
            package — so the auditor signs off the first time, not after three
            rounds of follow-up tickets.
          </p>
          <Link
            href="/contact?vertical=esg"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-teal-500 text-black font-semibold text-sm hover:bg-teal-400 transition-colors"
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
