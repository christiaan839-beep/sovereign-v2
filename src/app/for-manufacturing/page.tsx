"use client";

import { motion } from "framer-motion";
import { ArrowRight, Factory, Wrench, AlertTriangle, CheckSquare, FileSpreadsheet, Database, Layers, Shield, Zap, MessageSquare, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const CAPABILITIES = [
  {
    icon: Wrench,
    title: "Predictive maintenance",
    desc: "Agents ingest vibration, temperature, and run-hour data from every machine on the floor. They surface failure probability scores days before breakdown — so you schedule maintenance on your terms, not the machine's.",
    color: "amber",
  },
  {
    icon: AlertTriangle,
    title: "Supply chain disruption detection & rerouting",
    desc: "Real-time monitoring of supplier financial health, geopolitical risk, weather events, and port delays. When disruption probability exceeds threshold, agents surface alternative suppliers and draft rerouting orders automatically.",
    color: "red",
  },
  {
    icon: CheckSquare,
    title: "Quality control & defect detection",
    desc: "Computer-vision agents analyze production line imagery against spec tolerances in real time. Defects are flagged to the line supervisor before they compound — not discovered by the customer.",
    color: "cyan",
  },
  {
    icon: FileSpreadsheet,
    title: "Vendor management & RFQ automation",
    desc: "Agents draft RFQs, compare bids against historical pricing, flag anomalies, and generate vendor scorecards. What took your procurement team three days now takes three minutes.",
    color: "violet",
  },
];

const WORKFLOWS = [
  {
    trigger: '"Run predictive maintenance analysis on press line 4"',
    steps: [
      "Pulls 90 days of vibration, temperature, and cycle-count telemetry for press line 4",
      "Runs anomaly detection against the manufacturer baseline and your historical failure patterns",
      "Identifies bearing wear signature in main drive motor — 94% probability of failure within 11 days",
      "Drafts maintenance work order with part numbers, estimated downtime window, and technician hours",
    ],
    result: "Unplanned downtime avoided. Maintenance scheduled for next Friday during a planned shift gap — not mid-production.",
  },
  {
    trigger: '"Score our top 20 suppliers for Q3 risk exposure"',
    steps: [
      "Pulls latest financial filings, news sentiment, and logistics delay data for all 20 suppliers",
      "Cross-references each supplier against geopolitical risk indices for their origin countries",
      "Calculates a composite risk score across 8 dimensions: financial, geographic, delivery, quality, concentration",
      "Generates a ranked risk report with recommended buffer stock levels and backup supplier options",
    ],
    result: "2 critical-risk suppliers identified. Buffer stock recommendations issued before any disruption lands.",
  },
  {
    trigger: '"Generate quality report for the Tier 1 auto client audit next week"',
    steps: [
      "Pulls defect logs, inspection records, and corrective action history for the past 90 days",
      "Calculates DPMO, Cpk, and first-pass yield rates broken down by product line and shift",
      "Maps defect trends against process change events to identify root cause correlations",
      "Assembles a client-ready quality report with executive summary, trend charts, and corrective action status",
    ],
    result: "Audit package ready in 8 minutes. Zero manual data pulls from three separate systems.",
  },
];

export default function ForManufacturingPage() {
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
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/[0.06] mb-6"
          >
            <Factory className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-[0.2em]">Manufacturing</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6"
          >
            AI agents for manufacturing<br />
            <span className="text-amber-400">&amp; supply chain.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-10"
          >
            Prevent downtime before it happens. Spot supply chain risk in real time. Close the quality loop automatically — from shop floor to client audit.
          </motion.p>

          {/* Stat badges */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex flex-wrap items-center justify-center gap-3 mb-10"
          >
            {[
              "$40T global manufacturing",
              "47% downtime reduction",
              "Real-time risk alerts",
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
              Automate Your Operations <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-16 px-6 border-y border-white/[0.03]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-amber-500/60 mb-4">Capabilities</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              From floor sensors to board reports.
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              Every operational intelligence task that used to require three systems and two analysts — unified, automated, and always on.
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
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-amber-500/60 mb-4">How It Works</p>
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
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] text-amber-500/60 uppercase tracking-wider font-semibold">You say</span>
                  </div>
                  <p className="text-sm text-white font-mono">{flow.trigger}</p>
                </div>

                {/* Steps */}
                <div className="px-6 py-4 space-y-2">
                  {flow.steps.map((step, j) => (
                    <div key={j} className="flex items-start gap-2.5 text-xs text-neutral-400">
                      <span className="text-amber-500/50 font-mono shrink-0 mt-0.5">{String(j + 1).padStart(2, "0")}</span>
                      {step}
                    </div>
                  ))}
                </div>

                {/* Result */}
                <div className="px-6 py-4 border-t border-white/[0.04] bg-amber-500/[0.02]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">{flow.result}</p>
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
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-amber-500/60 mb-4">Under The Hood</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Built for industrial-grade reliability.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Database, label: "Vector Memory", desc: "Semantic search across maintenance logs, supplier records, and quality histories" },
              { icon: Layers, label: "Tenant Isolation", desc: "Plant data is scoped per facility — your production IP stays within your walls" },
              { icon: Shield, label: "5-Layer Pipeline", desc: "Every alert passes anomaly detection, quality, and content guardrails before delivery" },
              { icon: Zap, label: "Ollama Local", desc: "Air-gapped mode — sensor data and IP never leave your on-premise infrastructure" },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
                <item.icon className="w-5 h-5 text-amber-400 mb-3" />
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
            Less downtime.<br />
            <span className="text-amber-400">More throughput.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            Your engineers shouldn&apos;t be chasing paper trails across disconnected systems.
            Deploy AI agents that monitor every machine, every supplier, and every quality metric — automatically.
          </p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
            Automate Your Operations <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
