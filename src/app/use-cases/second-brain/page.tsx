"use client";

import { motion } from "framer-motion";
import { ArrowRight, Brain, Search, Zap, Database, Shield, Layers, MessageSquare, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const CAPABILITIES = [
  {
    icon: Brain,
    title: "Memory that persists",
    desc: "Every conversation, strategy, and decision is stored in tenant-scoped vector memory (Pinecone). Ask about a client conversation from 3 months ago — it pulls it up instantly.",
    color: "emerald",
  },
  {
    icon: Search,
    title: "Retrieval that understands context",
    desc: "Not keyword search. Semantic retrieval across your entire history — meeting notes, client briefs, competitive research, past outputs. The agent understands what you meant, not just what you typed.",
    color: "cyan",
  },
  {
    icon: Zap,
    title: "Action, not just answers",
    desc: "Found the old client strategy? The agent doesn't just show it — it drafts the follow-up email, schedules the meeting, updates the CRM, and prepares talking points. Memory + retrieval + execution.",
    color: "violet",
  },
  {
    icon: Database,
    title: "Your data stays yours",
    desc: "Tenant-isolated PostgreSQL. Your memory is never shared across accounts. Run locally via Ollama for complete air-gapped operation — nothing leaves your machine.",
    color: "amber",
  },
];

const WORKFLOWS = [
  {
    trigger: "\"Draft a follow-up to the Acme call from March\"",
    steps: [
      "Agent searches vector memory for Acme-related conversations",
      "Retrieves call notes, action items, and context from 3 months ago",
      "Drafts personalized follow-up email referencing specific discussion points",
      "Attaches updated proposal based on their stated budget and timeline",
    ],
    result: "A ready-to-send email that sounds like you wrote it — because it used your actual notes.",
  },
  {
    trigger: "\"What was our positioning against HubSpot last quarter?\"",
    steps: [
      "Searches across competitive analyses, pitch decks, and client objections",
      "Surfaces 3 positioning angles you used successfully",
      "Cross-references with latest competitor scan data",
      "Suggests updated positioning based on market changes since then",
    ],
    result: "Strategic recommendations grounded in your own history, not generic advice.",
  },
  {
    trigger: "\"Prepare me for the board meeting on Friday\"",
    steps: [
      "Pulls all project updates from the last 30 days",
      "Aggregates key metrics from playbook runs and agent outputs",
      "Identifies 3 wins, 2 risks, and 1 decision needed",
      "Generates a 5-slide briefing doc with supporting data",
    ],
    result: "A board-ready briefing that took 30 seconds instead of 3 hours.",
  },
];

export default function SecondBrainPage() {
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
            <Brain className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-[0.2em]">Use Case</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6"
          >
            Your AI<br />
            <span className="text-emerald-400">second brain.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-8"
          >
            Every conversation, every strategy, every client interaction — stored, searchable,
            and actionable. Your agents remember everything so you never have to.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3"
          >
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
              Start building your second brain <ArrowRight className="w-4 h-4" />
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
              Memory + Retrieval + Action
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              Most AI tools forget you after every conversation. Sovereign remembers everything
              and turns memory into execution.
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
              Ask anything. Get action.
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
              { icon: Database, label: "Pinecone", desc: "Vector memory — semantic search across all your data" },
              { icon: Layers, label: "Neon Postgres", desc: "Tenant-scoped relational store — structured data" },
              { icon: Shield, label: "5-Layer Pipeline", desc: "Every retrieval passes through guardrails" },
              { icon: Zap, label: "Ollama Local", desc: "Air-gapped mode — nothing leaves your machine" },
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
            Stop forgetting.<br />
            <span className="text-emerald-400">Start compounding.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            Every conversation makes your agents smarter. Every decision builds context.
            Your second brain gets better every day — without effort.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
