// ISR — vertical pages are static marketing surfaces; regenerate hourly.
export const revalidate = 3600;

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Stethoscope,
  ShieldCheck,
  Activity,
  Eye,
} from "lucide-react";
import type { Metadata } from "next";

/**
 * /for-prior-auth — Tier-1 ICP vertical landing (Cook 86).
 *
 * Hook: $25B/yr US prior-auth admin spend. HIPAA + 42 CFR Part 2 +
 * NCQA UM standards demand reproducible AI decisions. Selective
 * disclosure (Cook 12) lets a payer share ONE field of an AI prior
 * auth decision with a state regulator without exposing the rest of
 * the patient file.
 */

export const metadata: Metadata = {
  title:
    "AI for Prior Auth · HIPAA-Defensible · Replayable Decisions · Sovereign Matrix",
  description:
    "AI for prior authorization, claims appeals, and utilization management. Selective disclosure, replayable receipts, NCQA + HIPAA defensible.",
  alternates: { canonical: "/for-prior-auth" },
};

const PRIMITIVES = [
  {
    icon: ShieldCheck,
    title: "HIPAA-defensible by default",
    desc: "PHI never reaches a third-party LLM. Layer-3 PII scanner runs before any model call. Every decision produces a signed receipt that survives a HIPAA audit.",
  },
  {
    icon: Eye,
    title: "Selective-disclosure decisions",
    desc: "Reveal the AI's verdict (approve / deny / pend) to a state regulator without revealing the rest of the patient file. Merkle-proof inclusion proofs make this cryptographic — not policy-based.",
  },
  {
    icon: Stethoscope,
    title: "Medical-policy citation grounded",
    desc: "Every decision cites the specific medical-policy section + clinical guideline. Hallucination detector ensures every cited reference exists. Bias auditor flags decisions skewed by demographics.",
  },
  {
    icon: Activity,
    title: "Continuous NCQA + URAC posture",
    desc: "SOC 2 indicator collector tracks decision pass-rate, MTTR on denials, drift on policy updates. Quarterly attestation letter signed by Medical Director.",
  },
  {
    icon: FileText,
    title: "Appeal-letter drafting",
    desc: "When a denial is overturned on appeal, the agent drafts the response letter citing the original clinical evidence + updated guidelines. Multi-party attestation: UM nurse + Medical Director co-sign.",
  },
];

const USE_CASES = [
  {
    trigger:
      '"Triage the morning prior-auth queue for the new orthopedic codes."',
    steps: [
      "Agent ingests today's PA queue, ranks by urgency.",
      "RAG retrieves the specific medical-policy section + InterQual / MCG criteria.",
      "Composes approve / deny / pend recommendation with cited evidence.",
      "Decisions below 0.85 confidence escalate to a clinician for review.",
    ],
    result:
      "Auto-decision rate 60%+ with audit trail. UM nurse review time -70%.",
  },
  {
    trigger: '"Draft an appeal-response letter for the denied surgery case."',
    steps: [
      "Agent pulls the original decision, member chart, and updated guidelines.",
      "Composes a response letter citing specific clinical evidence.",
      "Bias auditor verifies no demographic skew in language.",
      "UM Medical Director co-signs via multi-party attestation.",
    ],
    result:
      "Appeal letter + cited evidence map + signed receipt. SLA compliance -50% turnaround.",
  },
  {
    trigger: '"Prep the NCQA UM accreditation evidence packet."',
    steps: [
      "Audit-bundle subscription assembles every UM decision in scope.",
      "SOC 2 monitor emits live decision-pass-rate + drift posture.",
      "Quarterly attestation letter signed by Medical Director.",
    ],
    result: "NCQA evidence packet delivered to the surveyor before they ask.",
  },
];

const COMPLIANCE = [
  "HIPAA Privacy + Security Rule",
  "42 CFR Part 2 — substance-use disorder records",
  "NCQA UM 1-13 — Utilization Management standards",
  "URAC UM Standards",
  "CMS Final Rule on Prior Authorization (2024)",
  "Texas SB 1086 / California SB 1120 — AI in claims",
  "EU AI Act Annex III — High-Risk Healthcare",
  "SOC 2 readiness controls — continuous monitoring (audit-ready posture; formal Type 2 attestation in progress)",
];

export default function ForPriorAuthPage() {
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
        <p className="text-[10px] uppercase tracking-[0.4em] text-pink-400 mb-4">
          Prior Auth & UM
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          $25B/yr in admin cost.{" "}
          <span className="text-pink-400">Replayable AI decisions.</span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          The CMS Final Rule + NCQA UM standards + state AI-in-claims laws all
          demand the same evidence: cited medical policy + replayable trail +
          bias score per decision. Sovereign Matrix ships this out-of-box,
          HIPAA-defensible by default.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/contact?vertical=prior-auth"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-pink-500 text-black font-semibold text-sm hover:bg-pink-400 transition-colors"
          >
            Talk to a UM clinical lead
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
          Primitives shipped for prior auth
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {PRIMITIVES.map((p) => (
            <div
              key={p.title}
              className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/15 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <p.icon className="w-5 h-5 text-pink-400" />
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
                    <CheckCircle2 className="w-3.5 h-3.5 text-pink-400 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-pink-400 font-medium">{u.result}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Pre-mapped to payer + state controls
        </h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {COMPLIANCE.map((c) => (
            <div
              key={c}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05]"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-pink-400 shrink-0" />
              <span className="text-xs text-neutral-300">{c}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-pink-500/15 bg-pink-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            One field to the regulator. Zero leakage.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Selective disclosure (Cook 12) is the unlock. A state attorney
            general asks &ldquo;show me how you decided this denial&rdquo; —
            Sovereign reveals the verdict + cited policy section,
            cryptographically sealed, without exposing the rest of the member
            file. That&rsquo;s the audit posture HIPAA + 42 CFR Part 2 were
            waiting for.
          </p>
          <Link
            href="/contact?vertical=prior-auth"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-pink-500 text-black font-semibold text-sm hover:bg-pink-400 transition-colors"
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
