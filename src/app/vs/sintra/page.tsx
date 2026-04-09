"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Minus, X } from "lucide-react";
import Link from "next/link";

const COMPARISON = [
  { feature: "Social media management", sovereign: true, competitor: true, note: "Both create and schedule social content" },
  { feature: "Copywriting", sovereign: true, competitor: true, note: "Both generate marketing copy" },
  { feature: "Lead generation + enrichment", sovereign: true, competitor: "partial" as const, note: "Sintra has basic lead tools, Sovereign has a full pipeline" },
  { feature: "Multi-model routing (36+ models)", sovereign: true, competitor: false, note: "Sintra uses a single model" },
  { feature: "Voice calling (AI)", sovereign: true, competitor: false, note: "Sintra doesn&apos;t make autonomous calls" },
  { feature: "Competitive analysis", sovereign: true, competitor: false, note: "No competitor scanning in Sintra" },
  { feature: "SEO intelligence", sovereign: true, competitor: false, note: "Sovereign scans competitor keywords and optimizes content" },
  { feature: "White-label for agencies", sovereign: true, competitor: false, note: "No white-label offering in Sintra" },
  { feature: "Named agent personalities", sovereign: "partial" as const, competitor: true, note: "Sintra&apos;s Soshie, Penn, Milli, Buddy are more personalized" },
  { feature: "Consensus verification (4 models)", sovereign: true, competitor: false, note: "No multi-model quality checking" },
  { feature: "Local/offline execution", sovereign: true, competitor: false, note: "Sintra is cloud-only" },
  { feature: "Multilingual support", sovereign: true, competitor: true, note: "Both support multiple languages" },
  { feature: "5-layer safety pipeline", sovereign: true, competitor: false, note: "Sovereign runs jailbreak, PII, content, quality, and critic checks" },
  { feature: "Workflow orchestration", sovereign: true, competitor: "partial" as const, note: "Sintra has basic chaining, Sovereign has full playbook orchestration" },
];

function Cell({ value }: { value: boolean | string }) {
  if (value === true) return <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />;
  if (value === false) return <X className="w-4 h-4 text-neutral-700 mx-auto" />;
  return <Minus className="w-4 h-4 text-amber-400/60 mx-auto" />;
}

export default function VsSintraPage() {
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
          Sovereign Matrix<br /><span className="text-neutral-500">vs Sintra</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
          className="text-neutral-400 max-w-xl mx-auto leading-relaxed">
          Sintra has built a friendly, approachable AI team.
          But if you need 130 agents with multi-model intelligence — not 12 named helpers — here&apos;s how we compare.
        </motion.p>
      </section>

      {/* Pricing callout */}
      <section className="px-6 pb-16">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl border border-white/[0.06] bg-[#080808] text-center">
            <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-2">Sintra X (All 12 Helpers)</p>
            <p className="text-3xl font-black text-white">$97<span className="text-sm text-neutral-500">/mo</span></p>
            <p className="text-xs text-neutral-600 mt-1">12 named AI employees with unlimited chat</p>
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
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 text-center">Sintra</span>
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
            Comparison based on publicly available information as of April 2026. Sintra is a trademark of Sintra AI.
          </p>
        </div>
      </section>

      {/* What Sintra does better */}
      <section className="px-6 pb-16">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-4 text-center">Where Sintra wins</h2>
          <p className="text-sm text-neutral-400 text-center max-w-lg mx-auto mb-6">
            We believe in honest comparisons. Here&apos;s where Sintra is genuinely stronger:
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { title: "Named agent personalities", desc: "Soshie, Penn, Milli, and Buddy each have distinct personalities. It makes the experience feel more human and approachable." },
              { title: "Unlimited chat usage", desc: "Sintra X includes unlimited conversations with all 12 helpers — no per-message or per-task limits." },
              { title: "Simpler UX", desc: "Sintra&apos;s interface is clean and beginner-friendly. You pick a helper, describe your task, and go." },
              { title: "Lower price point", desc: "At $97/mo for all 12 helpers, Sintra is more affordable if you need a smaller set of AI employees." },
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
              { title: "130 vs 12 agents", desc: "Sovereign covers leads, content, SEO, voice, competitive intel, code, analytics, and more — 10x the agent coverage." },
              { title: "Multi-model intelligence", desc: "36+ models across 6 providers with consensus verification. Sintra uses a single model for all tasks." },
              { title: "Full lead gen pipeline", desc: "End-to-end lead generation, enrichment, and outreach — not just chat-based suggestions." },
              { title: "Voice calling + white-label", desc: "AI voice calls and full white-label branding for agencies. Sintra offers neither." },
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
              { label: "vs Lindy", href: "/vs/lindy" },
              { label: "vs Clay", href: "/vs/clay" },
              { label: "vs Manus", href: "/vs/manus" },
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
