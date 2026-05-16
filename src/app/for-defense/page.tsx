import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Lock,
  ShieldCheck,
  Crosshair,
  Activity,
} from "lucide-react";
import type { Metadata } from "next";

/**
 * /for-defense — Tier-1 ICP vertical landing (Cook 76).
 *
 * Hook: FedRAMP High + CMMC L2/L3 + ITAR-controlled-data handling
 * demand cryptographic provenance and air-gapped deployment. The
 * standalone Docker output mode + receipt chain + multi-party
 * attestation lets an integrator drop the stack into a SCIF and
 * produce signed evidence.
 */

export const metadata: Metadata = {
  title:
    "AI for Defense & Federal · CMMC / FedRAMP / ITAR Ready · Sovereign Matrix",
  description:
    "Audit-grade AI for cleared workflows. Standalone Docker deployment, Ed25519 signed receipts, multi-party attestation. Built for SCIFs.",
  alternates: { canonical: "/for-defense" },
};

const PRIMITIVES = [
  {
    icon: Lock,
    title: "Air-gappable deployment",
    desc: 'Sovereign ships a standalone Docker mode (output: "standalone") that runs disconnected. No phone-home telemetry. AI provider routing supports local Ollama as the primary, with NIM / Claude / Gemini as optional BYOK paths.',
  },
  {
    icon: ShieldCheck,
    title: "Cryptographic provenance",
    desc: "Every agent run produces an Ed25519-signed receipt that survives air-gap transfer. Merkle-chained timeline lets an inspector replay months of decisions on-prem.",
  },
  {
    icon: Crosshair,
    title: "Cleared-personnel paperwork",
    desc: "Draft SF-86 supplements, security incident reports, and contract redlines. Output is multi-party-attested by program officer + security manager before delivery.",
  },
  {
    icon: Activity,
    title: "Supply-chain risk reporting",
    desc: "Continuous monitoring with PIN-only access. Tool-registry browser automation (Tier-3, admin-allowlisted) crawls supplier registries with full audit trail.",
  },
  {
    icon: FileText,
    title: "Post-award compliance",
    desc: "Generate FAR / DFARS-clause-tagged compliance memos. Pre-mapped to CMMC L2/L3 practices + NIST 800-171 controls.",
  },
];

const USE_CASES = [
  {
    trigger: '"Draft compliance memos for last quarter\'s contract awards."',
    steps: [
      "Agent ingests award terms + FAR / DFARS clauses.",
      "Composes memo cross-referencing CMMC L2 + NIST 800-171 controls.",
      "Hallucination guard verifies every clause citation.",
      "PM + SecOfficer co-sign via multi-party attestation.",
    ],
    result:
      "Memo + receipts + replay-ready trail. Survives an OIG audit on day one.",
  },
  {
    trigger:
      '"Review the supply-chain risk feed and flag novel UFLPA exposures."',
    steps: [
      "Agent runs scheduled sweep across UFLPA Entity List + CBP enforcement actions.",
      "RAG matches against your supplier graph.",
      "Receipt timeline preserves what was found, when, by whom.",
    ],
    result: "Weekly digest signed by your CSO. Replayable any time DCMA asks.",
  },
  {
    trigger: '"Prep the annual CMMC L2 self-assessment."',
    steps: [
      "Audit-bundle subscription assembles every control evidence file.",
      "SOC 2 indicator collector emits live posture board.",
      "Attestation letter signed by your C3PAO contact + ISSM.",
    ],
    result:
      "L2 self-assessment package + signed attestation. -80% on annual prep.",
  },
];

const COMPLIANCE = [
  "FedRAMP High Baseline",
  "CMMC L2 + L3 — Cybersecurity Maturity Model Certification",
  "NIST SP 800-171 + 800-172",
  "DFARS 252.204-7012 — Safeguarding CUI",
  "ITAR 22 CFR 120-130 + EAR 15 CFR 730-774",
  "FAR 52.204-21 — Basic Safeguarding",
  "Executive Order 14028 — Improving Cybersecurity",
  "NIST AI RMF + EU AI Act high-risk categories",
];

export default function ForDefensePage() {
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
        <p className="text-[10px] uppercase tracking-[0.4em] text-amber-400 mb-4">
          Defense & Federal
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          The only AI agent stack that{" "}
          <span className="text-amber-400">runs in a SCIF.</span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          Standalone Docker mode. Ed25519 signed receipts. Multi-party
          attestation. Pre-mapped to CMMC L2/L3 + NIST 800-171. Built for
          cleared workflows that have to survive an OIG audit.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/contact?vertical=defense"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-colors"
          >
            Talk to our federal team
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
          Primitives shipped for defense
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {PRIMITIVES.map((p) => (
            <div
              key={p.title}
              className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/15 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <p.icon className="w-5 h-5 text-amber-400" />
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
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-400 font-medium">{u.result}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Pre-mapped to federal cybersecurity controls
        </h2>
        <div className="grid sm:grid-cols-2 gap-2">
          {COMPLIANCE.map((c) => (
            <div
              key={c}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05]"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span className="text-xs text-neutral-300">{c}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-amber-500/15 bg-amber-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            Every commercial AI stack phones home.
            <br />
            Sovereign doesn&rsquo;t.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Drop the standalone Docker image into your enclave. Ed25519 signed
            receipts survive air-gap transfer. Multi-party attestation with
            M-of-N quorum lets program office + security + contractor co-sign
            every output. That&rsquo;s the audit signal cleared programs demand.
          </p>
          <Link
            href="/contact?vertical=defense"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-500 text-black font-semibold text-sm hover:bg-amber-400 transition-colors"
          >
            Schedule a federal-team briefing
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
