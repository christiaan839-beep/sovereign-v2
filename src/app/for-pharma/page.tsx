// ISR — vertical pages are static marketing surfaces; regenerate hourly.
export const revalidate = 3600;

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Microscope,
  ShieldCheck,
  Stethoscope,
  Workflow,
} from "lucide-react";
import type { Metadata } from "next";

/**
 * /for-pharma — Tier-1 ICP vertical landing (Cook 69).
 *
 * Hook: Sovereign Matrix is the only AI agent platform that ships
 * 21 CFR Part 11–defensible receipts out of the box. Pharma teams
 * can use any of the 140 agents to draft, review, and route
 * GxP-relevant documents — and every output produces a
 * cryptographically signed receipt that an FDA or EMA inspector
 * can paste back into our replay endpoint to verify on demand.
 */

export const metadata: Metadata = {
  title:
    "AI for Pharma & Life Sciences · 21 CFR Part 11–Grade Receipts · Sovereign Matrix",
  description:
    "The only AI agent stack with cryptographically reproducible outputs. Built for GxP, FDA 21 CFR Part 11, EU Annex 11, and EMA AI guidance. Clinical operations, regulatory, pharmacovigilance.",
  alternates: { canonical: "/for-pharma" },
};

const PRIMITIVES = [
  {
    icon: ShieldCheck,
    title: "21 CFR Part 11 e-record receipts",
    desc: "Every agent run produces an HMAC + Ed25519 signed receipt with a Merkle-chained audit trail. Selective disclosure lets you reveal one field (e.g. final verdict) to an inspector without exposing the rest of the patient record.",
  },
  {
    icon: Microscope,
    title: "Protocol-deviation rubric (pre-built)",
    desc: "An expert-critic rubric specifically tuned for ICH-GCP protocol deviations ships in the core library. The critic flags blockers (eligibility violations, dosing errors, IB version mismatches) before any output reaches a CRA's desk.",
  },
  {
    icon: Stethoscope,
    title: "Multi-party attestation",
    desc: "Sign each output with sponsor + CRO + investigator HMACs. M-of-N quorum policies. Cross-witness forgery is cryptographically impossible. Strongest possible audit signal for monitoring visits.",
  },
  {
    icon: FileText,
    title: "Hallucination + citation guard",
    desc: "Verifier layer 6 scores every claim sentence-by-sentence against supplied source documents. Hallucinated citations are dropped; ungrounded sentences are flagged before delivery.",
  },
  {
    icon: Workflow,
    title: "Pre-mapped to EU AI Act + NIST AI RMF + ISO 42001",
    desc: "Every Annex IV control is mapped to a Sovereign capability with audit-ready evidence text. Quarterly attestation letters auto-generate as signed PDFs your CMC + regulatory team can sign and submit.",
  },
];

const USE_CASES = [
  {
    trigger:
      '"Draft a Type C meeting briefing book section on our new bioequivalence design."',
    steps: [
      "Agent pulls the latest protocol draft + prior Type B meeting minutes from the trial workspace.",
      "Generates the section against the FDA briefing-book template.",
      "Expert-critic checks for protocol-deviation risk + missing comparator justification.",
      "Multi-party attestation: sponsor regulatory lead + CMC head co-sign before submission.",
    ],
    result:
      "Briefing-book section + signed receipt + replay-ready audit trail. What took 14 days takes 36 hours.",
  },
  {
    trigger:
      '"Review yesterday\'s pharmacovigilance signals and draft DSURs sections."',
    steps: [
      "Agent ingests the case-narrative batch from your safety database (E2B R3 import).",
      "Hallucination detector cross-checks every causality claim against the underlying narratives.",
      "Bias auditor flags any demographic-skewed signal language.",
      "Output is co-signed by safety physician + qualified person for pharmacovigilance.",
    ],
    result:
      "Draft DSUR section + cited evidence map + signed attestation. Reviewer time -70%.",
  },
  {
    trigger:
      '"Run a regulatory-intelligence sweep for FDA letters citing our class of compounds."',
    steps: [
      "Browser-automation agent (Tier-3, admin-only) crawls FDA warning-letter index.",
      "RAG retrieves matched letters by therapeutic-area code + INN.",
      "Receipt timeline view shows what was found, when, and by whom — replay-ready.",
    ],
    result:
      "Weekly digest with full provenance. Replayable any time a regulator asks 'how did you know?'",
  },
];

const COMPLIANCE = [
  "FDA 21 CFR Part 11 — electronic records + electronic signatures",
  "EU Annex 11 — computerised systems",
  "ICH E6 (R3) GCP — investigator + sponsor obligations",
  "ICH E9 (R1) — estimands + sensitivity analyses",
  "EMA Reflection Paper on AI in Lifecycle (2024)",
  "FDA AI/ML Action Plan + Good Machine Learning Practice",
  "EU AI Act Annex IV — technical documentation",
  "ISO/IEC 42001 — AI management system",
];

export default function ForPharmaPage() {
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

      {/* Hero */}
      <header className="max-w-6xl mx-auto px-6 pt-20 pb-12">
        <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-400 mb-4">
          Pharma & Life Sciences
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          The only AI agent stack a regulator can{" "}
          <span className="text-emerald-400">replay.</span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          Built for clinical operations, regulatory affairs, and
          pharmacovigilance teams that need cryptographically reproducible
          outputs. Every Sovereign agent produces a 21 CFR Part 11–grade receipt
          with multi-party attestation and on-demand replay.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/contact?vertical=pharma"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors"
          >
            Talk to a regulatory engineer
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

      {/* Primitives */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Primitives shipped for pharma
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {PRIMITIVES.map((p) => (
            <div
              key={p.title}
              className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/15 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <p.icon className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">{p.title}</h3>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
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
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-emerald-400 font-medium">{u.result}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Compliance */}
      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Pre-mapped to the controls your QA will ask about
        </h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {COMPLIANCE.map((c) => (
            <div
              key={c}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05]"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="text-xs text-neutral-300">{c}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-emerald-500/15 bg-emerald-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            &ldquo;Where&rsquo;s the cryptographic evidence?&rdquo;
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Every other AI platform stops at &ldquo;explainable.&rdquo;
            Sovereign Matrix answers with on-demand cryptographic
            reproducibility. A regulator pastes a receipt id — Sovereign re-runs
            the same input through the same agent and reports whether the output
            drifted. That&rsquo;s the audit signal pharma&rsquo;s been waiting
            for.
          </p>
          <Link
            href="/contact?vertical=pharma"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-emerald-500 text-black font-semibold text-sm hover:bg-emerald-400 transition-colors"
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
          <Link href="/changelog" className="hover:text-neutral-300">
            Changelog
          </Link>
        </div>
      </footer>
    </div>
  );
}
