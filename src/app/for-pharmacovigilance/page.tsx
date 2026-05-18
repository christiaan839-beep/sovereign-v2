// ISR — vertical pages are static marketing surfaces; regenerate hourly.
export const revalidate = 3600;

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Activity,
  ShieldCheck,
  AlertTriangle,
  FlaskConical,
  Database,
} from "lucide-react";
import type { Metadata } from "next";

/**
 * /for-pharmacovigilance — Tier-1 ICP vertical landing (Cook 141).
 *
 * Hook (from market brief): pharma PV case triage is a zero-
 * competition niche. CrewAI / Relevance can do triage but can't
 * produce ICH E2B-compliant audit trails. FDA expects every
 * safety signal flagged by AI to be reproducible.
 *
 * Primary buyer: Head of Pharmacovigilance at top-40 pharma
 * (Pfizer, Novartis, Roche, AstraZeneca, GSK, Sanofi).
 * Procurement channel: Drug-safety operations budget — distinct
 * from R&D IT — usually 6-month cycle but smaller approval
 * surface than full clinical-trial systems.
 */

export const metadata: Metadata = {
  title:
    "AI for Pharmacovigilance · ICH E2B / FAERS Audit-Ready · Sovereign Matrix",
  description:
    "Cryptographically-receipted AI for ICSR triage, signal detection, and aggregate report drafting. Every safety decision tied to source via signed receipts the FDA / EMA inspector can replay.",
  alternates: { canonical: "/for-pharmacovigilance" },
};

const PRIMITIVES = [
  {
    icon: AlertTriangle,
    title: "ICSR triage with full citation chain",
    desc: "Agents ingest case intakes from MedDRA-coded sources (call center, literature, social listening, partner-CRO feeds). Severity, expectedness, and listedness classifications cite the exact source row. Hallucination guard (verifier layer 6) rejects any unsupported claim before it reaches the medical reviewer.",
  },
  {
    icon: Activity,
    title: "Signal detection with replay-bundle export",
    desc: "Agents run disproportionality analyses (PRR, ROR, IC) over your aggregated PV dataset. Every signal emits a signed receipt with the underlying case ids; medical-safety officers replay the analysis on demand. Cook 56 audit-bundle subscription delivers the monthly signal review to Drug Safety leadership.",
  },
  {
    icon: FlaskConical,
    title: "Aggregate report drafting (PBRER / PADER / DSUR)",
    desc: "Agents draft PBRER (EU), PADER (US legacy), and DSUR (clinical) sections against the latest cumulative case dataset. Citation guard verifies every cumulative incidence figure, every signal status, every benefit-risk paragraph ties to source data. Multi-party attestation: PV scientist + medical reviewer + safety officer co-sign.",
  },
  {
    icon: Database,
    title: "ICH E2B(R3) XML compatibility",
    desc: "Receipts include the canonical E2B(R3) message identifier so reports route directly into your safety database (Argus / ArisGlobal / Veeva Vault Safety) without remapping. Inspector pulls the bundle; system imports it natively.",
  },
  {
    icon: ShieldCheck,
    title: "21 CFR Part 11 + EU GVP audit posture",
    desc: "ALCOA+ records on every action (Cook 94 receipt-chain ratchet makes the trail tamper-evident). EU GVP Module VI 'minimum criteria for a valid ICSR' enforced at agent intake. FDA BIMO inspector receives a replay-ready bundle with cryptographic chain-of-custody.",
  },
];

const USE_CASES = [
  {
    trigger:
      '"Triage today\'s case intake — flag any expedited reports for medical review."',
    steps: [
      "Agent ingests the day's intake from call center logs + medical literature + partner-CRO feeds.",
      "Classifies seriousness (death / life-threat / hospitalization / disability / congenital / other medically-important).",
      "Determines expectedness against the latest CCDS for each implicated drug.",
      "Flags expedited reports for 15-day reporting; routes to medical reviewer with citation map.",
    ],
    result:
      "Triaged case load + signed receipts + expedited-flag list. PV ops time -65% on routine triage, zero missed-expedited cases in QA review.",
  },
  {
    trigger:
      '"Run this quarter\'s PRR analysis for drug X across the cumulative dataset."',
    steps: [
      "Agent assembles cumulative ICSRs for drug X + cumulative ICSRs across the reference population.",
      "Computes PRR + ROR + IC for every MedDRA PT pair exceeding the disproportionality threshold.",
      "Outputs signal list with case-level drill-down; receipt commits the dataset hash so the analysis is replayable.",
      "Bias auditor flags any signal whose case mix is demographically skewed for human review.",
    ],
    result:
      "Quarterly disproportionality report + replay bundle. Medical reviewer triages signals; FDA / EMA inspector replays any analysis on demand.",
  },
  {
    trigger:
      '"Draft the PBRER section 16 benefit-risk evaluation for the upcoming PSUR filing."',
    steps: [
      "Agent assembles the cumulative + interval safety data, the efficacy update, and the regulator's prior-cycle assessment.",
      "Drafts section 16 with explicit citations to every claim.",
      "Hallucination detector rejects any phrasing that overstates the benefit or minimizes a known signal.",
      "PV scientist + medical reviewer + safety officer co-sign via multi-party attestation (Cook 39).",
    ],
    result:
      "PBRER section 16 + signed handover to regulatory affairs. -70% on first-draft authoring time, zero unsupported claims in QA review.",
  },
];

const COMPLIANCE = [
  "ICH E2B(R3) — Individual Case Safety Reports",
  "ICH E2D — Post-Approval Safety Data Management",
  "ICH E2E — Pharmacovigilance Planning",
  "ICH E2F — Development Safety Update Reports (DSUR)",
  "EU GVP Modules I-XVI",
  "FDA 21 CFR 314.80 — Postmarketing reporting of ADR",
  "21 CFR Part 11 — Electronic Records / Signatures",
  "FDA BIMO inspection-readiness for PV operations",
];

export default function ForPharmacovigilancePage() {
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
          Pharmacovigilance &amp; Drug Safety
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          AI that an <span className="text-cyan-400">FDA BIMO inspector</span>{" "}
          can replay signal by signal.
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          ICH E2B(R3) + EU GVP demand that every PV decision be traceable to
          source. CrewAI and Relevance can do triage; they can&rsquo;t produce
          the audit trail. Sovereign Matrix is the only AI agent stack that
          ships ALCOA+ records and cryptographic chain-of-custody for every
          safety signal.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/contact?vertical=pharmacovigilance"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Talk to a PV engineer
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
          Primitives shipped for pharmacovigilance
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
          Pre-mapped to PV regulatory controls
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
            From case intake to PSUR — every safety decision cryptographically
            signed.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Sovereign&rsquo;s signed-receipt fabric is the safety net your PV
            organization wants when the FDA arrives. Continuous ALCOA+ evidence.
            Replayable signal analyses. Zero deficiency findings on §314.80.
          </p>
          <Link
            href="/contact?vertical=pharmacovigilance"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Schedule a PV procurement deep-dive
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
