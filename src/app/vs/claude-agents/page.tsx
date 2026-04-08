"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Minus, X } from "lucide-react";
import Link from "next/link";

const COMPARISON = [
  { feature: "Pre-built agents", sovereign: true, competitor: false, note: "Sovereign ships 129 ready-to-run agents. Claude Managed Agents requires you to define your own via YAML or natural language." },
  { feature: "AI models (multi-provider)", sovereign: true, competitor: false, note: "Sovereign routes across 39+ models from 8 providers. Claude Managed Agents runs on Claude only." },
  { feature: "Multi-model consensus verification", sovereign: true, competitor: false, note: "4 independent models cross-check every output. Single-model platforms can\u2019t self-verify." },
  { feature: "Flat predictable pricing", sovereign: true, competitor: false, note: "Sovereign Node is $199/mo flat. Claude Managed Agents bills per API token \u2014 costs scale with usage." },
  { feature: "Local execution (air-gapped)", sovereign: true, competitor: false, note: "Run sensitive workloads locally via Ollama. Claude Managed Agents is cloud-only." },
  { feature: "White-label for agencies", sovereign: true, competitor: false, note: "Rebrand the entire platform under your agency\u2019s domain. Not available on Claude Managed Agents." },
  { feature: "Voice agents", sovereign: true, competitor: false, note: "Built-in voice calling agents for outbound and inbound. Not a Claude Managed Agents feature." },
  { feature: "Lead generation", sovereign: true, competitor: "partial", note: "Sovereign ships a pre-built lead-gen pipeline. With Claude Managed Agents, you build it yourself." },
  { feature: "Content creation", sovereign: true, competitor: "partial", note: "Sovereign\u2019s content agents publish end-to-end. Claude Managed Agents can write \u2014 you wire the rest." },
  { feature: "SEO intelligence", sovereign: true, competitor: false, note: "Keyword tracking, competitor scanning, SERP analysis built in. Not part of Claude Managed Agents." },
  { feature: "5-layer safety pipeline", sovereign: true, competitor: "partial", note: "Jailbreak \u2192 PII \u2192 Content \u2192 Quality \u2192 Critic. Claude Managed Agents offers basic guardrails." },
  { feature: "Trust levels (configurable autonomy)", sovereign: true, competitor: false, note: "4 trust levels from full-auto to human-in-the-loop. Claude Managed Agents has no equivalent." },
  { feature: "Execution audit trail", sovereign: true, competitor: "partial", note: "Immutable, per-step audit log with 5-layer verification badges. Claude Managed Agents has basic logging." },
  { feature: "Agent marketplace (80/20 revenue share)", sovereign: true, competitor: false, note: "Publish and monetize custom agents. No marketplace on Claude Managed Agents." },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />;
  if (value === false) return <X className="w-4 h-4 text-neutral-700 mx-auto" />;
  return <Minus className="w-4 h-4 text-amber-400/60 mx-auto" />;
}

export default function VsClaudeAgentsPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-white">
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">Sovereign Matrix</Link>
        <Link href="/signup" className="px-5 py-2 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-colors">
          Try Free
        </Link>
      </nav>

      {/* Hero */}
      <section className="py-20 px-6 text-center">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Better Together</motion.p>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-black tracking-tight mb-6">
          Sovereign Matrix<br /><span className="text-neutral-500">&amp; Claude Managed Agents</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-neutral-400 max-w-xl mx-auto leading-relaxed">
          We don&apos;t compete with Anthropic &mdash; we build on top of them. Claude is one of 39+ models in our routing layer.
          Sovereign is the multi-model orchestration infrastructure. Claude Managed Agents is the single-model execution layer.
          Together, they&apos;re more powerful than either alone.
        </motion.p>
      </section>

      {/* Pricing callout */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl border border-white/[0.06] bg-[#080808] text-center">
            <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-2">Claude Managed Agents</p>
            <p className="text-3xl font-black text-white">Pay-per-use</p>
            <p className="text-xs text-neutral-600 mt-1">API token billing &mdash; costs scale with usage</p>
          </div>
          <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] text-center">
            <p className="text-[10px] text-emerald-500/60 uppercase tracking-widest mb-2">Sovereign Node</p>
            <p className="text-3xl font-black text-emerald-400">$199<span className="text-sm text-emerald-500/50">/mo</span></p>
            <p className="text-xs text-neutral-500 mt-1">129 agents + 39 models + everything below</p>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="px-6 pb-24">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border border-white/[0.06] bg-[#080808] overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_80px_80px] md:grid-cols-[1fr_100px_100px] px-6 py-4 border-b border-white/[0.06] bg-[#060606]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Feature</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 text-center">Sovereign</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 text-center">Claude</span>
            </div>

            {COMPARISON.map((row, i) => (
              <motion.div
                key={row.feature}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
                className="grid grid-cols-[1fr_80px_80px] md:grid-cols-[1fr_100px_100px] px-6 py-3.5 border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors group"
              >
                <div>
                  <span className="text-sm text-neutral-300">{row.feature}</span>
                  <span className="hidden group-hover:block text-[10px] text-neutral-600 mt-0.5">{row.note}</span>
                </div>
                <Cell value={row.sovereign} />
                <Cell value={row.competitor} />
              </motion.div>
            ))}
          </div>

          <p className="text-center text-[10px] text-neutral-700 mt-4">
            Comparison based on publicly available information as of April 2026. Claude and Anthropic are registered trademarks of Anthropic, PBC.
          </p>
        </div>
      </section>

      {/* What Claude Managed Agents does better */}
      <section className="px-6 pb-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-4 text-center">Where Claude Managed Agents wins</h2>
          <p className="text-sm text-neutral-400 text-center max-w-lg mx-auto mb-6">
            We believe in honest comparisons. Here&apos;s where Claude Managed Agents is genuinely stronger:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: "Anthropic brand trust", desc: "Backed by a $30B company with world-class AI safety research. Enterprise buyers know and trust the Anthropic name." },
              { title: "Simplest setup", desc: "Define agents in natural language or YAML. No code, no config files. From description to running agent in minutes." },
              { title: "Deep Claude integration", desc: "Optimized specifically for Claude models. Every feature is tuned for their own model family \u2014 no abstraction overhead." },
              { title: "Enterprise support from Anthropic", desc: "Direct support from the team that builds the model. SLAs, dedicated contacts, and compliance certifications." },
            ].map((item) => (
              <div key={item.title} className="p-5 rounded-xl border border-white/[0.05] bg-white/[0.01]">
                <h3 className="text-sm font-semibold text-white mb-1">{item.title}</h3>
                <p className="text-xs text-neutral-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Where Sovereign wins */}
      <section className="px-6 pb-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-4 text-center">Where Sovereign wins</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: "129 pre-built agents", desc: "No YAML needed. Lead gen, content, SEO, voice, competitive intel \u2014 129 agents ship ready to run out of the box." },
              { title: "Model-agnostic (39+ models)", desc: "Route tasks to the best model from 8 providers. Never locked into a single vendor\u2019s pricing or capability ceiling." },
              { title: "Flat predictable pricing", desc: "Sovereign Node is $199/mo for everything. No per-token billing, no usage surprises, no cost anxiety at scale." },
              { title: "Local execution for sensitive data", desc: "Run workloads on-premise via Ollama. Air-gapped, zero data leaving your network. Claude Managed Agents is cloud-only." },
            ].map((item) => (
              <div key={item.title} className="p-5 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02]">
                <h3 className="text-sm font-semibold text-emerald-400 mb-1">{item.title}</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related pages */}
      <section className="px-6 pb-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-sm font-semibold text-neutral-500 mb-4 text-center">Related</h2>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { label: "vs CrewAI", href: "/vs/crewai" },
              { label: "vs n8n", href: "/vs/n8n" },
              { label: "vs Lindy", href: "/vs/lindy" },
              { label: "vs HubSpot", href: "/vs/hubspot" },
              { label: "Lead Generation", href: "/use-cases/lead-gen" },
              { label: "For Agencies", href: "/for-agencies" },
              { label: "Compare All", href: "/pricing/compare" },
            ].map((link) => (
              <Link key={link.label} href={link.href}
                className="px-3 py-1.5 rounded-full text-[10px] text-neutral-500 border border-white/[0.06] hover:border-emerald-500/20 hover:text-emerald-400 transition-all">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center border-t border-white/[0.03]">
        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Try it yourself.</h2>
        <p className="text-neutral-400 mb-6 max-w-md mx-auto text-sm">
          Run a free competitor scan on any URL. See real agent output. No signup required.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/free/competitor-scan" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
            Scan a Competitor Free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/signup" className="px-8 py-4 rounded-full text-sm font-semibold text-neutral-300 border border-white/[0.1] hover:border-white/[0.2] hover:text-white transition-all">
            Start free
          </Link>
        </div>
      </section>
    </div>
  );
}
