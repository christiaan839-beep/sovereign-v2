// ISR — vertical pages are static marketing surfaces; regenerate hourly.
export const revalidate = 3600;

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Leaf,
  FileText,
  ShieldCheck,
  Building2,
  Globe,
} from "lucide-react";
import type { Metadata } from "next";

/**
 * /for-csrd — Tier-1 ICP vertical landing (Cook 137).
 *
 * Hook: EU CSRD wave 1 (~12,000 EU companies) files first reports
 * in 2025 with "limited assurance" required from a Big-4 auditor.
 * The Big-4 are panicking about liability on AI-generated ESG
 * narratives. Sovereign's signed-receipt fabric + Cook 132 OpenAPI
 * + Cook 18 audit-bundle + Cook 136 anon-credential together
 * deliver auditor-grade ESRS evidence out of the box.
 *
 * Primary buyer: Sustainability Assurance partner at Big-4
 * (PwC NL, EY EMEIA, KPMG ESG, Deloitte Audit & Assurance).
 * Secondary: in-house Heads of Sustainability at CSRD wave-1 issuers.
 */

export const metadata: Metadata = {
  title:
    "AI for CSRD / ESRS Disclosure · Big-4 Auditor-Grade · Sovereign Matrix",
  description:
    "Cryptographically-audited ESRS E1-E5 + S1-S4 disclosures. Every claim ties back to source data with a signed receipt the limited-assurance auditor can replay.",
  alternates: { canonical: "/for-csrd" },
};

const PRIMITIVES = [
  {
    icon: Leaf,
    title: "ESRS E1-E5 disclosure composition",
    desc: "Agents draft ESRS E1 (climate), E2 (pollution), E3 (water), E4 (biodiversity), E5 (circularity) disclosures matched datapoint-by-datapoint to your source data. Every kWh, every tCO2e, every contracted REC ties back to a metered file via cited receipts.",
  },
  {
    icon: ShieldCheck,
    title: "Limited-assurance evidence bundles",
    desc: "Cook 18 audit-bundle subscription auto-delivers the disclosure pack + a replay-ready bundle to your Big-4 engagement partner. The auditor's workpaper system imports our OpenAPI spec; every claim is replayable in-place — no spreadsheet stitching, no PBC-list ping-pong.",
  },
  {
    icon: FileText,
    title: "Double-materiality assessment automation",
    desc: "Agents ingest stakeholder interviews, peer benchmarks, and your value-chain map. They draft the double-materiality matrix scored against ESRS guidance with citations to every input. Bias auditor flags greenwashing-adjacent language for human review.",
  },
  {
    icon: Building2,
    title: "S1-S4 social + governance narratives",
    desc: "ESRS S1 (own workforce) through S4 (consumers) draft against HRIS, training, and incident-management source data. Hallucination guard ensures every headcount, every grievance, every training hour ties to a verified row.",
  },
  {
    icon: Globe,
    title: "Auditor Replay Seats (Cook 136)",
    desc: "Your Big-4 engagement team gets read-only Replay Seats — they cryptographically verify any disclosure claim WITHOUT consuming your agent runs and WITHOUT seeing other clients' tenants. Anonymous credentials let the audit firm prove holder-validity without exposing client identity.",
  },
];

const USE_CASES = [
  {
    trigger:
      '"Draft this quarter\'s ESRS E1 climate disclosure for the limited-assurance package."',
    steps: [
      "Agent ingests metered consumption, fleet telemetry, leased-asset emissions, and contracted REC certificates.",
      "Composes ESRS E1-1 through E1-9 datapoints with citations to every underlying source row.",
      "Bias auditor flags any greenwashing-adjacent language for in-house ESG team review.",
      "Audit-bundle subscription auto-delivers to the Big-4 engagement partner with replay seats pre-provisioned.",
    ],
    result:
      "ESRS E1 disclosure + signed receipt + Big-4 replay seats. -70% on disclosure prep time, zero unsupported claims, auditor verifies in their own workpaper system.",
  },
  {
    trigger:
      '"Refresh the double-materiality matrix with this quarter\'s stakeholder feedback."',
    steps: [
      "Agent ingests survey responses, town-hall transcripts, peer-benchmark deltas.",
      "Scores each topic on impact-materiality + financial-materiality per ESRS guidance.",
      "Outputs the matrix as a versioned diff against the prior quarter — auditor sees every score change with its rationale.",
      "Hallucination detector verifies every stakeholder quote ties to an original transcript.",
    ],
    result:
      "Versioned double-materiality matrix with citation-grade diff. Auditor inspects deltas, not the whole exercise.",
  },
  {
    trigger:
      '"Prepare the limited-assurance handover bundle for the PwC engagement partner."',
    steps: [
      "Agent assembles the full disclosure + every supporting agent receipt + the model fingerprint (Cook 130).",
      "Cross-tenant ZK pass-rate proof (Cook 106) lets PwC verify firm-wide consistency without exposing peer-client data.",
      "Replay seats provisioned for the engagement team via anon-credential tokens (Cook 136).",
      "Bundle delivered through the OpenAPI spec at /.well-known/openapi.json (Cook 132).",
    ],
    result:
      "Handover bundle ready in hours, not weeks. PwC replays any disclosure claim in their own environment. Limited-assurance engagement risk-rated low.",
  },
];

const COMPLIANCE = [
  "EU CSRD — Corporate Sustainability Reporting Directive",
  "ESRS E1-E5 — Climate, pollution, water, biodiversity, circularity",
  "ESRS S1-S4 — Workforce, value chain, communities, consumers",
  "ESRS G1 — Business conduct",
  "ISSA 5000 — Limited assurance for sustainability",
  "GRI Standards — Cross-mapped reporting",
  "TCFD — Climate-related financial disclosures",
  "ISO 14064 — Greenhouse-gas inventories",
];

export default function ForCsrdPage() {
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
        <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-400 mb-4">
          EU CSRD &amp; ESRS Disclosure
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          The AI your Big-4{" "}
          <span className="text-cyan-400">limited-assurance partner</span> can
          actually sign off on.
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          CSRD wave 1 (~12,000 EU issuers) files first reports this year.
          Limited-assurance engagements demand replayable evidence for every
          AI-generated ESG narrative. Sovereign Matrix is the only agent stack
          that ships cryptographically-signed receipts your auditor verifies in
          their own workpaper system.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/contact?vertical=csrd"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Talk to a CSRD engineer
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
          Primitives shipped for CSRD &amp; ESRS
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
          Pre-mapped to CSRD &amp; sustainability-assurance controls
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
            Built for the Big-4 sustainability-assurance practice.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Auditor Replay Seats let your PwC / EY / Deloitte / KPMG team verify
            any disclosure claim cryptographically — without consuming your
            agent runs and without seeing peer-client data. ISSA 5000 limited
            assurance, finally tractable.
          </p>
          <Link
            href="/contact?vertical=csrd"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Schedule a Big-4 alliance call
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
