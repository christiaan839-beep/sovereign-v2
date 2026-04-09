"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Minus, X } from "lucide-react";
import Link from "next/link";

const COMPARISON = [
  { feature: "Pre-built specialized agents (130)", sovereign: true, competitor: false, note: "CrewAI provides the framework — you build every agent yourself" },
  { feature: "No-code operation", sovereign: true, competitor: false, note: "CrewAI requires Python to define agents, tasks, and crews" },
  { feature: "Multi-model routing (36+ models)", sovereign: true, competitor: "partial", note: "CrewAI supports multiple LLMs but requires manual configuration per agent" },
  { feature: "Agent collaboration", sovereign: true, competitor: true, note: "Both support multi-agent workflows and task delegation" },
  { feature: "Hosted platform (zero infra)", sovereign: true, competitor: "partial", note: "CrewAI Enterprise offers hosting; open-source requires self-hosting" },
  { feature: "Open-source", sovereign: false, competitor: true, note: "CrewAI is fully open-source under MIT license" },
  { feature: "5-layer safety pipeline", sovereign: true, competitor: false, note: "CrewAI leaves safety guardrails to the developer" },
  { feature: "White-label for agencies", sovereign: true, competitor: false, note: "No white-label offering in CrewAI" },
  { feature: "Voice calling (AI)", sovereign: true, competitor: false, note: "Not part of the CrewAI framework" },
  { feature: "Content creation agents", sovereign: true, competitor: false, note: "CrewAI provides tools to build them — not pre-built agents" },
  { feature: "Lead generation agents", sovereign: true, competitor: false, note: "CrewAI provides tools to build them — not pre-built agents" },
  { feature: "Python extensibility", sovereign: "partial", competitor: true, note: "Sovereign exposes APIs; CrewAI is native Python with full code control" },
  { feature: "Consensus verification (4 models)", sovereign: true, competitor: false, note: "No built-in multi-model verification in CrewAI" },
  { feature: "Local/offline execution", sovereign: true, competitor: true, note: "Both support local model execution" },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />;
  if (value === false) return <X className="w-4 h-4 text-neutral-700 mx-auto" />;
  return <Minus className="w-4 h-4 text-amber-400/60 mx-auto" />;
}

export default function VsCrewAIPage() {
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
          className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Honest Comparison</motion.p>
        <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-black tracking-tight mb-6">
          Sovereign Matrix<br /><span className="text-neutral-500">vs CrewAI</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-neutral-400 max-w-xl mx-auto leading-relaxed">
          CrewAI is an impressive open-source project that&apos;s made multi-agent orchestration accessible to Python developers.
          But if you need production agents without writing code or managing infrastructure — here&apos;s how we compare.
        </motion.p>
      </section>

      {/* Positioning callout */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl border border-white/[0.06] bg-[#080808] text-center">
            <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-2">CrewAI</p>
            <p className="text-3xl font-black text-white">Framework</p>
            <p className="text-xs text-neutral-600 mt-1">Open-source Python toolkit — you build and host everything</p>
          </div>
          <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] text-center">
            <p className="text-[10px] text-emerald-500/60 uppercase tracking-widest mb-2">Sovereign Matrix</p>
            <p className="text-3xl font-black text-emerald-400">Platform</p>
            <p className="text-xs text-neutral-500 mt-1">Sign up, describe your goal, get output in minutes</p>
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
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 text-center">CrewAI</span>
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
            Comparison based on publicly available information as of April 2026. CrewAI is an open-source project by CrewAI, Inc.
          </p>
        </div>
      </section>

      {/* What CrewAI does better */}
      <section className="px-6 pb-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-4 text-center">Where CrewAI wins</h2>
          <p className="text-sm text-neutral-400 text-center max-w-lg mx-auto mb-6">
            We believe in honest comparisons. Here&apos;s where CrewAI is genuinely stronger:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: "Open-source flexibility", desc: "CrewAI is fully open-source. You can read every line, fork it, and modify the core orchestration logic to fit your exact needs." },
              { title: "Python ecosystem", desc: "Native Python means you can use any library — LangChain, pandas, scikit-learn, or your own modules. The entire Python ecosystem is at your fingertips." },
              { title: "Full code control", desc: "You define agent behavior, tool usage, and task flow in code. For teams with strong engineering, this level of control is hard to beat." },
              { title: "Active community", desc: "A growing community of developers contributing tools, examples, and integrations. Great support channels and documentation." },
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
              { title: "Zero setup, zero infrastructure", desc: "No Python environment, no Docker, no server provisioning. Sign up, describe what you need, and agents execute immediately on our hosted platform." },
              { title: "130 pre-built agents", desc: "Purpose-built agents for leads, content, SEO, voice, competitive intel, and more — ready to run. With CrewAI, every agent is custom-built from scratch." },
              { title: "Non-technical users welcome", desc: "Marketing teams, agencies, and founders can run sophisticated agent workflows without writing a single line of code." },
              { title: "Built-in safety + consensus", desc: "Every output passes a 5-layer safety pipeline and consensus verification across 4 independent models. With CrewAI, safety guardrails are your responsibility." },
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
              { label: "vs Claude Agents", href: "/vs/claude-agents" },
              { label: "vs n8n", href: "/vs/n8n" },
              { label: "vs Manus", href: "/vs/manus" },
              { label: "Content Engine", href: "/use-cases/content-engine" },
              { label: "Second Brain", href: "/use-cases/second-brain" },
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
