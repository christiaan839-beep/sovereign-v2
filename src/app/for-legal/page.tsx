"use client";

import { motion } from "framer-motion";
import { ArrowRight, Scale, FileSearch, ShieldCheck, BookOpen, Shield, Database, Layers, Zap, MessageSquare, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const CAPABILITIES = [
  {
    icon: FileSearch,
    title: "Contract analysis & review",
    desc: "Upload any contract and get a clause-by-clause breakdown in seconds. Non-standard terms flagged, risk scored, and compared against your playbook. What took a junior associate 4 hours takes 30 seconds.",
    color: "violet",
  },
  {
    icon: Scale,
    title: "Due diligence automation",
    desc: "Feed in a target company and the agent pulls public filings, cross-references litigation history, identifies red flags, and generates a structured diligence memo. Weeks of work compressed into hours.",
    color: "cyan",
  },
  {
    icon: ShieldCheck,
    title: "Compliance scanning",
    desc: "Check your documents, terms, and policies against GDPR, CCPA, SOX, or any regulatory framework. Agents flag gaps, suggest language, and track remediation status across your entire compliance surface.",
    color: "emerald",
  },
  {
    icon: BookOpen,
    title: "Legal research",
    desc: "Natural language queries across case law, statutes, and regulatory guidance. The agent finds relevant precedents, summarizes holdings, and cites sources — no Boolean search strings required.",
    color: "amber",
  },
];

const WORKFLOWS = [
  {
    trigger: "\"Review this 50-page NDA and flag non-standard clauses\"",
    steps: [
      "Agent ingests the full NDA and segments it by clause type",
      "Compares each clause against your firm\u0027s standard NDA playbook",
      "Flags 7 non-standard provisions with risk ratings (high/medium/low)",
      "Generates a redline with suggested alternative language for each flag",
    ],
    result: "Full NDA review with annotated redlines delivered in 45 seconds.",
  },
  {
    trigger: "\"Run due diligence on Acme Corp acquisition target\"",
    steps: [
      "Pulls corporate filings, SEC documents, and public records for Acme Corp",
      "Scans litigation databases for pending and historical cases",
      "Identifies key contracts, IP holdings, and regulatory obligations",
      "Generates a structured diligence memo with risk matrix and recommendations",
    ],
    result: "A 30-page diligence report that would have taken a team 2 weeks, ready in an afternoon.",
  },
  {
    trigger: "\"Check our terms against GDPR requirements\"",
    steps: [
      "Parses your current Terms of Service and Privacy Policy",
      "Maps each section against GDPR Articles 6-22 data subject rights",
      "Identifies 4 gaps in consent language and 2 missing data processing disclosures",
      "Drafts compliant replacement clauses with legal citations",
    ],
    result: "GDPR gap analysis with ready-to-use compliant language. No outside counsel needed.",
  },
];

export default function ForLegalPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-white">
      {/* Nav */}
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">Sovereign Matrix</Link>
        <Link href="/signup" className="px-5 py-2 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-colors">
          Get Started
        </Link>
      </nav>

      {/* Hero */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/20 bg-violet-500/[0.06] mb-6"
          >
            <Scale className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[11px] font-semibold text-violet-400 uppercase tracking-[0.2em]">Legal</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6"
          >
            AI agents for<br />
            <span className="text-violet-400">legal.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-8"
          >
            Contract review in seconds. Due diligence at scale. Air-gapped execution for confidential work.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3"
          >
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
              Deploy legal agents <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-16 px-6 border-y border-white/[0.03]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-violet-500/60 mb-4">Capabilities</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Billable hours on what matters.
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              Let agents handle the document review, research, and compliance checks. Your team focuses on strategy and client counsel.
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
                className={`p-6 rounded-2xl border bg-[#080808] transition-all hover:border-${cap.color}-500/20 border-white/[0.05]`}
              >
                <div className={`w-10 h-10 rounded-xl bg-${cap.color}-500/10 flex items-center justify-center mb-4`}>
                  <cap.icon className={`w-5 h-5 text-${cap.color}-400`} />
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{cap.title}</h3>
                <p className="text-sm text-neutral-400 leading-relaxed">{cap.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow examples */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-violet-500/60 mb-4">How It Works</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Describe the task. Get the deliverable.
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
                {/* Trigger */}
                <div className="px-6 py-4 border-b border-white/[0.04] bg-[#060606]">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-[10px] text-violet-500/60 uppercase tracking-wider font-semibold">You say</span>
                  </div>
                  <p className="text-sm text-white font-mono">{flow.trigger}</p>
                </div>

                {/* Steps */}
                <div className="px-6 py-4 space-y-2">
                  {flow.steps.map((step, j) => (
                    <div key={j} className="flex items-start gap-2.5 text-xs text-neutral-400">
                      <span className="text-violet-500/50 font-mono shrink-0 mt-0.5">{String(j + 1).padStart(2, "0")}</span>
                      {step}
                    </div>
                  ))}
                </div>

                {/* Result */}
                <div className="px-6 py-4 border-t border-white/[0.04] bg-violet-500/[0.02]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-violet-300">{flow.result}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="py-16 px-6 border-y border-white/[0.03] bg-[#030303]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-violet-500/60 mb-4">Under The Hood</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Built for attorney-client privilege.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Database, label: "Pinecone", desc: "Vector memory — semantic search across contracts, case files, and precedents" },
              { icon: Layers, label: "Neon Postgres", desc: "Tenant-scoped relational store — client matter isolation" },
              { icon: Shield, label: "5-Layer Pipeline", desc: "Every output passes through PII scrubbing, privilege, and quality guardrails" },
              { icon: Zap, label: "Ollama Local", desc: "Air-gapped mode — confidential documents never leave your network" },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
                <item.icon className="w-5 h-5 text-violet-400 mb-3" />
                <div className="text-xs font-semibold text-white mb-0.5">{item.label}</div>
                <p className="text-[10px] text-neutral-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight mb-4">
            Stop reviewing manually.<br />
            <span className="text-violet-400">Start scaling your practice.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            Every contract reviewed builds your firm&apos;s institutional knowledge.
            Every precedent found makes the next search faster. Compounding legal intelligence.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
