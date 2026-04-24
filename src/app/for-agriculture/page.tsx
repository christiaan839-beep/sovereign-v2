"use client";

import { motion } from "framer-motion";
import { ArrowRight, Sprout, TrendingUp, Bug, ShoppingCart, ClipboardList, Database, Layers, Shield, Zap, MessageSquare, CheckCircle2 } from "lucide-react";
import Link from "next/link";

/**
 * Tailwind v4 JIT cannot see interpolated class names (e.g.
 * `bg-${cap.color}-500/10`) — they never make it into the compiled CSS
 * and render as silent no-ops. This literal map is the documented safe
 * pattern: every class is spelled out so the scanner finds them.
 */
const COLOR_CLASSES = {
  emerald: {
    iconBg: "bg-emerald-500/10",
    iconFg: "text-emerald-400",
    borderHover: "hover:border-emerald-500/20",
  },
  amber: {
    iconBg: "bg-amber-500/10",
    iconFg: "text-amber-400",
    borderHover: "hover:border-amber-500/20",
  },
  cyan: {
    iconBg: "bg-cyan-500/10",
    iconFg: "text-cyan-400",
    borderHover: "hover:border-cyan-500/20",
  },
  violet: {
    iconBg: "bg-violet-500/10",
    iconFg: "text-violet-400",
    borderHover: "hover:border-violet-500/20",
  },
} as const;

type ColorKey = keyof typeof COLOR_CLASSES;

const CAPABILITIES: Array<{
  icon: typeof TrendingUp;
  title: string;
  desc: string;
  color: ColorKey;
}> = [
  {
    icon: TrendingUp,
    title: "Crop intelligence & yield forecasting",
    desc: "Agents ingest satellite imagery, soil sensor data, and weather forecasts to predict yield weeks before harvest. Field-level recommendations adjust seed density, irrigation, and fertilizer in real time.",
    color: "emerald",
  },
  {
    icon: Bug,
    title: "Pest and disease early warning",
    desc: "Computer-vision agents scan drone imagery for pest signatures and fungal patterns. Alerts fire before infestation spreads — days earlier than manual scouting, with GPS-precise treatment zones.",
    color: "amber",
  },
  {
    icon: ShoppingCart,
    title: "Supply chain & market price optimization",
    desc: "Agents monitor commodity futures, logistics costs, and buyer demand signals simultaneously. They surface optimal harvest windows and storage timing decisions so you sell at peak — not at whoever calls first.",
    color: "cyan",
  },
  {
    icon: ClipboardList,
    title: "Regulatory compliance automation",
    desc: "Pesticide application logs, traceability records, and export certificates — all generated automatically from field activity. Audit-ready documentation with zero manual data entry.",
    color: "violet",
  },
];

const WORKFLOWS = [
  {
    trigger: '"Analyze field 7 and give me a planting recommendation for the east quadrant"',
    steps: [
      "Pulls soil composition, moisture levels, and historical yield data for field 7",
      "Cross-references 14-day weather forecast with optimal germination windows for the selected crop variety",
      "Calculates seed density recommendation per row based on soil nitrogen and pH variance",
      "Generates GPS-mapped planting prescription file compatible with variable-rate seeder",
    ],
    result: "Planting prescription ready in 90 seconds. Estimated 18% yield improvement over uniform seeding.",
  },
  {
    trigger: '"Flag any disease risk across the wheat portfolio this week"',
    steps: [
      "Retrieves latest drone imagery across all 14 wheat fields",
      "Runs computer-vision model trained on 40,000 annotated disease samples",
      "Detects early-stage rust signatures in 3 fields, flags GPS coordinates of affected zones",
      "Drafts fungicide application order with dosage, timing, and equipment settings",
    ],
    result: "3 intervention zones identified. Treatment dispatched 8 days before visible symptoms would appear.",
  },
  {
    trigger: '"Generate export documentation for the canola shipment to Rotterdam"',
    steps: [
      "Pulls pesticide application records, spray dates, and product registrations for the lot",
      "Cross-checks residue limits against EU MRL regulations for the destination market",
      "Assembles phytosanitary certificate, traceability report, and bill of lading draft",
      "Flags one product requiring additional EU notification — sends pre-alert to freight forwarder",
    ],
    result: "Complete export pack ready in 4 minutes. Compliance risk flagged before shipment — not at the port.",
  },
];

export default function ForAgriculturePage() {
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
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] mb-6"
          >
            <Sprout className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-[0.2em]">Agriculture</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6"
          >
            AI agents for agriculture<br />
            <span className="text-emerald-400">&amp; precision farming.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-10"
          >
            From soil to sale. Agents that watch your fields, warn you early, and handle the compliance paperwork — so you focus on the harvest.
          </motion.p>

          {/* Stat badges */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex flex-wrap items-center justify-center gap-3 mb-10"
          >
            {[
              "$2.4T global ag market",
              "40% yield improvement potential",
              "Zero manual monitoring",
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
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
              Start Farming Smarter <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-16 px-6 border-y border-white/[0.03]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Capabilities</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Intelligence across every acre.
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              Every decision that used to require a specialist, an agronomist, or three spreadsheets — automated, verified, and audit-logged.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {CAPABILITIES.map((cap, i) => {
              const cls = COLOR_CLASSES[cap.color];
              return (
                <motion.div
                  key={cap.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className={`p-6 rounded-2xl border bg-[#080808] transition-all border-white/[0.05] ${cls.borderHover}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${cls.iconBg}`}>
                    <cap.icon className={`w-5 h-5 ${cls.iconFg}`} />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{cap.title}</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">{cap.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Workflow examples */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">How It Works</p>
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
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-[10px] text-emerald-500/60 uppercase tracking-wider font-semibold">You say</span>
                  </div>
                  <p className="text-sm text-white font-mono">{flow.trigger}</p>
                </div>

                {/* Steps */}
                <div className="px-6 py-4 space-y-2">
                  {flow.steps.map((step, j) => (
                    <div key={j} className="flex items-start gap-2.5 text-xs text-neutral-400">
                      <span className="text-emerald-500/50 font-mono shrink-0 mt-0.5">{String(j + 1).padStart(2, "0")}</span>
                      {step}
                    </div>
                  ))}
                </div>

                {/* Result */}
                <div className="px-6 py-4 border-t border-white/[0.04] bg-emerald-500/[0.02]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-300">{flow.result}</p>
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
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Under The Hood</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Built for field-grade reliability.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Database, label: "Vector Memory", desc: "Semantic search across years of field records, spray logs, and yield histories" },
              { icon: Layers, label: "Tenant Isolation", desc: "Farm data is scoped per operation — your competitors never see your soil data" },
              { icon: Shield, label: "5-Layer Pipeline", desc: "Every recommendation passes compliance, PII, and quality guardrails before delivery" },
              { icon: Zap, label: "Ollama Local", desc: "Air-gapped mode available — sensitive agronomic IP never leaves your infrastructure" },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
                <item.icon className="w-5 h-5 text-emerald-400 mb-3" />
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
            Less guesswork.<br />
            <span className="text-emerald-400">More yield.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            Your agronomists shouldn&apos;t be buried in spreadsheets.
            Deploy AI agents that monitor every field, flag every risk, and file every compliance record automatically.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
            Start Farming Smarter <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
