"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  ShieldAlert,
  FileCheck2,
  Siren,
  Search,
  MessageSquare,
  CheckCircle2,
  Shield,
  Database,
  Layers,
  Zap,
} from "lucide-react";
import Link from "next/link";

const CAPABILITIES = [
  {
    icon: Siren,
    title: "First Notice of Loss (FNOL) intake",
    desc: "Callers describe the incident in plain English. The agent classifies claim type, estimates severity, spots red flags for SIU, and suggests next actions — in under 2 seconds.",
  },
  {
    icon: FileCheck2,
    title: "Certificate of Insurance verifier",
    desc: "Parse ACORD 25 / 27 / 28 certs. Extract insurer, coverages, limits, additional insureds, waivers — ready for your vendor-management system.",
  },
  {
    icon: Search,
    title: "Claims triage + routing",
    desc: "Auto-assign adjusters based on line-of-business, severity, geography, and workload. First-pass reserves proposed with rationale a senior adjuster can sign.",
  },
  {
    icon: ShieldAlert,
    title: "Fraud-signal detection",
    desc: "Cross-reference new claims against prior loss history, policy timing, provider patterns. Flag — don't decide. A human SIU reviewer still makes the call.",
  },
];

const WORKFLOWS = [
  {
    trigger: "\"New claim: policy AUT-88421, caller reports rear-end collision at 3rd & Main\"",
    steps: [
      "Agent classifies as auto / collision / property-damage-liability",
      "Severity tagged 'moderate' — two vehicles, no injuries reported",
      "Reserve suggested at $8,400 based on comparable claims",
      "Next actions queued: photos request, police report pull, driver statement",
    ],
    result: "Full FNOL packet in 1.4s. Adjuster calls back with a prepared file.",
  },
  {
    trigger: "\"Verify the COI Turner Construction sent for the SFO-Terminal-3 project\"",
    steps: [
      "Extract insurers (Travelers, Zurich), coverages (GL, Auto, WC, Umbrella)",
      "Verify each policy is effective and not expired",
      "Confirm 'SFO Airport Authority' is listed as Additional Insured",
      "Confirm Waiver of Subrogation endorsement is present",
    ],
    result: "One-page verification summary. Paralegal time saved per COI: 8 minutes.",
  },
];

export default function ForInsurancePage() {
  return (
    <div className="min-h-screen bg-[#010101] text-white">
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">Sovereign Matrix</Link>
        <Link href="/signup" className="px-5 py-2 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-colors">
          Get Started
        </Link>
      </nav>

      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-rose-500/20 bg-rose-500/[0.06] mb-6"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-[0.2em]">Insurance</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6"
          >
            AI agents for<br />
            <span className="text-rose-400">insurance.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-8"
          >
            FNOL intake in 2 seconds. COI verification in one shot. Structured output
            that plugs into Guidewire, Duck Creek, and Origami without transformation.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3"
          >
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
              Deploy insurance agents <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      <section className="py-16 px-6 border-y border-white/[0.03]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-rose-500/60 mb-4">Capabilities</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              The structural work, automated. The judgment, preserved.
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              Every claim still lands in a human&apos;s queue. What changes is how much prep work was already done.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {CAPABILITIES.map((cap, i) => (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="p-6 rounded-2xl border bg-[#080808] hover:border-rose-500/20 border-white/[0.05]"
              >
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center mb-4">
                  <cap.icon className="w-5 h-5 text-rose-400" />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{cap.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{cap.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-rose-500/60 mb-4">How It Works</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Say the thing. Get the packet.
            </h2>
          </div>
          <div className="space-y-8">
            {WORKFLOWS.map((flow, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="rounded-2xl border border-white/[0.06] bg-[#080808] overflow-hidden"
              >
                <div className="px-6 py-4 border-b border-white/[0.04] bg-[#060606]">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-3.5 h-3.5 text-rose-400" />
                    <span className="text-[10px] text-rose-500/60 uppercase tracking-wider font-semibold">You say</span>
                  </div>
                  <p className="text-sm text-white font-mono">{flow.trigger}</p>
                </div>
                <div className="px-6 py-4 space-y-2">
                  {flow.steps.map((step, j) => (
                    <div key={j} className="flex items-start gap-2.5 text-xs text-neutral-400">
                      <span className="text-rose-500/50 font-mono shrink-0 mt-0.5">{String(j + 1).padStart(2, "0")}</span>
                      {step}
                    </div>
                  ))}
                </div>
                <div className="px-6 py-4 border-t border-white/[0.04] bg-rose-500/[0.02]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-300">{flow.result}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 px-6 border-y border-white/[0.03] bg-[#030303]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-rose-500/60 mb-4">Under The Hood</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Built for regulated-carrier-grade security.
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Database, label: "SOC 2 path", desc: "Audit-logged invocations, tenant-scoped storage" },
              { icon: Layers, label: "Guidewire-ready", desc: "Output shapes match ClaimCenter canonical JSON" },
              { icon: Shield, label: "PII guardrails", desc: "SSN / policy # detected and masked before logs" },
              { icon: Zap, label: "On-prem option", desc: "Ollama mode keeps carriers' data off public clouds" },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
                <item.icon className="w-5 h-5 text-rose-400 mb-3" />
                <div className="text-xs font-semibold text-white mb-0.5">{item.label}</div>
                <p className="text-[10px] text-neutral-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
            Faster claims.<br />
            <span className="text-rose-400">Cleaner verifications.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            Your adjusters should handle the judgment calls — not the data entry.
            Deploy agents that prep the packet before the human picks up the phone.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
