"use client";

import { motion } from "framer-motion";
import { ArrowRight, FileText, DollarSign, Megaphone, Star, Shield, Database, Layers, Zap, MessageSquare, CheckCircle2 } from "lucide-react";
import Link from "next/link";

const CAPABILITIES = [
  {
    icon: FileText,
    title: "Product description generation",
    desc: "SEO-optimized, brand-voiced descriptions for every SKU in your catalog. Agents pull product specs, competitor positioning, and keyword data to write copy that ranks and converts.",
    color: "amber",
  },
  {
    icon: DollarSign,
    title: "Competitor price monitoring",
    desc: "Track thousands of SKUs across competitor storefronts in real time. Agents surface price changes, MAP violations, and margin opportunities before your competitors react.",
    color: "emerald",
  },
  {
    icon: Megaphone,
    title: "Ad copy optimization",
    desc: "ROAS-driven creative generation. Agents analyze top-performing ads, test headline variants, and draft copy calibrated to your audience segments and campaign objectives.",
    color: "violet",
  },
  {
    icon: Star,
    title: "Customer review analysis",
    desc: "Sentiment analysis across every review channel. Agents extract actionable insights, cluster complaints by theme, and surface product issues before they become return spikes.",
    color: "cyan",
  },
];

const WORKFLOWS = [
  {
    trigger: "\"Write descriptions for 50 new products in our catalog\"",
    steps: [
      "Agent ingests product specs, images, and category taxonomy from your catalog feed",
      "Pulls top-ranking competitor descriptions and target keywords for each SKU",
      "Generates SEO-optimized, brand-voiced copy tailored to each product\u0027s unique selling points",
      "Queues all 50 descriptions for review with one-click publish to your storefront",
    ],
    result: "50 product descriptions written in 6 minutes. Average keyword density +40% vs. old copy.",
  },
  {
    trigger: "\"Monitor competitor pricing on our top 100 SKUs\"",
    steps: [
      "Maps your top 100 SKUs to matching products across 8 competitor storefronts",
      "Pulls current pricing, stock status, and promotional flags for each match",
      "Flags 14 SKUs where competitors undercut your price by more than 10%",
      "Generates a repricing recommendation with projected margin impact per SKU",
    ],
    result: "14 pricing opportunities identified. Repricing recommendations ready in 3 minutes.",
  },
  {
    trigger: "\"Analyze reviews from last quarter and identify top complaints\"",
    steps: [
      "Aggregates 4,200 reviews from your storefront, Amazon, and social channels",
      "Runs sentiment analysis and clusters negative reviews by complaint theme",
      "Ranks top 5 complaint categories by frequency and revenue impact",
      "Drafts a product improvement brief with specific fixes for each issue",
    ],
    result: "Top 5 complaint themes identified from 4,200 reviews. Action brief delivered to product team.",
  },
];

export default function ForEcommercePage() {
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
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/[0.06] mb-6"
          >
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-[0.2em]">E-Commerce</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6"
          >
            Your AI<br />
            <span className="text-amber-400">commerce engine.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-neutral-400 max-w-xl mx-auto leading-relaxed mb-8"
          >
            130 agents handle your entire catalog at once. Voice agents handle customer inquiries 24/7.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-3"
          >
            <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
              Deploy commerce agents <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="py-16 px-6 border-y border-white/[0.03]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-amber-500/60 mb-4">Capabilities</p>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight mb-3">
              Automate the catalog. Focus on growth.
            </h2>
            <p className="text-sm text-neutral-500 max-w-lg mx-auto">
              Every task that slows your merchandising team — automated, verified, and ready to publish.
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
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-amber-500/60 mb-4">How It Works</p>
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
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] text-amber-500/60 uppercase tracking-wider font-semibold">You say</span>
                  </div>
                  <p className="text-sm text-white font-mono">{flow.trigger}</p>
                </div>

                {/* Steps */}
                <div className="px-6 py-4 space-y-2">
                  {flow.steps.map((step, j) => (
                    <div key={j} className="flex items-start gap-2.5 text-xs text-neutral-400">
                      <span className="text-amber-500/50 font-mono shrink-0 mt-0.5">{String(j + 1).padStart(2, "0")}</span>
                      {step}
                    </div>
                  ))}
                </div>

                {/* Result */}
                <div className="px-6 py-4 border-t border-white/[0.04] bg-amber-500/[0.02]">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300">{flow.result}</p>
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
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-amber-500/60 mb-4">Under The Hood</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Built for commerce-scale operations.
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Database, label: "Pinecone", desc: "Vector memory — semantic search across product catalogs and review data" },
              { icon: Layers, label: "Neon Postgres", desc: "Tenant-scoped relational store — catalog isolation per storefront" },
              { icon: Shield, label: "5-Layer Pipeline", desc: "Every output passes through brand voice, content policy, and quality guardrails" },
              { icon: Zap, label: "130 Agents", desc: "Full catalog processing — descriptions, pricing, reviews, and ads in parallel" },
            ].map((item) => (
              <div key={item.label} className="p-4 rounded-xl border border-white/[0.05] bg-white/[0.02]">
                <item.icon className="w-5 h-5 text-amber-400 mb-3" />
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
            Less manual work.<br />
            <span className="text-amber-400">More revenue.</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            Your team shouldn&apos;t spend half their day writing product descriptions.
            Deploy AI agents that handle the catalog so your team can focus on growth.
          </p>
          <Link href="/signup" className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all">
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
