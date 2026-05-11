"use client";

import { motion } from "framer-motion";
import { ArrowRight, Target, Mail, Phone, BarChart3, CheckCircle2, MessageSquare, Database, Layers, Shield, Zap } from "lucide-react";
import Link from "next/link";

const CAPABILITIES = [
  {
    icon: Target,
    title: "ICP-to-prospect pipeline",
    desc: "Define your ideal customer. Agents scan LinkedIn, Crunchbase, and company databases to find exact matches. Enriched with emails, funding data, and tech stack.",
    color: "emerald",
  },
  {
    icon: Mail,
    title: "Autonomous outreach",
    desc: "Agents write personalized sequences for each prospect. Not templates \u2014 real research on their company, role, and recent activity. Sent at optimal times.",
    color: "cyan",
  },
  {
    icon: Phone,
    title: "AI voice qualification",
    desc: "Voice agents call prospects, qualify for budget and timeline, handle objections, and book meetings directly to your calendar. AI disclosed on every call.",
    color: "violet",
  },
  {
    icon: BarChart3,
    title: "Pipeline intelligence",
    desc: "Track every lead from first touch to closed deal. Know which agents, sequences, and angles convert best. Compound learning \u2014 every campaign makes the next one smarter.",
    color: "amber",
  },
];

const WORKFLOWS = [
  {
    trigger: "\"Find 50 fintech companies with Series A funding in the US\"",
    steps: [
      "Agent scans 12 databases",
      "Filters by funding stage, geography, headcount",
      "Enriches with CEO/CTO emails and LinkedIn",
      "Scores by ICP fit (0\u2013100)",
      "Exports CSV with 50 qualified leads",
    ],
    result: "50 enriched leads with verified emails, ready for outreach \u2014 in 45 seconds.",
  },
  {
    trigger: "\"Write cold email sequences for the top 20 leads\"",
    steps: [
      "Researches each company\u2019s recent news and product",
      "Drafts 3-email sequence per lead (intro, value, CTA)",
      "A/B tests subject lines",
      "Runs through anti-slop filter and quality scorer",
      "Schedules send at optimal times per timezone",
    ],
    result: "60 personalized emails queued. Average open rate: 34% (vs 18% industry average).",
  },
  {
    trigger: "\"Call the 5 leads who opened all 3 emails\"",
    steps: [
      "Pulls engagement data from email tracker",
      "Prepares talking points per lead",
      "Voice agent calls each lead",
      "Qualifies for budget, timeline, decision maker",
      "Books 2 meetings directly to calendar",
    ],
    result: "5 calls completed in 4 minutes. 2 meetings booked. Pipeline value: $47,000.",
  },
];

export default function LeadGenPage() {
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
            <Target className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-[0.2em]">Use Case</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6"
          >
            Your AI<br />
            <span className="text-emerald-400">lead machine.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-8"
          >
            From ICP definition to qualified meetings &mdash; 137 agents handle the entire pipeline.
            No cold calling. No manual research. No spreadsheets.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3"
          >
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
              Start generating leads <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* The pattern */}
      <section className="py-16 px-6 border-y border-white/[0.03]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">The Pattern</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Find + Reach + Qualify + Close
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              Most sales teams burn hours on manual research and generic outreach. Sovereign agents
              handle the entire pipeline from ICP to booked meeting.
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
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">How It Works</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Say what you need. Get qualified leads.
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
              Built on real infrastructure.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Database, label: "Pinecone", desc: "Vector memory \u2014 semantic search across all your data" },
              { icon: Layers, label: "Neon Postgres", desc: "Tenant-scoped relational store \u2014 structured data" },
              { icon: Shield, label: "5-Layer Pipeline", desc: "Every retrieval passes through guardrails" },
              { icon: Zap, label: "Ollama Local", desc: "Air-gapped mode \u2014 nothing leaves your machine" },
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
            Stop chasing leads.<br />
            <span className="text-emerald-400">Start closing them.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            Every campaign teaches your agents what converts. Every call refines the pitch.
            Your pipeline gets smarter every day &mdash; without effort.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
