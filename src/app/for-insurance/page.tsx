// ISR — vertical pages are static marketing surfaces; regenerate hourly.
export const revalidate = 3600;

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Scale,
  ShieldCheck,
  Umbrella,
  Activity,
} from "lucide-react";
import type { Metadata } from "next";

/**
 * /for-insurance — Tier-1 ICP vertical landing (Cook 76).
 *
 * Hook: NAIC AI Model Bulletin + Colorado SB21-169 + EU AIDA all
 * demand bias audits + algorithmic accountability + adverse-action
 * notices. Bias auditor (Cook 15), hallucination detector (Cook 14),
 * and attestation letter (Cook 33) answer head-on.
 */

export const metadata: Metadata = {
  title: "AI for Insurance · NAIC Bulletin / EU AIDA Ready · Sovereign Matrix",
  description:
    "Audit-grade AI for underwriting narratives, claims triage, complaint handling. Continuous bias monitoring + cryptographic adverse-action notices.",
  alternates: { canonical: "/for-insurance" },
};

const PRIMITIVES = [
  {
    icon: ShieldCheck,
    title: "NAIC AI Bulletin defensibility",
    desc: "Every underwriting + claims AI output is signed, replayable, and accompanied by a bias-audit score. Sovereign's audit-bundle subscription auto-delivers quarterly evidence to your DOI examiner.",
  },
  {
    icon: Scale,
    title: "Built-in bias auditor",
    desc: "Verifier layer scores every output across gendered language, stereotyping, absolutist claims, demographic exclusion. Outputs that breach the threshold escalate to a human reviewer automatically.",
  },
  {
    icon: Umbrella,
    title: "Underwriting narrative drafting",
    desc: "Compose risk-acceptance + risk-decline narratives that cite specific underwriting rules + customer documents. Hallucination guard ensures every claim has a source.",
  },
  {
    icon: Activity,
    title: "Claims triage explanations",
    desc: "Generate explainable triage decisions for first-notice-of-loss. Multi-party attestation lets claims handler + supervisor co-sign before delivery to the policyholder.",
  },
  {
    icon: FileText,
    title: "Complaint handling correspondence",
    desc: "Draft responses to state-DOI complaints. Pre-mapped templates for Colorado, NY, CA. Selective disclosure lets you share specific decision factors without exposing the full case file.",
  },
];

const USE_CASES = [
  {
    trigger:
      '"Generate adverse-action notices for yesterday\'s declined applications."',
    steps: [
      "Agent pulls denied apps + underwriting decisioning factors.",
      "Composes adverse-action notices citing specific risk factors + ECOA reason codes.",
      "Bias auditor flags any demographically-skewed language before delivery.",
      "Supervisor co-signs via multi-party attestation.",
    ],
    result:
      "Notices + signed receipts + replay-ready trail. -85% on adverse-action processing, zero NAIC bulletin exceptions.",
  },
  {
    trigger: '"Triage the morning FNOL queue and draft initial reserves."',
    steps: [
      "Agent ingests FNOL queue, ranks by severity + complexity.",
      "RAG pulls policy terms, prior claims history, and similar settled claims.",
      "Drafts reserve recommendation with cited evidence.",
      "Flag any case where bias score breaches tolerance.",
    ],
    result:
      "Triaged + reserved queue + cited evidence map. Claims handler time -65%.",
  },
  {
    trigger: '"Prep Q3 audit-bundle for the Colorado DOI exam."',
    steps: [
      "Audit-bundle subscription assembles all decisions in scope.",
      "Bias-audit summary + drift report + receipt timeline composed.",
      "Quarterly attestation letter signed by compliance + chief actuary.",
    ],
    result: "Audit-bundle delivered to DOI examiner before they ask for it.",
  },
];

const COMPLIANCE = [
  "NAIC AI Model Bulletin (2023)",
  "Colorado SB21-169 — Algorithmic Insurance Practices",
  "California SB 1120 — AI in claims decisioning",
  "NY DFS Circular Letter No. 7 (2024)",
  "EU AI Liability Directive (AILD)",
  "EU AI Act Annex III — High-Risk Insurance Use",
  "GDPR Art. 22 — Automated Decision-Making",
  "SOC 2 readiness controls — continuous monitoring (audit-ready posture; formal Type 2 attestation in progress)",
];

export default function ForInsurancePage() {
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
        <p className="text-[10px] uppercase tracking-[0.4em] text-violet-400 mb-4">
          Insurance — Underwriting & Claims
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          Prove your AI{" "}
          <span className="text-violet-400">isn&rsquo;t discriminating.</span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          The NAIC bulletin, Colorado SB21-169, and EU AIDA all demand the same
          evidence: bias scores per decision + replayable audit trail + signed
          adverse-action notices. Sovereign Matrix ships this out-of-box.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/contact?vertical=insurance"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-violet-500 text-black font-semibold text-sm hover:bg-violet-400 transition-colors"
          >
            Talk to an actuary on our team
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
          Primitives shipped for insurance
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {PRIMITIVES.map((p) => (
            <div
              key={p.title}
              className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/15 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <p.icon className="w-5 h-5 text-violet-400" />
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
                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-violet-400 font-medium">{u.result}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Pre-mapped to DOI + EU AIDA controls
        </h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {COMPLIANCE.map((c) => (
            <div
              key={c}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05]"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
              <span className="text-xs text-neutral-300">{c}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-violet-500/15 bg-violet-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            The bulletin doesn&rsquo;t care if your AI is accurate.
            <br />
            It cares if you can prove it.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Sovereign Matrix is the only stack that produces bias scores
            per-decision + a cryptographic receipt your examiner can replay.
            Every other AI tool generates the decision; we generate the
            evidence.
          </p>
          <Link
            href="/contact?vertical=insurance"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-violet-500 text-black font-semibold text-sm hover:bg-violet-400 transition-colors"
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
