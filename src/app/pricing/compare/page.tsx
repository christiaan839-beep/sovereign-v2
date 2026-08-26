"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Minus, X } from "lucide-react";
import Link from "next/link";

type CellValue = true | false | "partial" | string;

interface Platform {
  name: string;
  price: string;
  highlighted?: boolean;
}

interface ComparisonRow {
  feature: string;
  values: CellValue[];
}

const PLATFORMS: Platform[] = [
  { name: "Sovereign Matrix", price: "$199/mo", highlighted: true },
  { name: "HubSpot", price: "$890/mo" },
  { name: "Clay", price: "$149/mo" },
  { name: "Zapier", price: "$49/mo" },
  { name: "Sintra", price: "$97/mo" },
  { name: "n8n", price: "$20/mo" },
];

const COMPARISON: ComparisonRow[] = [
  {
    feature: "Monthly price",
    values: ["$199", "$890", "$149", "$49", "$97", "$20"],
  },
  {
    feature: "Pricing model",
    values: ["Flat", "Credit-based", "Credit-based", "Task-limited", "Credit-limited", "Op-limited"],
  },
  {
    feature: "AI agents",
    values: ["130", "~5 assistants", "0 (enrichment only)", "0 (automation)", "12", "0 (workflows)"],
  },
  {
    feature: "AI models",
    values: ["39+", "1 (OpenAI)", "0", "0", "1", "0"],
  },
  {
    feature: "Multi-model consensus",
    values: [true, false, false, false, false, false],
  },
  {
    feature: "Lead generation",
    values: [true, true, false, false, "partial", false],
  },
  {
    feature: "Content creation",
    values: [true, "partial", false, false, true, false],
  },
  {
    feature: "SEO intelligence",
    values: [true, "partial", false, false, false, false],
  },
  {
    feature: "AI voice calling",
    values: [true, false, false, false, false, false],
  },
  {
    feature: "Competitive analysis",
    values: [true, false, false, false, false, false],
  },
  {
    feature: "Workflow automation",
    values: [true, true, true, true, "partial", true],
  },
  {
    feature: "CRM built-in",
    values: ["partial", true, false, false, false, false],
  },
  {
    feature: "White-label",
    values: [true, false, false, false, false, false],
  },
  {
    feature: "Local execution",
    values: [true, false, false, false, false, true],
  },
  {
    feature: "Safety pipeline",
    values: ["5-layer", "Basic", "None", "None", "None", "None"],
  },
  {
    feature: "App integrations",
    values: ["25+", "1,600+", "100+", "7,000+", "100+", "400+"],
  },
];

function Cell({ value, isHighlighted }: { value: CellValue; isHighlighted?: boolean }) {
  if (value === true)
    return <CheckCircle2 className={`w-4 h-4 mx-auto ${isHighlighted ? "text-emerald-400" : "text-emerald-400/60"}`} />;
  if (value === false)
    return <X className="w-4 h-4 text-neutral-700 mx-auto" />;
  if (value === "partial")
    return <Minus className="w-4 h-4 text-amber-400/60 mx-auto" />;
  // String value
  return (
    <span className={`text-xs text-center block ${isHighlighted ? "text-emerald-300 font-semibold" : "text-neutral-400"}`}>
      {value}
    </span>
  );
}

export default function PricingComparePage() {
  return (
    <div className="min-h-screen bg-[#010101] text-white">
      {/* Nav */}
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-7xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">
          Sovereign Matrix
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/pricing"
            className="text-xs text-neutral-400 hover:text-white transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2 rounded-full bg-white text-xs font-semibold text-black hover:bg-neutral-200 transition-colors"
          >
            Try Free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-20 px-6 text-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4"
        >
          The Definitive Comparison
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl md:text-6xl font-black tracking-tight mb-6"
        >
          Every platform. One table.
          <br />
          <span className="text-neutral-500">Your decision.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-neutral-400 max-w-xl mx-auto leading-relaxed"
        >
          We put all the numbers in one place so you don&apos;t have to.
          Side-by-side pricing and features across 6 platforms.
        </motion.p>
      </section>

      {/* Price cards */}
      <section className="px-6 pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {PLATFORMS.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`p-4 rounded-xl text-center ${
                p.highlighted
                  ? "border border-emerald-500/30 bg-emerald-500/[0.04]"
                  : "border border-white/[0.06] bg-[#080808]"
              }`}
            >
              <p
                className={`text-[10px] uppercase tracking-widest mb-2 ${
                  p.highlighted ? "text-emerald-500/70" : "text-neutral-600"
                }`}
              >
                {p.name}
              </p>
              <p
                className={`text-xl font-black ${
                  p.highlighted ? "text-emerald-400" : "text-white"
                }`}
              >
                {p.price}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Comparison table */}
      <section className="px-6 pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl border border-white/[0.06] bg-[#080808] overflow-hidden">
            {/* Scrollable wrapper for mobile */}
            <div className="overflow-x-auto">
              <div className="min-w-[700px]">
                {/* Header */}
                <div className="grid grid-cols-[180px_repeat(6,1fr)] px-4 py-4 border-b border-white/[0.06] bg-[#060606]">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    Feature
                  </span>
                  {PLATFORMS.map((p) => (
                    <span
                      key={p.name}
                      className={`text-[10px] font-bold uppercase tracking-widest text-center ${
                        p.highlighted ? "text-emerald-400" : "text-neutral-500"
                      }`}
                    >
                      {p.name}
                    </span>
                  ))}
                </div>

                {/* Rows */}
                {COMPARISON.map((row, i) => (
                  <motion.div
                    key={row.feature}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.03 }}
                    className="grid grid-cols-[180px_repeat(6,1fr)] px-4 py-3.5 border-b border-white/[0.03] hover:bg-white/[0.01] transition-colors items-center"
                  >
                    <span className="text-sm text-neutral-300">{row.feature}</span>
                    {row.values.map((val, j) => (
                      <div key={`${row.feature}-${j}`} className="flex items-center justify-center">
                        <Cell value={val} isHighlighted={j === 0} />
                      </div>
                    ))}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] text-neutral-700 mt-4">
            Comparison based on publicly available pricing pages as of April 2026.
            All trademarks belong to their respective owners.
          </p>
        </div>
      </section>

      {/* Sovereign advantages */}
      <section className="px-6 pb-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-3 text-center">
            What sets Sovereign apart
          </h2>
          <p className="text-sm text-neutral-400 text-center max-w-lg mx-auto mb-8">
            Every platform on this list does something well. Here&apos;s where
            Sovereign occupies a category of one.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                title: "140 purpose-built agents",
                desc: "Not templates. Not prompts. Autonomous agents that plan multi-step workflows, self-correct, and deliver finished outputs.",
              },
              {
                title: "39+ models, 4-model consensus",
                desc: "Every critical output is generated, critiqued, and revised by independent models before you see it. No other platform does this.",
              },
              {
                title: "5-layer safety pipeline",
                desc: "Jailbreak detection, PII scrubbing, content filtering, quality scoring, and critic review run on every execution. Zero trust by default.",
              },
              {
                title: "Flat pricing, no credit traps",
                desc: "One price. All agents. All models. No per-task fees, no credit packs that run out mid-campaign, no surprise overages.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="p-5 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02]"
              >
                <h3 className="text-sm font-semibold text-emerald-400 mb-1">
                  {item.title}
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Honest concessions */}
      <section className="px-6 pb-24">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-white mb-3 text-center">
            Where others win
          </h2>
          <p className="text-sm text-neutral-400 text-center max-w-lg mx-auto mb-8">
            Honest comparisons build trust. Here&apos;s where specific competitors have a genuine edge.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                platform: "HubSpot",
                edge: "Mature CRM with 15+ years of pipeline refinement and 1,600+ integrations.",
              },
              {
                platform: "Zapier",
                edge: "7,000+ app integrations. The largest automation connector ecosystem available.",
              },
              {
                platform: "n8n",
                edge: "Self-hosted and open source. Full control over data and infrastructure at $20/mo.",
              },
              {
                platform: "Clay",
                edge: "Purpose-built for B2B data enrichment with waterfall lookups across 75+ providers.",
              },
              {
                platform: "Sintra",
                edge: "Friendly chat-based UI. Lower learning curve for non-technical users.",
              },
              {
                platform: "All of them",
                edge: "More time in market. Sovereign is newer — and we ship faster because of it.",
              },
            ].map((item) => (
              <div
                key={item.platform}
                className="p-5 rounded-xl border border-white/[0.05] bg-white/[0.01]"
              >
                <h3 className="text-sm font-semibold text-white mb-1">
                  {item.platform}
                </h3>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  {item.edge}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center border-t border-white/[0.03]">
        <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
          Still not sure?
        </h2>
        <p className="text-neutral-400 mb-6 max-w-md mx-auto text-sm">
          Try a free competitor scan. See real agent output on your actual competitors.
          No signup required.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/free/competitor-scan"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all"
          >
            Try a Free Competitor Scan <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/pricing"
            className="px-8 py-4 rounded-full text-sm font-semibold text-neutral-300 border border-white/[0.1] hover:border-white/[0.2] hover:text-white transition-all"
          >
            View pricing plans
          </Link>
        </div>
      </section>
    </div>
  );
}
