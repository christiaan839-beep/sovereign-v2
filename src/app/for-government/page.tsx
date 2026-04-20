"use client";

import { motion } from "framer-motion";
import { ArrowRight, Building2, FileCheck, Users, FileSearch, ShieldCheck, Database, Layers, Shield, Zap, MessageSquare, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const CAPABILITIES = [
  {
    icon: FileCheck,
    title: "Permit & application processing automation",
    desc: "Agents validate submissions, check completeness, cross-reference zoning rules and compliance requirements, and route to the right reviewer — in minutes, not months. Applicants get status updates automatically.",
    color: "cyan",
  },
  {
    icon: Users,
    title: "Benefits eligibility determination",
    desc: "Agents process applications against program rules, cross-reference income and residency data, and surface eligibility determinations for officer review. Consistent decisions at scale — no case-by-case inconsistency.",
    color: "emerald",
  },
  {
    icon: FileSearch,
    title: "Freedom of Information (FOIA) automation",
    desc: "Agents locate responsive documents across disparate systems, apply automated redactions for PII and exempt information, and draft the cover letter and response package. What took 20 staff-days now takes hours.",
    color: "violet",
  },
  {
    icon: ShieldCheck,
    title: "Policy compliance monitoring",
    desc: "Agents continuously scan operational data, procurement records, and public-facing outputs against current policy and regulatory requirements. Compliance gaps are flagged with evidence before they become audit findings.",
    color: "amber",
  },
];

const WORKFLOWS = [
  {
    trigger: '"Process the 47 pending building permit applications from this week"',
    steps: [
      "Ingests all 47 applications and validates completeness against the current submission checklist",
      "Cross-references each property against zoning maps, flood zones, and existing permit history",
      "Flags 6 applications with missing documentation — sends automated deficiency notices to applicants",
      "Routes 41 complete applications to the appropriate reviewer queues with pre-populated review summaries",
    ],
    result: "41 applications moving through the process by end of day. 6 applicants notified with specific corrections needed. Zero manual data entry.",
  },
  {
    trigger: '"Determine eligibility for the 120 housing assistance applications received this month"',
    steps: [
      "Pulls income, residency, and household composition data for each applicant",
      "Applies current program rules across 14 eligibility criteria with full audit trail",
      "Calculates benefit tier and flags edge cases requiring officer review (11 of 120)",
      "Generates determination notices for eligible applicants and denial letters with appeal information",
    ],
    result: "109 straightforward determinations processed in 22 minutes. 11 complex cases queued for officer review with AI-prepared case summaries.",
  },
  {
    trigger: '"Respond to the FOIA request for all correspondence on the Route 7 expansion project"',
    steps: [
      "Searches email, document management, and records systems for responsive documents",
      "Identifies 847 potentially responsive records across 6 systems",
      "Applies automated redactions for personal information and attorney-client exempt content",
      "Assembles the response package with index, redaction log, and cover letter draft",
    ],
    result: "Response package assembled in 3 hours. Legal review confirms redactions are appropriate. 18 staff-days of work completed before lunch.",
  },
];

export default function ForGovernmentPage() {
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
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/[0.06] mb-6"
          >
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-[0.2em]">Government</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6"
          >
            AI agents for government<br />
            <span className="text-cyan-400">&amp; public sector.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-10"
          >
            Permit backlogs cleared. Benefits processed in hours. FOIA responses in days, not months. Public services that actually run at the speed citizens expect.
          </motion.p>

          {/* Stat badges */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex flex-wrap items-center justify-center gap-3 mb-10"
          >
            {[
              "Largest employer globally",
              "10x faster processing",
              "NIST AI RMF compliant",
            ].map((stat) => (
              <span key={stat} className="px-4 py-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] text-xs text-neutral-400 font-medium">
                {stat}
              </span>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3"
          >
            <Link href="/dashboard" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
              Modernize Public Services <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-16 px-6 border-y border-white/[0.03]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-500/60 mb-4">Capabilities</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Serve more constituents with the same team.
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              Every high-volume administrative task that creates backlogs and erodes public trust — automated, consistent, and fully auditable.
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
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-500/60 mb-4">How It Works</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Give the command. Get the outcome.
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
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[10px] text-cyan-500/60 uppercase tracking-wider font-semibold">You say</span>
                  </div>
                  <p className="text-sm text-white font-mono">{flow.trigger}</p>
                </div>

                {/* Steps */}
                <div className="px-6 py-4 space-y-2">
                  {flow.steps.map((step, j) => (
                    <div key={j} className="flex items-start gap-2.5 text-xs text-neutral-400">
                      <span className="text-cyan-500/50 font-mono shrink-0 mt-0.5">{String(j + 1).padStart(2, "0")}</span>
                      {step}
                    </div>
                  ))}
                </div>

                {/* Result */}
                <div className="px-6 py-4 border-t border-white/[0.04] bg-cyan-500/[0.02]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-cyan-300">{flow.result}</p>
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
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-cyan-500/60 mb-4">Under The Hood</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Built for government-grade accountability.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Database, label: "Immutable Audit Log", desc: "Every agent action is timestamped and tamper-proof — ready for oversight committees and IG inquiries" },
              { icon: Layers, label: "Tenant Isolation", desc: "Department data is scoped per agency — no cross-contamination between programs or jurisdictions" },
              { icon: Shield, label: "NIST AI RMF", desc: "Architecture maps to the NIST AI Risk Management Framework — explainable outputs, human-in-the-loop gates" },
              { icon: Zap, label: "On-Premise Option", desc: "FedRAMP-aligned local deployment — sensitive citizen data never leaves government infrastructure" },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
                <item.icon className="w-5 h-5 text-cyan-400 mb-3" />
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
            Less backlog.<br />
            <span className="text-cyan-400">Better public service.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            Your civil servants shouldn&apos;t spend half their time on intake paperwork.
            Deploy AI agents that handle the volume so your team can focus on the decisions that actually require human judgment.
          </p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
            Modernize Public Services <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
