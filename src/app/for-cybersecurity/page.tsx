"use client";

import { motion } from "framer-motion";
import { ArrowRight, Scan, Radar, ClipboardCheck, ShieldAlert, Shield, Database, Layers, Zap, MessageSquare, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const CAPABILITIES = [
  {
    icon: Scan,
    title: "Vulnerability scanning",
    desc: "Agents crawl your codebase, infrastructure, and dependencies for known CVEs, misconfigurations, and zero-day patterns. Continuous scanning, not quarterly audits. Built for the era when AI can find zero-days autonomously.",
    color: "red",
  },
  {
    icon: Radar,
    title: "Threat detection & response",
    desc: "Real-time monitoring across your API endpoints, network traffic, and authentication logs. Agents detect anomalous patterns, classify threat severity, and trigger automated containment — before the SOC analyst finishes their coffee.",
    color: "amber",
  },
  {
    icon: ClipboardCheck,
    title: "Security audit automation",
    desc: "Generate SOC 2, ISO 27001, and PCI-DSS compliance artifacts automatically. Agents map your controls to framework requirements, identify gaps, and draft remediation plans with evidence collection.",
    color: "cyan",
  },
  {
    icon: ShieldAlert,
    title: "Compliance monitoring",
    desc: "Continuous compliance posture monitoring across your entire stack. Policy drift detection, access review automation, and real-time alerting when configurations deviate from your security baseline.",
    color: "violet",
  },
];

const WORKFLOWS = [
  {
    trigger: "\"Scan our codebase for known vulnerability patterns\"",
    steps: [
      "Agent clones the repository and builds a dependency graph across all packages",
      "Runs static analysis for OWASP Top 10, injection patterns, and hardcoded secrets",
      "Cross-references all dependencies against NVD and GitHub Advisory databases",
      "Generates a prioritized vulnerability report with severity scores and fix suggestions",
    ],
    result: "Full codebase scan complete. 3 critical, 12 high, 47 medium findings with remediation steps.",
  },
  {
    trigger: "\"Monitor all API endpoints for anomalous traffic\"",
    steps: [
      "Agent establishes baseline traffic patterns for each endpoint over 30 days",
      "Deploys real-time monitoring with statistical anomaly detection per endpoint",
      "Classifies detected anomalies: rate spikes, geo-shifts, payload mutations, auth failures",
      "Triggers automated rate limiting on confirmed threats and alerts the security team",
    ],
    result: "24/7 monitoring active. Brute-force attempt on /api/auth blocked in 200ms. Team notified.",
  },
  {
    trigger: "\"Generate SOC 2 compliance report for this quarter\"",
    steps: [
      "Pulls access logs, change management records, and incident reports for Q1",
      "Maps existing controls against SOC 2 Type II trust service criteria",
      "Identifies 2 gaps in change management documentation and 1 in access reviews",
      "Generates the full compliance report with evidence artifacts and remediation timeline",
    ],
    result: "SOC 2 report draft ready for auditor review. 94% of controls documented with evidence.",
  },
];

export default function ForCybersecurityPage() {
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
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-red-500/20 bg-red-500/[0.06] mb-6"
          >
            <Shield className="w-3.5 h-3.5 text-red-400" />
            <span className="text-[11px] font-semibold text-red-400 uppercase tracking-[0.2em]">Cybersecurity</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6"
          >
            AI agents for<br />
            <span className="text-red-400">cybersecurity.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-8"
          >
            Glasswing-grade vulnerability detection. 5-layer safety pipeline. Audit every action.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3"
          >
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
              Deploy security agents <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-16 px-6 border-y border-white/[0.03]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-red-500/60 mb-4">Capabilities</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Defend continuously. Respond instantly.
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              Built for the era when AI can find zero-days autonomously. Your security posture monitored 24/7, every action logged, every anomaly flagged.
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
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-red-500/60 mb-4">How It Works</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Command your security posture.
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
                    <MessageSquare className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-[10px] text-red-500/60 uppercase tracking-wider font-semibold">You say</span>
                  </div>
                  <p className="text-sm text-white font-mono">{flow.trigger}</p>
                </div>

                {/* Steps */}
                <div className="px-6 py-4 space-y-2">
                  {flow.steps.map((step, j) => (
                    <div key={j} className="flex items-start gap-2.5 text-xs text-neutral-400">
                      <span className="text-red-500/50 font-mono shrink-0 mt-0.5">{String(j + 1).padStart(2, "0")}</span>
                      {step}
                    </div>
                  ))}
                </div>

                {/* Result */}
                <div className="px-6 py-4 border-t border-white/[0.04] bg-red-500/[0.02]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300">{flow.result}</p>
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
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-red-500/60 mb-4">Under The Hood</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Security infrastructure for security teams.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Database, label: "Pinecone", desc: "Vector memory — semantic search across threat intelligence and vulnerability databases" },
              { icon: Layers, label: "Neon Postgres", desc: "Tenant-scoped relational store — audit logs with full chain-of-custody" },
              { icon: Shield, label: "5-Layer Pipeline", desc: "Jailbreak, PII, content, quality, and critic — every output verified" },
              { icon: Zap, label: "Ollama Local", desc: "Air-gapped mode — security data never leaves your perimeter" },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
                <item.icon className="w-5 h-5 text-red-400 mb-3" />
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
            Stop reacting to breaches.<br />
            <span className="text-red-400">Start preventing them.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            Continuous vulnerability scanning, real-time threat detection, and automated compliance reporting.
            Your security posture doesn&apos;t sleep — and neither do your agents.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
