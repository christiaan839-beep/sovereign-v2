"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Minus, X } from "lucide-react";
import Link from "next/link";

const COMPARISON = [
  { feature: "Visual workflow builder", sovereign: "partial", competitor: true, note: "n8n&apos;s node-based editor is best-in-class. Sovereign has a playbook UI — functional, but not a visual canvas." },
  { feature: "AI agents that reason + plan", sovereign: true, competitor: false, note: "Sovereign agents decide their own steps. n8n executes predefined node sequences." },
  { feature: "Self-hostable", sovereign: true, competitor: true, note: "Both can run on your own infrastructure" },
  { feature: "400+ app connectors", sovereign: "partial", competitor: true, note: "n8n has 400+ integrations. Sovereign has 25+ and growing." },
  { feature: "Lead generation + enrichment", sovereign: true, competitor: false, note: "Sovereign has dedicated lead-gen agents. n8n requires you to build lead workflows from scratch." },
  { feature: "Content creation", sovereign: true, competitor: false, note: "Sovereign agents write, edit, and publish content end-to-end. n8n can trigger AI APIs but doesn&apos;t create content natively." },
  { feature: "AI voice calling", sovereign: true, competitor: false, note: "Built-in voice agents for outbound calls. n8n has no native voice capability." },
  { feature: "Multi-model routing (36+ models)", sovereign: true, competitor: false, note: "Sovereign routes tasks across 36+ models. n8n connects to one AI provider per node." },
  { feature: "Consensus verification (4 models)", sovereign: true, competitor: false, note: "Every output checked by 4 independent models. n8n has no multi-model verification." },
  { feature: "White-label for agencies", sovereign: true, competitor: false, note: "Full white-label support. n8n has no white-label offering." },
  { feature: "Competitive analysis", sovereign: true, competitor: false, note: "Built-in competitor scanning agents. n8n requires custom workflow builds." },
  { feature: "Email sequences", sovereign: true, competitor: "partial", note: "Sovereign has native email sequence agents. n8n can build email workflows via integrations." },
  { feature: "5-layer safety pipeline", sovereign: true, competitor: false, note: "Jailbreak, PII, content, quality, and critic checks on every output. n8n has no built-in safety pipeline." },
  { feature: "Open-source", sovereign: true, competitor: true, note: "Both are open-source. n8n uses a fair-code license; Sovereign&apos;s API is open." },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />;
  if (value === false) return <X className="w-4 h-4 text-neutral-700 mx-auto" />;
  return <Minus className="w-4 h-4 text-amber-400/60 mx-auto" />;
}

export default function VsN8nPage() {
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
          Sovereign Matrix<br /><span className="text-neutral-500">vs n8n</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-neutral-400 max-w-xl mx-auto leading-relaxed">
          n8n is a brilliant workflow automation tool. We genuinely respect what they&apos;ve built.
          But if you need agents that think and plan — not just workflows that follow rules — here&apos;s how we compare.
        </motion.p>
      </section>

      {/* Pricing callout */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl border border-white/[0.06] bg-[#080808] text-center">
            <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-2">n8n Cloud Starter</p>
            <p className="text-3xl font-black text-white">$20<span className="text-sm text-neutral-500">/mo</span></p>
            <p className="text-xs text-neutral-600 mt-1">Limited executions, basic features</p>
          </div>
          <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] text-center">
            <p className="text-[10px] text-emerald-500/60 uppercase tracking-widest mb-2">Sovereign Node</p>
            <p className="text-3xl font-black text-emerald-400">$199<span className="text-sm text-emerald-500/50">/mo</span></p>
            <p className="text-xs text-neutral-500 mt-1">130 agents + 36 models + everything below</p>
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
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 text-center">n8n</span>
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
            Comparison based on publicly available information as of April 2026. n8n is a registered trademark of n8n GmbH.
          </p>
        </div>
      </section>

      {/* What n8n does better */}
      <section className="px-6 pb-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-4 text-center">Where n8n wins</h2>
          <p className="text-sm text-neutral-400 text-center max-w-lg mx-auto mb-6">
            We believe in honest comparisons. Here&apos;s where n8n is genuinely stronger:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: "Visual workflow builder", desc: "n8n&apos;s node-based canvas is one of the best in the industry. You can see and control every step. Sovereign&apos;s playbook UI is functional, but it&apos;s not a visual canvas." },
              { title: "Self-hosting & control", desc: "n8n was built for self-hosting from day one. Full control over your data and infrastructure. Technical teams love this." },
              { title: "400+ integrations", desc: "n8n connects to over 400 apps out of the box. Sovereign has 25+ native integrations and is growing, but n8n&apos;s connector library is far larger today." },
              { title: "Community & ecosystem", desc: "A strong open-source community with thousands of shared workflow templates. Great for technical users who want to learn and build." },
              { title: "Fair pricing for automations", desc: "n8n Cloud starts at $20/mo. If you need workflow automation without AI agents, n8n offers excellent value." },
              { title: "Technical transparency", desc: "Every node is visible. Every data transformation is explicit. For engineers who want full control, n8n is hard to beat." },
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
              { title: "Agents that think, not just execute", desc: "Give a Sovereign agent a goal and it plans its own steps. n8n requires you to design every workflow node by node." },
              { title: "130 pre-built agents", desc: "Leads, content, SEO, voice calling, competitive analysis — ready to run. n8n starts with an empty canvas." },
              { title: "Multi-model intelligence", desc: "36+ models with consensus verification. Every output is checked by 4 independent models before delivery." },
              { title: "Built for non-technical users", desc: "Business teams run playbooks without designing workflows. n8n is powerful but requires technical knowledge to set up." },
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
              { label: "vs Make", href: "/vs/make" },
              { label: "vs Zapier", href: "/vs/zapier" },
              { label: "vs CrewAI", href: "/vs/crewai" },
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
