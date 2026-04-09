"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Minus, X } from "lucide-react";
import Link from "next/link";

const COMPARISON = [
  { feature: "Pre-built agents", sovereign: true, competitor: "partial", note: "Sovereign ships 130 ready-to-run agents; Relevance AI has ~10 templates — most are build-your-own" },
  { feature: "Multi-model routing (39+ models)", sovereign: true, competitor: false, note: "Sovereign routes across 39+ models dynamically; Relevance AI uses fewer model options" },
  { feature: "Consensus verification (4 models)", sovereign: true, competitor: false, note: "Every output checked by 4 independent models before delivery" },
  { feature: "SOC 2 Type II certified", sovereign: false, competitor: true, note: "Relevance AI is SOC 2 Type II certified; Sovereign is in progress" },
  { feature: "Content creation + SEO", sovereign: true, competitor: false, note: "End-to-end content pipeline with SEO intelligence; not a Relevance AI focus" },
  { feature: "Voice calling (AI)", sovereign: true, competitor: false, note: "Sovereign makes autonomous voice calls; Relevance AI does not" },
  { feature: "Lead enrichment", sovereign: true, competitor: true, note: "Both platforms offer lead enrichment capabilities" },
  { feature: "CRM integration", sovereign: true, competitor: true, note: "Both integrate with HubSpot, Salesforce, and major CRMs" },
  { feature: "White-label for agencies", sovereign: true, competitor: false, note: "Sovereign offers full white-label; Relevance AI does not" },
  { feature: "Transparent pricing", sovereign: true, competitor: false, note: "$199/mo published pricing vs custom/opaque enterprise quotes" },
  { feature: "Local / offline execution", sovereign: true, competitor: false, note: "Run locally via Ollama for full data control; Relevance AI is cloud-only" },
  { feature: "5-layer safety pipeline", sovereign: true, competitor: "partial", note: "Sovereign runs jailbreak, PII, content, quality, and critic checks; Relevance AI has enterprise evals" },
  { feature: "Workflow automation", sovereign: true, competitor: true, note: "Both platforms automate multi-step workflows" },
  { feature: "GTM focus", sovereign: true, competitor: true, note: "Both platforms are built for go-to-market teams" },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />;
  if (value === false) return <X className="w-4 h-4 text-neutral-700 mx-auto" />;
  return <Minus className="w-4 h-4 text-amber-400/60 mx-auto" />;
}

export default function VsRelevanceAiPage() {
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
          Sovereign Matrix<br /><span className="text-neutral-500">vs Relevance AI</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-neutral-400 max-w-xl mx-auto leading-relaxed">
          Relevance AI has built an impressive enterprise GTM platform. We respect what they&apos;ve achieved.
          But if you need pre-built agents with transparent pricing — not build-your-own with custom quotes — here&apos;s how we compare.
        </motion.p>
      </section>

      {/* Pricing callout */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl border border-white/[0.06] bg-[#080808] text-center">
            <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-2">Relevance AI</p>
            <p className="text-3xl font-black text-white">Custom</p>
            <p className="text-xs text-neutral-600 mt-1">Enterprise pricing (not publicly listed)</p>
          </div>
          <div className="p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] text-center">
            <p className="text-[10px] text-emerald-500/60 uppercase tracking-widest mb-2">Sovereign Node</p>
            <p className="text-3xl font-black text-emerald-400">$199<span className="text-sm text-emerald-500/50">/mo</span></p>
            <p className="text-xs text-neutral-500 mt-1">130 agents + 36 models + transparent pricing</p>
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
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 text-center">Relevance</span>
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
            Comparison based on publicly available information as of April 2026. Relevance AI is a trademark of Relevance AI Pty Ltd.
          </p>
        </div>
      </section>

      {/* What Relevance AI does better */}
      <section className="px-6 pb-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-4 text-center">Where Relevance AI wins</h2>
          <p className="text-sm text-neutral-400 text-center max-w-lg mx-auto mb-6">
            We believe in honest comparisons. Here&apos;s where Relevance AI is genuinely stronger:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: "SOC 2 Type II certified", desc: "Relevance AI has achieved SOC 2 Type II certification. Enterprise buyers who require this have a clear compliance path." },
              { title: "Enterprise governance", desc: "Four autonomy levels (Assisted, Copilot, Autopilot, Self-Driving) give enterprises a gradual ramp from human-in-the-loop to full autonomy." },
              { title: "100+ integrations", desc: "Deep integrations with HubSpot, Salesforce, and 100+ enterprise tools built for large GTM team workflows." },
              { title: "Gradual autonomy ramp", desc: "Enterprises can start with assisted mode and increase agent autonomy over time as trust builds. A thoughtful approach to adoption." },
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
              { title: "130 pre-built agents", desc: "Not build-your-own. 130 purpose-built agents for leads, content, SEO, voice, competitive intel, and more — ready to run immediately." },
              { title: "Multi-model consensus", desc: "39+ models with consensus verification. Every output is checked by 4 independent models. Relevance AI doesn't offer multi-model routing." },
              { title: "Transparent pricing", desc: "Published $199/mo. No sales calls, no custom quotes, no surprises. You see exactly what you pay before you sign up." },
              { title: "Local execution + white-label", desc: "Run locally via Ollama for full data control. White-label the entire platform for your agency clients." },
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
              { label: "vs Clay", href: "/vs/clay" },
              { label: "vs HubSpot", href: "/vs/hubspot" },
              { label: "vs Lindy", href: "/vs/lindy" },
              { label: "Lead Generation", href: "/use-cases/lead-gen" },
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
