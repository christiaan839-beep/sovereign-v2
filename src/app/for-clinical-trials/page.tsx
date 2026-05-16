import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  ShieldCheck,
  ClipboardCheck,
  FlaskConical,
  Stethoscope,
} from "lucide-react";
import type { Metadata } from "next";

/**
 * /for-clinical-trials — Tier-1 ICP vertical landing (Cook 135).
 *
 * Hook: ICH GCP E6(R3) + 21 CFR Part 11 demand attributable, legible,
 * contemporaneous, original, accurate (ALCOA+) records with signed
 * audit trails. Sovereign's signed-receipt + multi-party attestation +
 * audit-bundle subscription map to every regulator control out of the
 * box — for sponsors, CROs, and sites alike.
 */

export const metadata: Metadata = {
  title:
    "AI for Clinical Trials · ICH GCP + 21 CFR Part 11 Ready · Sovereign Matrix",
  description:
    "Audit-grade AI for site-monitoring narratives, protocol-deviation logging, and trial master file (TMF) automation. Every record ALCOA+ compliant with cryptographic receipts.",
  alternates: { canonical: "/for-clinical-trials" },
};

const PRIMITIVES = [
  {
    icon: ShieldCheck,
    title: "21 CFR Part 11 electronic signatures",
    desc: "Multi-party attestation (Cook 39) gives PI + sponsor + CRA cryptographically-distinct signatures on every monitoring report. Each signature carries name, timestamp, and meaning-of-signature — exactly what 21 CFR Part 11 §11.50 demands.",
  },
  {
    icon: ClipboardCheck,
    title: "ICH GCP E6(R3) ALCOA+ audit trails",
    desc: "Every agent action emits an attributable, contemporaneous, original, accurate record. Receipt-chain ratchet (Cook 94) makes the trail tamper-evident — inspectors verify in-place without trusting the sponsor's database.",
  },
  {
    icon: FlaskConical,
    title: "Protocol-deviation logging + impact analysis",
    desc: "Site staff describe the deviation in natural language; the agent classifies severity, maps it to the protocol section, drafts the CAPA, and queues it for sponsor review. Hallucination guard ties every claim to the source document.",
  },
  {
    icon: FileText,
    title: "Trial Master File (TMF) automation",
    desc: "Receipt timeline (Cook 55) reconstructs the full TMF chronology from signed source records. Inspection-ready bundles auto-generate for the EMA / FDA inspector with a single CTA.",
  },
  {
    icon: Stethoscope,
    title: "Site-monitoring visit narratives",
    desc: "CRA dictates findings; agent composes the monitoring report against the latest protocol amendment. Citation guard verifies every dose, every endpoint, every adverse event ties back to source data.",
  },
];

const USE_CASES = [
  {
    trigger:
      '"Draft the SDV monitoring report for yesterday\'s Site 042 visit."',
    steps: [
      "Agent pulls the visit log, the source-data verification entries, and the latest protocol amendment.",
      "Composes the GCP-format monitoring report with every finding tied to source.",
      "PI signs electronically (21 CFR Part 11 §11.50); CRA co-signs; sponsor receives via attested bundle.",
      "Audit-bundle subscription delivers to the TMF on a fixed schedule.",
    ],
    result:
      "Monitoring report + receipts + ALCOA+ trail. -75% on CRA documentation time, zero §11.50 deficiencies in the inspection log.",
  },
  {
    trigger:
      '"Log a major protocol deviation: subject 048 missed Week 4 visit window."',
    steps: [
      "Site staff describes the deviation in plain language.",
      "Agent classifies as major per the deviation matrix, drafts the impact assessment.",
      "Sponsor medical monitor co-signs; CAPA draft auto-attaches.",
      "Bias auditor flags any language that might minimize the deviation.",
    ],
    result:
      "Documented deviation + CAPA + signed attestations. Inspector replays the trail in minutes.",
  },
  {
    trigger: '"Prepare the inspection-readiness package for FDA BIMO visit."',
    steps: [
      "Agent assembles the trial-master-file from signed source records.",
      "Receipt timeline shows every protocol amendment, deviation, AE narrative, and monitoring visit.",
      "Cross-tenant ZK proof (Cook 106) shares aggregate metrics with sponsor without exposing patient PHI.",
      "Inspector receives a replay-ready bundle pre-loaded into their workpaper system.",
    ],
    result:
      "BIMO inspection prep package in days, not months. Cryptographic chain-of-custody, zero gap.",
  },
];

const COMPLIANCE = [
  "ICH GCP E6(R3) — Good Clinical Practice",
  "21 CFR Part 11 — Electronic Records / Signatures",
  "21 CFR Part 50 — Informed Consent",
  "21 CFR Part 56 — IRB / IEC oversight",
  "EU CTR 536/2014 — Clinical Trials Regulation",
  "ALCOA+ — Data-integrity principles",
  "EMA / FDA BIMO inspection-readiness",
  "HIPAA + GDPR — PHI / patient-data sovereignty",
];

export default function ForClinicalTrialsPage() {
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
          Clinical Trials & Pharmacovigilance
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          AI you can put in front of an{" "}
          <span className="text-cyan-400">FDA BIMO inspector.</span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          ICH GCP E6(R3) + 21 CFR Part 11 demand attributable, contemporaneous,
          tamper-evident records with cryptographic signatures. Sovereign Matrix
          is the only AI agent stack that ships an inspection-ready TMF posture
          board out of the box.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/contact?vertical=clinical-trials"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Talk to a clinical-ops engineer
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
          Primitives shipped for clinical trials
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
          Pre-mapped to clinical-research controls
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
            From source data to inspection bundle — every step signed.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Sovereign&rsquo;s signed-receipt fabric replaces the screenshot-and-
            paste TMF prep your clinical-ops team does today. Continuous ALCOA+
            evidence. Replayable for the inspector. Zero deficiency findings on
            §11.50.
          </p>
          <Link
            href="/contact?vertical=clinical-trials"
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
