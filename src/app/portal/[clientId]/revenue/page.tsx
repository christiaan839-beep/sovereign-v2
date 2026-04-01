"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, use } from "react";

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface AgentRevenue {
  tool: string;
  month: string;
  executions: number;
}

interface MonthlyBreakdown {
  month: string;
  agents: { name: string; executions: number; color: string }[];
  total: number;
}

/* ═══════════════════════════════════════════
   Color palette for agents
   ═══════════════════════════════════════════ */

const AGENT_COLORS = [
  "bg-emerald-500",
  "bg-blue-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-teal-500",
];

const AGENT_TEXT_COLORS = [
  "text-emerald-400",
  "text-blue-400",
  "text-violet-400",
  "text-amber-400",
  "text-rose-400",
  "text-cyan-400",
  "text-pink-400",
  "text-teal-400",
];

const AGENT_BG_COLORS = [
  "bg-emerald-400/10",
  "bg-blue-400/10",
  "bg-violet-400/10",
  "bg-amber-400/10",
  "bg-rose-400/10",
  "bg-cyan-400/10",
  "bg-pink-400/10",
  "bg-teal-400/10",
];

/* ═══════════════════════════════════════════
   Revenue Page
   ═══════════════════════════════════════════ */

export default function RevenuePage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = use(params);
  const [data, setData] = useState<AgentRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [agencyName, setAgencyName] = useState("Your Agency");

  useEffect(() => {
    const stored = localStorage.getItem("sovereign_agency_name");
    if (stored) setAgencyName(stored);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `/api/portal/metrics?clientId=${encodeURIComponent(
            decodeURIComponent(clientId)
          )}`
        );
        const json = await res.json();
        if (json.success && json.metrics.revenueByAgent) {
          setData(json.metrics.revenueByAgent);
        }
      } catch {
        // Fallback — keep empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [clientId]);

  // Build a color map for agents
  const agentNames = [...new Set(data.map((d) => d.tool))];
  const colorMap = new Map<string, number>();
  agentNames.forEach((name, i) => colorMap.set(name, i % AGENT_COLORS.length));

  // Build monthly breakdown
  const monthMap = new Map<string, Map<string, number>>();
  for (const row of data) {
    if (!monthMap.has(row.month)) monthMap.set(row.month, new Map());
    const agents = monthMap.get(row.month)!;
    agents.set(row.tool, (agents.get(row.tool) || 0) + row.executions);
  }

  const months: MonthlyBreakdown[] = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, agents]) => {
      const agentList = [...agents.entries()].map(([name, executions]) => ({
        name,
        executions,
        color: AGENT_COLORS[colorMap.get(name) ?? 0],
      }));
      return {
        month,
        agents: agentList,
        total: agentList.reduce((s, a) => s + a.executions, 0),
      };
    });

  const maxTotal = Math.max(1, ...months.map((m) => m.total));

  // Agent totals for summary
  const agentTotals = new Map<string, number>();
  for (const row of data) {
    agentTotals.set(row.tool, (agentTotals.get(row.tool) || 0) + row.executions);
  }
  const sortedAgents = [...agentTotals.entries()].sort((a, b) => b[1] - a[1]);
  const grandTotal = sortedAgents.reduce((s, [, v]) => s + v, 0);

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      {/* ── Top Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#030303]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href={`/portal/${clientId}`}
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-semibold">Back to Dashboard</span>
          </Link>
          <div className="flex items-center gap-2 text-neutral-500 text-xs">
            <BarChart3 className="w-3.5 h-3.5" />
            Revenue Attribution
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-20 px-6 max-w-6xl mx-auto">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-3xl font-bold text-white mb-1">
            Revenue Attribution
          </h1>
          <p className="text-sm text-neutral-500">
            Agent executions by month — see which agents contribute the most
            value.
          </p>
        </motion.div>

        {loading ? (
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-20 bg-white/[0.03] rounded-2xl animate-pulse"
              />
            ))}
          </div>
        ) : months.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-24 text-neutral-600"
          >
            <BarChart3 className="w-12 h-12 mb-4 opacity-30" />
            <p className="text-sm">No revenue data available yet.</p>
            <p className="text-xs mt-1">
              As your agents execute tasks, attribution data will appear here.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ── Bar Chart ── */}
            <div className="lg:col-span-2">
              <div className="backdrop-blur-xl bg-white/[0.03] rounded-2xl border border-white/[0.06] p-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-6 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" /> Monthly Breakdown
                </h2>

                <div className="space-y-5">
                  {months.map((month, mi) => (
                    <motion.div
                      key={month.month}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: mi * 0.06 }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-mono text-neutral-400">
                          {formatMonth(month.month)}
                        </span>
                        <span className="text-xs text-neutral-500 font-mono">
                          {month.total.toLocaleString()} executions
                        </span>
                      </div>

                      {/* Stacked bar */}
                      <div className="h-8 rounded-lg overflow-hidden bg-white/[0.03] flex">
                        {month.agents.map((agent, ai) => {
                          const widthPct = (agent.executions / maxTotal) * 100;
                          return (
                            <motion.div
                              key={agent.name}
                              initial={{ width: 0 }}
                              animate={{ width: `${widthPct}%` }}
                              transition={{
                                delay: mi * 0.06 + ai * 0.03,
                                duration: 0.5,
                                ease: "easeOut",
                              }}
                              className={`${agent.color} relative group cursor-default`}
                              style={{ minWidth: widthPct > 0 ? "4px" : 0 }}
                              title={`${agent.name}: ${agent.executions}`}
                            >
                              {/* Tooltip on hover */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-black/90 text-[10px] text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                {agent.name}: {agent.executions}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-8 pt-6 border-t border-white/[0.06] flex flex-wrap gap-4">
                  {agentNames.map((name) => {
                    const idx = colorMap.get(name) ?? 0;
                    return (
                      <div key={name} className="flex items-center gap-2">
                        <div
                          className={`w-3 h-3 rounded-sm ${AGENT_COLORS[idx]}`}
                        />
                        <span className="text-xs text-neutral-400">{name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Agent Rankings ── */}
            <div className="space-y-6">
              <div className="backdrop-blur-xl bg-white/[0.03] rounded-2xl border border-white/[0.06] p-6">
                <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Top Agents
                </h2>

                <div className="space-y-3">
                  {sortedAgents.map(([name, total], i) => {
                    const idx = colorMap.get(name) ?? 0;
                    const pct =
                      grandTotal > 0
                        ? Math.round((total / grandTotal) * 100)
                        : 0;
                    return (
                      <motion.div
                        key={name}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg ${AGENT_BG_COLORS[idx]} flex items-center justify-center shrink-0`}
                          >
                            <Zap
                              className={`w-4 h-4 ${AGENT_TEXT_COLORS[idx]}`}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white truncate">
                              {name}
                            </p>
                            <p className="text-[10px] text-neutral-600">
                              {pct}% of total
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-mono font-bold text-white shrink-0 ml-2">
                          {total.toLocaleString()}
                        </span>
                      </motion.div>
                    );
                  })}
                </div>

                {sortedAgents.length === 0 && (
                  <p className="text-xs text-neutral-600 text-center py-4">
                    No agent data available.
                  </p>
                )}
              </div>

              {/* Total Card */}
              <div className="backdrop-blur-xl bg-gradient-to-br from-white/[0.03] to-violet-500/[0.03] rounded-2xl border border-white/[0.06] p-6">
                <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">
                  Total Executions
                </p>
                <p className="text-4xl font-bold font-mono text-white">
                  {grandTotal.toLocaleString()}
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  Across {agentNames.length} agent
                  {agentNames.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-6 text-center">
        <p className="text-[10px] text-neutral-600 uppercase tracking-[0.2em]">
          Powered by {agencyName}
        </p>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

function formatMonth(ym: string): string {
  try {
    const [year, month] = ym.split("-");
    const d = new Date(parseInt(year), parseInt(month) - 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  } catch {
    return ym;
  }
}
