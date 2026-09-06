"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Minus, X } from "lucide-react";
import Link from "next/link";

const COMPARISON = [
  { feature: "Computer-use / browser control", sovereign: true, competitor: true, note: "Both offer browser automation — Manus pioneered full desktop control" },
  { feature: "Multi-agent orchestration", sovereign: true, competitor: false, note: "Sovereign runs 140 specialized agents in concert; Manus is a single general agent" },
  { feature: "Lead generation", sovereign: true, competitor: false, note: "Sovereign has dedicated lead gen agents; Manus doesn't focus on GTM" },
  { feature: "Content creation", sovereign: true, competitor: false, note: "End-to-end content pipeline with SEO; not a Manus use case" },
  { feature: "Voice calling (AI)", sovereign: true, competitor: false, note: "Sovereign makes autonomous voice calls; Manus operates visually" },
  { feature: "Multi-model routing (20 models)", sovereign: true, competitor: false, note: "Sovereign routes across 20 models; Manus uses a single model" },
  { feature: "Consensus verification (4 models)", sovereign: true, competitor: false, note: "Every output checked by 4 independent models" },
  { feature: "White-label for agencies", sovereign: true, competitor: false, note: "Sovereign offers full white-label; Manus does not" },
  { feature: "Flat pricing (no usage surprises)", sovereign: true, competitor: false, note: "$199/mo flat vs variable usage-based billing" },
  { feature: "5-layer safety pipeline", sovereign: true, competitor: false, note: "Jailbreak, PII, content, quality, and critic checks on every action" },
  { feature: "Local / offline execution", sovereign: true, competitor: false, note: "Run locally via Ollama; Manus is cloud-only" },
  { feature: "Website / app building", sovereign: true, competitor: true, note: "Both can build websites — Manus via desktop control, Sovereign via code agents" },
  { feature: "Presentation creation", sovereign: "partial", competitor: true, note: "Manus builds full presentations visually; Sovereign supports content generation" },
  { feature: "Enterprise backing", sovereign: false, competitor: true, note: "Manus is backed by Meta; Sovereign is independent" },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />;
  if (value === false) return <X className="w-4 h-4 text-neutral-700 mx-auto" />;
  return <Minus className="w-4 h-4 text-amber-400/60 mx-auto" />;
}

export default function VsManusPage() {
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
          Sovereign Matrix<br /><span className="text-neutral-500">vs Manus AI</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-neutral-400 max-w-xl mx-auto leading-relaxed">
          Manus pioneered general-purpose computer-use agents. We respect what they&apos;ve built.
          But if you need specialized multi-agent intelligence — not just desktop control — here&apos;s how we compare.
        </motion.p>
      </section>

      {/* Pricing callout */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl border border-white/[0.06] bg-[#080808] text-center">
            <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-2">Manus AI</p>
            <p className="text-3xl font-black text-white">Usage-based</p>
            <p className="text-xs text-neutral-600 mt-1">Variable pricing per task (acquired by Meta)</p>
          </div>
          <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] text-center">
            <p className="text-[10px] text-emerald-500/60 uppercase tracking-widest mb-2">Sovereign Node</p>
            <p className="text-3xl font-black text-emerald-400">$199<span className="text-sm text-emerald-500/50">/mo</span></p>
            <p className="text-xs text-neutral-500 mt-1">140 agents + 20 models + flat pricing</p>
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
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 text-center">Manus</span>
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
            Comparison based on publicly available information as of April 2026. Manus is a trademark of its respective owner.
          </p>
        </div>
      </section>

      {/* What Manus does better */}
      <section className="px-6 pb-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-4 text-center">Where Manus wins</h2>
          <p className="text-sm text-neutral-400 text-center max-w-lg mx-auto mb-6">
            We believe in honest comparisons. Here&apos;s where Manus is genuinely stronger:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: "Full desktop control", desc: "Manus controls your entire desktop — clicks, types, navigates any application. True computer-use at its best." },
              { title: "Meta backing", desc: "Acquired by Meta in 2026, Manus has the resources and infrastructure of one of the world's largest tech companies." },
              { title: "Visual task execution", desc: "Manus excels at visual tasks: building websites, creating presentations, and interacting with any GUI application." },
              { title: "Browser automation depth", desc: "Purpose-built for browser control. Manus navigates complex web apps with the fluency of a human operator." },
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
              { title: "140 specialized agents", desc: "Not one general agent. 130 purpose-built agents for leads, content, SEO, voice, competitive intel, code, and more." },
              { title: "Multi-model consensus", desc: "20 models with consensus verification. Every output is checked by 4 independent models before delivery." },
              { title: "Flat, predictable pricing", desc: "No usage surprises. $199/mo covers 140 agents and 20 models. Manus charges per task with variable costs." },
              { title: "Local execution + safety", desc: "Run locally via Ollama for full data control. 5-layer safety pipeline on every action. White-label for agencies." },
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
              { label: "vs CrewAI", href: "/vs/crewai" },
              { label: "vs Sintra", href: "/vs/sintra" },
              { label: "Second Brain", href: "/use-cases/second-brain" },
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
