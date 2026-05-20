// ISR — vertical pages are static marketing surfaces; regenerate hourly.
export const revalidate = 3600;

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Scale,
  ShieldCheck,
  Lock,
  Briefcase,
} from "lucide-react";
import type { Metadata } from "next";

/**
 * /for-legal-services — Tier-1 ICP vertical landing (Cook 85).
 *
 * Hook: ABA Model Rule 1.6 + work-product doctrine + e-discovery
 * audit trail. Selective disclosure (Cook 12), multi-party
 * attestation (Cook 11), and audit-bundle subscription (Cook 18)
 * answer "how do you prove what your AI did privileged review of?"
 */

export const metadata: Metadata = {
  title:
    "AI for Legal Services · Privilege-Aware · Audit-Trail Ready · Sovereign Matrix",
  description:
    "AI for paralegal review, e-discovery first-pass, contract redline, conflict checks. Privilege-aware redaction, selective disclosure, ABA 1.6 defensible.",
  alternates: { canonical: "/for-legal-services" },
};

const PRIMITIVES = [
  {
    icon: Lock,
    title: "Privilege-aware PII redaction",
    desc: "Layer-3 PII scanner integrates a legal-privilege filter before any model call. Attorney work product never reaches a third-party LLM.",
  },
  {
    icon: Scale,
    title: "Selective disclosure for discovery",
    desc: "Merkle-proof selective disclosure lets you reveal one field of a privileged review (e.g. responsiveness verdict) without revealing the rest of the document set. Defensible against motions to compel.",
  },
  {
    icon: Briefcase,
    title: "Contract redline + clause libraries",
    desc: "Agents compose redlines that cite specific clauses from your firm's playbook. Bias auditor flags any one-sided allocation. Multi-party attestation lets associate + partner co-sign.",
  },
  {
    icon: ShieldCheck,
    title: "Conflict checks + intake",
    desc: "Automated party + matter cross-referencing against your conflicts database. Receipt timeline preserves what was checked, when, by whom — bar-grade audit trail.",
  },
  {
    icon: FileText,
    title: "E-discovery first-pass",
    desc: "RAG over your document corpus. Hallucination detector ensures every responsiveness call cites the source page. Drift detector flags reviewers (or models) that diverge from prior calls.",
  },
];

const USE_CASES = [
  {
    trigger: '"Run a first-pass responsiveness call on the new 80K doc batch."',
    steps: [
      "Agent batches the document set with rolling 30-doc context.",
      "Per-document responsiveness call cites the specific clause / page.",
      "Hallucination detector verifies every citation maps to a real page.",
      "Privileged docs auto-flagged via the privilege filter; reviewer escalates.",
    ],
    result:
      "First-pass review done in 4 hours instead of 4 days. Bar-defensible audit trail per call.",
  },
  {
    trigger: '"Redline the master services agreement for the new SaaS client."',
    steps: [
      "Agent pulls firm-standard MSA template + the proposed redlines.",
      "Composes counter-redlines citing your firm's playbook clauses.",
      "Bias auditor flags any heavily one-sided allocations.",
      "Associate + partner co-sign via multi-party attestation.",
    ],
    result:
      "Redline + signed receipt + replay-ready audit. Senior associate review time -70%.",
  },
  {
    trigger: '"Run conflict check for the prospective engagement."',
    steps: [
      "Agent cross-references party + entity list against conflicts DB.",
      "Selective disclosure reveals only the conflict verdict to general counsel.",
      "Bar audit-bundle subscription auto-emails the trace to risk management.",
    ],
    result:
      "Conflict cleared (or flagged) in 90 seconds. Trace replayable any time bar counsel asks.",
  },
];

const COMPLIANCE = [
  "ABA Model Rule 1.6 — Confidentiality of Information",
  "ABA Model Rule 1.7-1.9 — Conflicts of Interest",
  "Work Product Doctrine — FRCP 26(b)(3)",
  "Attorney-Client Privilege",
  "EU GDPR Art. 9 — special-category data",
  "EU AI Act Annex III — High-Risk AI in justice",
  "SRA Code of Conduct (UK)",
  "SOC 2 readiness controls — continuous monitoring (audit-ready posture; formal Type 2 attestation in progress)",
];

export default function ForLegalServicesPage() {
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
        <p className="text-[10px] uppercase tracking-[0.4em] text-indigo-400 mb-4">
          Legal Services
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          Privilege-aware AI{" "}
          <span className="text-indigo-400">
            your bar counsel signs off on.
          </span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          ABA 1.6, work-product doctrine, and state-bar AI bulletins all demand
          the same: provable privilege protection + replayable audit trail.
          Sovereign Matrix ships both as primitives — not features.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/contact?vertical=legal"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-500 text-black font-semibold text-sm hover:bg-indigo-400 transition-colors"
          >
            Talk to our legal-tech team
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
          Primitives shipped for legal
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {PRIMITIVES.map((p) => (
            <div
              key={p.title}
              className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/15 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <p.icon className="w-5 h-5 text-indigo-400" />
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
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-indigo-400 font-medium">{u.result}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Pre-mapped to bar + court controls
        </h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {COMPLIANCE.map((c) => (
            <div
              key={c}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05]"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
              <span className="text-xs text-neutral-300">{c}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-indigo-500/15 bg-indigo-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            Privilege isn&rsquo;t a setting. It&rsquo;s the architecture.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Every other AI tool ships &ldquo;we don&rsquo;t train on your
            data&rdquo; as a checkbox. Sovereign ships it as a Merkle proof.
            Reveal the verdict to opposing counsel without revealing the work
            product. That&rsquo;s the discovery posture every modern general
            counsel is asking for.
          </p>
          <Link
            href="/contact?vertical=legal"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-indigo-500 text-black font-semibold text-sm hover:bg-indigo-400 transition-colors"
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
