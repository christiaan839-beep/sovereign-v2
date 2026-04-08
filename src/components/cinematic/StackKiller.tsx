"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

// Real competitor pricing (publicly listed at time of writing)
const OLD_TOOLS = [
  { name: "Apollo.io",    function: "Lead database & enrichment",    price: 99 },
  { name: "Clay",         function: "Lead enrichment & workflows",    price: 149 },
  { name: "Jasper",       function: "AI content writing",             price: 59 },
  { name: "SEMrush",      function: "SEO & competitive intelligence", price: 140 },
  { name: "Zapier",       function: "Workflow automation",            price: 49 },
  { name: "Outreach.io",  function: "Sales sequencing",               price: 100 },
  { name: "Clearbit",     function: "Visitor & data enrichment",      price: 99 },
  { name: "n8n Cloud",    function: "Complex agent pipelines",        price: 20 },
];

const SOVEREIGN_AGENTS = [
  { name: "Lead Hunter Agent",         color: "emerald" },
  { name: "Lead Enrichment Agent",     color: "emerald" },
  { name: "Content Writer Agent",      color: "cyan" },
  { name: "SEO Intelligence Agent",    color: "cyan" },
  { name: "Workflow Orchestrator",     color: "violet" },
  { name: "Autonomous Outreach Agent", color: "violet" },
  { name: "Data Enrichment Agent",     color: "emerald" },
  { name: "Pipeline Engine Agent",     color: "cyan" },
];

export function StackKiller() {
  const stackTotal = OLD_TOOLS.reduce((s, t) => s + t.price, 0);
  const sovereignPrice = 199;
  const monthly = stackTotal - sovereignPrice;
  const annual = monthly * 12;

  return (
    <section className="py-24 px-6 bg-[#030303] relative overflow-hidden">
      {/* Background grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.006)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.006)_1px,transparent_1px)] bg-[size:80px_80px] pointer-events-none" />

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Stack Replacement</p>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-[1.05] mb-4">
            Cancel 8 tools.<br />
            <span className="text-emerald-400">Keep one.</span>
          </h2>
          <p className="text-neutral-400 text-sm max-w-lg mx-auto">
            The average growth team runs 8+ disconnected tools that don&apos;t share data,
            can&apos;t chain tasks, and need a human to operate them.
            Sovereign replaces every one — and chains them automatically.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_64px_1fr] gap-6 lg:gap-0 items-start">

          {/* ── OLD STACK ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 mb-4 flex items-center gap-2">
              <XCircle className="w-3 h-3 text-red-500/50" />
              What you&apos;re paying now
            </p>
            <div className="space-y-1.5">
              {OLD_TOOLS.map((tool, i) => (
                <motion.div
                  key={tool.name}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-white/[0.04] bg-[#080808] group hover:border-red-500/10 transition-all"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1 h-1 rounded-full bg-neutral-700 shrink-0" />
                    <span className="text-sm text-neutral-400 group-hover:text-neutral-600 transition-colors truncate">{tool.name}</span>
                    <span className="text-[10px] text-neutral-700 hidden sm:block truncate">{tool.function}</span>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-600 shrink-0 ml-2">${tool.price}/mo</span>
                </motion.div>
              ))}

              {/* Old stack total */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-red-500/15 bg-red-500/[0.03] mt-3"
              >
                <span className="text-sm font-bold text-white">Total — 8 tools</span>
                <span className="text-sm font-black font-mono text-red-400">${stackTotal}/month</span>
              </motion.div>
            </div>
          </div>

          {/* ── ARROW ── */}
          <div className="hidden lg:flex flex-col items-center justify-center pt-8 gap-3">
            <div className="w-px flex-1 bg-gradient-to-b from-transparent via-neutral-800 to-transparent max-h-24" />
            <div className="p-3 rounded-full border border-emerald-500/20 bg-emerald-500/[0.05]">
              <ArrowRight className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="w-px flex-1 bg-gradient-to-b from-transparent via-neutral-800 to-transparent max-h-24" />
          </div>

          {/* ── SOVEREIGN STACK ── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/60 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-emerald-500/50" />
              What Sovereign provides
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

              {/* Sovereign total */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-between px-4 py-3 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] mt-3"
              >
                <div>
                  <span className="text-sm font-bold text-white">Sovereign Node</span>
                  <span className="ml-2 text-[10px] text-emerald-500/50">+122 more agents included</span>
                </div>
                <span className="text-sm font-black font-mono text-emerald-400">${sovereignPrice}/month</span>
              </motion.div>
            </div>
          </div>
        </div>

        {/* ── SAVINGS CALLOUT ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-0 rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.025] overflow-hidden"
        >
          {[
            { label: "Monthly savings",  value: `$${monthly.toLocaleString()}`,  sub: "vs old stack",     accent: true },
            { label: "Annual savings",   value: `$${annual.toLocaleString()}`,   sub: "straight to margin", accent: false },
            { label: "Tools replaced",   value: "8",                             sub: "fewer logins",     accent: false },
            { label: "Integration time", value: "0 days",                        sub: "runs out of the box", accent: false },
          ].map((stat, i) => (
            <div key={stat.label}
              className={`flex flex-col items-center justify-center p-6 text-center ${i < 3 ? "border-r border-emerald-500/10" : ""}`}>
              <div className={`text-2xl md:text-3xl font-black mb-1 ${stat.accent ? "text-emerald-400" : "text-white"}`}>
                {stat.value}
              </div>
              <div className="text-[10px] font-semibold text-neutral-400 mb-0.5">{stat.label}</div>
              <div className="text-[9px] text-neutral-700">{stat.sub}</div>
            </div>
          ))}
        </motion.div>

        <div className="mt-8 text-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-100 transition-all"
          >
            Start replacing your stack <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="mt-3 text-xs text-neutral-700">Free tier included — cancel anything within 30 days</p>
        </div>
      </div>
    </section>
  );
}
