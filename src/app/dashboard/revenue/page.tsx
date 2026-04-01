"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  DollarSign, TrendingUp, Link2, Percent, ChevronRight,
  Search, FileText, Target, Mail, Mic, BarChart3, Globe2,
} from "lucide-react";

const STATS = [
  { label: "Total Revenue Attributed", value: "$0", icon: DollarSign, color: "emerald" },
  { label: "Avg Deal Size", value: "$0", icon: TrendingUp, color: "cyan" },
  { label: "Active Attribution Chains", value: "0", icon: Link2, color: "amber" },
  { label: "Conversion Rate", value: "—", icon: Percent, color: "emerald" },
];

const AGENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "SEO Agent": Search, "Content Agent": FileText, "Lead Gen": Target,
  "Email": Mail, "Voice": Mic, "Market Intel": Globe2,
  "Blog Gen": FileText, "Outbound": TrendingUp, "Email Sequence": Mail,
  "Voice Closer": Mic,
};

const CHAINS = [
  {
    id: 1, revenue: 12500, status: "Closed Won", date: "Mar 12",
    steps: ["SEO Agent", "Content Agent", "Lead Gen", "Email", "Voice"],
  },
  {
    id: 2, revenue: 8200, status: "Closed Won", date: "Mar 18",
    steps: ["Market Intel", "Blog Gen", "Outbound", "Email"],
  },
  {
    id: 3, revenue: 23400, status: "Closed Won", date: "Mar 24",
    steps: ["Lead Gen", "Email Sequence", "Voice Closer"],
  },
];

const AGENT_REVENUE = [
  { name: "Lead Gen", revenue: 35900, deals: 2, color: "#34d399" },
  { name: "Email / Email Sequence", revenue: 44100, deals: 3, color: "#22d3ee" },
  { name: "Voice / Voice Closer", revenue: 35900, deals: 2, color: "#f59e0b" },
  { name: "SEO Agent", revenue: 12500, deals: 1, color: "#818cf8" },
  { name: "Content Agent", revenue: 12500, deals: 1, color: "#f472b6" },
  { name: "Blog Gen", revenue: 8200, deals: 1, color: "#a78bfa" },
  { name: "Market Intel", revenue: 8200, deals: 1, color: "#fb923c" },
  { name: "Outbound", revenue: 8200, deals: 1, color: "#38bdf8" },
];

const maxRevenue = Math.max(...AGENT_REVENUE.map((a) => a.revenue));

export default function RevenuePage() {
  const [expandedChain, setExpandedChain] = useState<number | null>(null);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-3">
          <DollarSign className="w-3 h-3" /> Revenue Attribution
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Revenue Attribution Dashboard</h1>
        <p className="text-sm text-neutral-500 mt-1">Trace the full agent chain from first touch to closed revenue</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATS.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className="w-3.5 h-3.5 text-neutral-500" />
              <span className="text-[10px] text-neutral-500 uppercase tracking-widest">{stat.label}</span>
            </div>
            <div className="text-xl font-bold text-white">{stat.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Attribution Chains */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-neutral-300">Attribution Chains</h2>
        {CHAINS.map((chain, ci) => {
          const isOpen = expandedChain === chain.id;
          return (
            <motion.div key={chain.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: ci * 0.08 }}
              onClick={() => setExpandedChain(isOpen ? null : chain.id)}
              className={`rounded-xl border bg-[#0A0A0A] overflow-hidden cursor-pointer transition-colors ${isOpen ? "border-emerald-500/30" : "border-white/[0.06] hover:border-white/[0.12]"}`}>
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Link2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">Chain #{chain.id}</div>
                    <div className="text-[10px] text-neutral-500">{chain.date} &middot; {chain.steps.length} agents &middot; {chain.status}</div>
                  </div>
                </div>
                <span className="text-lg font-bold text-emerald-400 shrink-0">${chain.revenue.toLocaleString()}</span>
              </div>

              {/* Chain visualization */}
              <div className="px-5 pb-5">
                <div className="flex items-center gap-1 flex-wrap">
                  {chain.steps.map((step, si) => {
                    const Icon = AGENT_ICON[step] || Target;
                    return (
                      <div key={si} className="flex items-center gap-1">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                          <Icon className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-xs text-neutral-300 whitespace-nowrap">{step}</span>
                        </div>
                        {si < chain.steps.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-neutral-500 shrink-0" />}
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-1">
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <span className="text-xs font-semibold text-emerald-400">${chain.revenue.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Revenue by Agent */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-xl border border-white/[0.06] bg-[#0A0A0A] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.04] flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-neutral-500" />
          <span className="text-sm font-semibold text-white">Revenue by Agent</span>
        </div>
        <div className="divide-y divide-white/[0.03]">
          {AGENT_REVENUE.map((agent) => (
            <div key={agent.name} className="px-5 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-colors">
              <span className="text-xs text-neutral-300 w-44 shrink-0 truncate">{agent.name}</span>
              <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(agent.revenue / maxRevenue) * 100}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="h-full rounded-full" style={{ backgroundColor: agent.color }} />
              </div>
              <span className="text-xs font-semibold text-white w-20 text-right">${agent.revenue.toLocaleString()}</span>
              <span className="text-[10px] text-neutral-500 w-16 text-right">{agent.deals} deal{agent.deals > 1 ? "s" : ""}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
