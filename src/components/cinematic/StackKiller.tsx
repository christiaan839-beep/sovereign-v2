"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

/**
 * What-your-current-stack-costs vs Sovereign.
 *
 * Categories are anonymised by design — we don't run our positioning
 * by naming who else is in the room. Real teams who run a growth
 * function pay roughly the prices below for each *job*; Sovereign
 * collapses the same eight jobs into one platform, one bill, one
 * source of truth.
 *
 * If you want to know which specific tools the prices reflect, the
 * answer is: the public list price of the most popular paid tier in
 * each category. That's deliberately not in the UI.
 */
const STACK_JOBS = [
  { job: "Lead database & enrichment", price: 99 },
  { job: "Lead workflow & data shaping", price: 149 },
  { job: "AI long-form copy", price: 59 },
  { job: "SEO + competitive intel", price: 140 },
  { job: "Workflow automation", price: 49 },
  { job: "Sales sequencing", price: 100 },
  { job: "Visitor & data enrichment", price: 99 },
  { job: "Multi-step agent pipelines", price: 20 },
];

const SOVEREIGN_AGENTS = [
  { name: "Lead Hunter Agent", color: "emerald" },
  { name: "Lead Enrichment Agent", color: "emerald" },
  { name: "Content Writer Agent", color: "cyan" },
  { name: "SEO Intelligence Agent", color: "cyan" },
  { name: "Workflow Orchestrator", color: "violet" },
  { name: "Autonomous Outreach Agent", color: "violet" },
  { name: "Data Enrichment Agent", color: "emerald" },
  { name: "Pipeline Engine Agent", color: "cyan" },
];

export function StackKiller() {
  const stackTotal = STACK_JOBS.reduce((s, t) => s + t.price, 0);
  const sovereignPrice = 199;
  const monthly = stackTotal - sovereignPrice;
  const annual = monthly * 12;

  return (
    <section className="py-24 px-6 bg-[#030303] relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.006)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.006)_1px,transparent_1px)] bg-[size:80px_80px] pointer-events-none" />

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">
            One platform, one bill
          </p>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-[1.05] mb-4">
            Eight jobs.
            <br />
            <span className="text-emerald-400">One operating system.</span>
          </h2>
          <p className="text-neutral-400 text-sm max-w-lg mx-auto">
            A typical growth function pays for eight separate tools — one for
            sourcing, one for enrichment, one for copy, one for sequencing — and
            a person to glue them together. Sovereign runs all eight as one
            chained system, with the person replaced by an agent network.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_64px_1fr] gap-6 lg:gap-0 items-start">
          {/* ── Today's stack ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 mb-4 flex items-center gap-2">
              <XCircle className="w-3 h-3 text-red-500/50" />
              What an 8-job stack costs today
            </p>
            <div className="space-y-1.5">
              {STACK_JOBS.map((tool, i) => (
                <motion.div
                  key={tool.job}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-white/[0.04] bg-[#080808] group hover:border-red-500/10 transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1 h-1 rounded-full bg-neutral-700 shrink-0" />
                    <span className="text-sm text-neutral-400 group-hover:text-neutral-600 transition-colors truncate">
                      {tool.job}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-600 shrink-0 ml-2">
                    ${tool.price}/mo
                  </span>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-red-500/15 bg-red-500/[0.03] mt-3"
              >
                <span className="text-sm font-bold text-white">
                  Total — 8 line items
                </span>
                <span className="text-sm font-black font-mono text-red-400">
                  ${stackTotal}/month
                </span>
              </motion.div>
            </div>
          </div>

          {/* ── Arrow ── */}
          <div className="hidden lg:flex flex-col items-center justify-center pt-8 gap-3">
            <div className="w-px flex-1 bg-gradient-to-b from-transparent via-neutral-800 to-transparent max-h-24" />
            <div className="p-3 rounded-full border border-emerald-500/20 bg-emerald-500/[0.05]">
              <ArrowRight className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="w-px flex-1 bg-gradient-to-b from-transparent via-neutral-800 to-transparent max-h-24" />
          </div>

          {/* ── Sovereign side ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-emerald-500/50" />
              What Sovereign runs natively
            </p>
            <div className="space-y-1.5">
              {SOVEREIGN_AGENTS.map((agent, i) => (
                <motion.div
                  key={agent.name}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-emerald-500/[0.07] bg-emerald-500/[0.02]"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/60 shrink-0" />
                  <span className="text-sm text-neutral-300">{agent.name}</span>
                </motion.div>
              ))}

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] mt-3"
              >
                <div>
                  <span className="text-sm font-bold text-white">
                    Sovereign Node
                  </span>
                  <span className="ml-2 text-[10px] text-emerald-500/50">
                    +129 more agents included
                  </span>
                </div>
                <span className="text-sm font-black font-mono text-emerald-400">
                  ${sovereignPrice}/month
                </span>
              </motion.div>
            </div>
          </div>
        </div>

        {/* ── Stat strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-0 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.025] overflow-hidden"
        >
          {[
            {
              label: "Monthly margin reclaimed",
              value: `$${monthly.toLocaleString()}`,
              sub: "back in the bank",
              accent: true,
            },
            {
              label: "Annual margin reclaimed",
              value: `$${annual.toLocaleString()}`,
              sub: "compounds year over year",
              accent: false,
            },
            {
              label: "Line items on the bill",
              value: "1",
              sub: "down from 8",
              accent: false,
            },
            {
              label: "Integration time",
              value: "0 days",
              sub: "runs the day you sign in",
              accent: false,
            },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={`flex flex-col items-center justify-center p-6 text-center ${i < 3 ? "border-r border-emerald-500/10" : ""}`}
            >
              <div
                className={`text-2xl md:text-3xl font-black mb-1 ${stat.accent ? "text-emerald-400" : "text-white"}`}
              >
                {stat.value}
              </div>
              <div className="text-[10px] font-semibold text-neutral-400 mb-0.5">
                {stat.label}
              </div>
              <div className="text-[9px] text-neutral-700">{stat.sub}</div>
            </div>
          ))}
        </motion.div>

        <div className="mt-8 text-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all"
          >
            Move your stack to Sovereign <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="mt-3 text-xs text-neutral-700">
            Free tier included — cancel anything within 30 days
          </p>
        </div>
      </div>
    </section>
  );
}
