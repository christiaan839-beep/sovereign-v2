// ISR — vertical pages are static marketing surfaces; regenerate hourly.
export const revalidate = 3600;

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Zap,
  Network,
  ShieldCheck,
  Leaf,
  Activity,
} from "lucide-react";
import type { Metadata } from "next";

/**
 * /for-utilities — Tier-1 ICP vertical landing (Cook 134).
 *
 * Hook: NERC CIP demands signed evidence of every change touching
 * bulk-electric assets. EU CSRD/ESRS demands auditor-grade Scope 1-3
 * disclosure. Sovereign's signed-receipt + audit-bundle + drift
 * detector ship both posture boards out of the box.
 */

export const metadata: Metadata = {
  title: "AI for Utilities · NERC CIP + EU CSRD Ready · Sovereign Matrix",
  description:
    "Audit-grade AI for grid-operations narratives, NERC CIP change-control evidence, and CSRD/ESRS sustainability reporting. Every decision cryptographically signed and replayable.",
  alternates: { canonical: "/for-utilities" },
};

const PRIMITIVES = [
  {
    icon: ShieldCheck,
    title: "NERC CIP-007 + CIP-010 change-control evidence",
    desc: "Every agent action touching BES Cyber Systems produces a signed receipt with timestamp, operator, and replay bundle. Internal audit + the Regional Entity can verify cryptographically — no spreadsheet stitching at the audit.",
  },
  {
    icon: Leaf,
    title: "EU CSRD / ESRS auditor-grade disclosure",
    desc: "Scope 1-3 emissions narratives, double-materiality assessments, and ESRS E1-S4 disclosures composed against your source data. Citation guard means every kilowatt-hour ties back to a metered file.",
  },
  {
    icon: Network,
    title: "Outage post-mortem automation",
    desc: "Receipt timeline reconstructs every SCADA alert, every operator action, every dispatch decision in chronological order. The investigator gets a replay bundle instead of a 90-day Slack archive.",
  },
  {
    icon: Activity,
    title: "Demand-response + market-bid drafting",
    desc: "Agents draft ISO/RTO market bids with the citation guard verifying that every assumption ties back to a recent forecast, a real plant capability, or a contracted hedge. Multi-party attestation for desk-head + risk-officer co-sign.",
  },
  {
    icon: Zap,
    title: "Storm-response situational reporting",
    desc: "During a major event, receipt-chain ratchet (Cook 94) guarantees the public-facing storm-progress reports cannot be retroactively rewritten. Regulators + media + customers see the same tamper-evident timeline.",
  },
];

const USE_CASES = [
  {
    trigger:
      '"Generate the quarterly NERC CIP-010 change-control evidence package."',
    steps: [
      "Agent pulls every change to assets in scope from the configuration database.",
      "For each change: composes the rationale, ties it to the approved ticket, and attaches the verification screenshots.",
      "Hallucination detector verifies every cited approver actually approved.",
      "Audit-bundle subscription auto-delivers the package to the NERC compliance officer.",
    ],
    result:
      "Quarterly evidence in hours, not weeks. Signed, dated, replayable. Regional Entity examiners verify in-place.",
  },
  {
    trigger: '"Draft this quarter\'s CSRD ESRS E1 climate disclosure."',
    steps: [
      "Agent ingests metered consumption, fleet telemetry, and contracted REC certificates.",
      "Composes Scope 1-3 disclosures matched to ESRS E1 datapoints.",
      "Bias auditor flags any greenwashing-adjacent language for human review.",
      "External auditor receives the disclosure plus a replay-bundle pre-loaded into their workpaper system.",
    ],
    result:
      "Auditor-ready ESRS package. -70% on disclosure prep time, zero unsupported claims.",
  },
  {
    trigger:
      '"Reconstruct yesterday\'s 14:32 ET dispatch incident — what triggered what?"',
    steps: [
      "Agent pulls every signed receipt within the incident window.",
      "Trace assembly (Cook 120) renders the W3C-traced causal chain.",
      "Outage post-mortem template fills in with citations to each underlying action.",
      "Result is auto-attached to the incident JIRA + posted to the operations channel.",
    ],
    result:
      "Forensic-grade reconstruction in minutes. No more 90-day RCA cycle.",
  },
];

const COMPLIANCE = [
  "NERC CIP-002 through CIP-014 — Critical Infrastructure Protection",
  "FERC Order 2222 — DER aggregation",
  "EU CSRD / ESRS E1-E5 + S1-S4 — Corporate Sustainability Reporting",
  "TCFD — Task Force on Climate-related Financial Disclosures",
  "ISO 14064 — Greenhouse-gas inventories",
  "SOX 404 — IT general controls",
  "NIST SP 800-82 — ICS / OT security",
  "SOC 2 Type 2 — continuous monitoring",
];

export default function ForUtilitiesPage() {
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
          Utilities & Grid Operations
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          AI that ships{" "}
          <span className="text-cyan-400">NERC + CSRD evidence</span> on its
          own.
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          NERC CIP wants signed change-control evidence. EU CSRD wants
          auditor-grade Scope 1-3 disclosure. Sovereign Matrix is the only agent
          stack that ships both posture boards cryptographically signed and
          replayable.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/contact?vertical=utilities"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Talk to a grid-compliance engineer
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
          Primitives shipped for utilities
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
          Pre-mapped to utility-sector controls
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
            One agent stack. Two regulator-grade posture boards.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Sovereign&rsquo;s signed-receipt fabric replaces the audit
            spreadsheet your compliance + sustainability teams maintain today.
            Continuous evidence. Replayable in court. Zero manual stitching.
          </p>
          <Link
            href="/contact?vertical=utilities"
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
