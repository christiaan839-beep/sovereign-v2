"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Minus, X } from "lucide-react";
import Link from "next/link";

const COMPARISON = [
  { feature: "Lead enrichment", sovereign: true, competitor: true, note: "Both enrich contacts and companies" },
  { feature: "Multi-source data waterfall", sovereign: "partial", competitor: true, note: "Clay waterfalls across 75+ data sources — Sovereign covers key sources" },
  { feature: "AI agents that plan + execute", sovereign: true, competitor: false, note: "Clay runs data workflows, not autonomous agents" },
  { feature: "Content creation", sovereign: true, competitor: false, note: "No AI writing, blog, or social content tools" },
  { feature: "SEO intelligence", sovereign: true, competitor: false, note: "No keyword tracking, SERP analysis, or SEO auditing" },
  { feature: "Competitive analysis", sovereign: true, competitor: false, note: "No built-in competitor scanning or monitoring" },
  { feature: "Voice calling (AI)", sovereign: true, competitor: false, note: "Clay doesn&apos;t make calls — it enriches data" },
  { feature: "Email sequences", sovereign: true, competitor: "partial", note: "Clay triggers sequences via integrations (Instantly, Smartlead)" },
  { feature: "Multi-model routing (20 models)", sovereign: true, competitor: false, note: "Clay uses a single AI model for enrichment formulas" },
  { feature: "Local/offline execution", sovereign: true, competitor: false, note: "Cloud-only platform" },
  { feature: "White-label for agencies", sovereign: true, competitor: false, note: "No white-label offering" },
  { feature: "Workflow automation", sovereign: true, competitor: true, note: "Both automate multi-step workflows" },
  { feature: "CRM integration", sovereign: true, competitor: true, note: "Clay integrates via Salesforce/HubSpot; Sovereign has native CRM agents" },
  { feature: "5-layer safety pipeline", sovereign: true, competitor: false, note: "No multi-layer verification or content safety checks" },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />;
  if (value === false) return <X className="w-4 h-4 text-neutral-700 mx-auto" />;
  return <Minus className="w-4 h-4 text-amber-400/60 mx-auto" />;
}

export default function VsClayPage() {
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
          Sovereign Matrix<br /><span className="text-neutral-500">vs Clay</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-neutral-400 max-w-xl mx-auto leading-relaxed">
          Clay is excellent at what it does — waterfall enrichment across 75+ data sources with a clean,
          spreadsheet-like interface. But if you need more than enrichment, here&apos;s how we compare.
        </motion.p>
      </section>

      {/* Pricing callout */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl border border-white/[0.06] bg-[#080808] text-center">
            <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-2">Clay Pro</p>
            <p className="text-3xl font-black text-white">$149<span className="text-sm text-neutral-500">/mo</span></p>
            <p className="text-xs text-neutral-600 mt-1">Lead enrichment + data workflows</p>
          </div>
          <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] text-center">
            <p className="text-[10px] text-emerald-500/60 uppercase tracking-widest mb-2">Sovereign Node</p>
            <p className="text-3xl font-black text-emerald-400">$199<span className="text-sm text-emerald-500/50">/mo</span></p>
            <p className="text-xs text-neutral-500 mt-1">140 agents + 20 models + everything below</p>
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
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 text-center">Clay</span>
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
            Comparison based on publicly available information as of April 2026. Clay is a registered trademark of Clay, Inc.
          </p>
        </div>
      </section>

      {/* What Clay does better */}
      <section className="px-6 pb-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-4 text-center">Where Clay wins</h2>
          <p className="text-sm text-neutral-400 text-center max-w-lg mx-auto mb-6">
            We believe in honest comparisons. Here&apos;s where Clay is genuinely stronger:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: "Data enrichment depth", desc: "Clay waterfalls across 75+ data sources in a single workflow. It&apos;s the deepest enrichment engine on the market." },
              { title: "Purpose-built for RevOps", desc: "Clay was designed from day one for revenue operations teams. Every feature serves enrichment and data quality." },
              { title: "Clean spreadsheet UI", desc: "The table-based interface is intuitive for data-heavy workflows. Drag, filter, and enrich without writing code." },
              { title: "Enrichment integrations", desc: "Native connectors to Clearbit, Apollo, Hunter, ZoomInfo, and dozens more — purpose-built for stacking data sources." },
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
              { title: "140 agents vs 1 tool", desc: "Clay enriches data. Sovereign enriches, writes content, runs SEO audits, makes voice calls, monitors competitors, and 120 more capabilities." },
              { title: "Autonomous execution", desc: "Sovereign agents don&apos;t just fetch data — they plan multi-step strategies, execute them, and self-correct without babysitting." },
              { title: "Multi-model intelligence", desc: "20 models with consensus verification. Every output is checked by 4 independent models. Clay uses a single AI model." },
              { title: "10x more capabilities, similar price", desc: "Clay Pro is $149/mo for enrichment. Sovereign Node is $199/mo for enrichment + content + SEO + voice + competitive intel + everything else." },
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
              { label: "vs HubSpot", href: "/vs/hubspot" },
              { label: "vs Relevance AI", href: "/vs/relevance-ai" },
              { label: "vs Zapier", href: "/vs/zapier" },
              { label: "Lead Generation", href: "/use-cases/lead-gen" },
              { label: "Content Engine", href: "/use-cases/content-engine" },
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
