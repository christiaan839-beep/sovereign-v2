"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Brain, TrendingUp, Zap, Clock, CheckCircle, XCircle,
  BarChart3, Activity, Sparkles, RefreshCw, ArrowUpRight,
} from "lucide-react";
import Link from "next/link";

/* ─── Types ─── */

interface AgentStat {
  name: string;
  executions: number;
}

interface UsageData {
  plan: { name: string; runLimit: number };
  usage: {
    executions: { last24h: number; last7d: number; last30d: number; allTime: number };
    usagePercent: number;
    runsRemaining: number | string;
    topAgents: AgentStat[];
    leadsGenerated30d: number;
    contentGenerated30d: number;
  };
}

/* ─── Stat Card ─── */

function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color = "emerald",
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-5"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg border ${colorMap[color] || colorMap.emerald}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-neutral-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{typeof value === "number" ? value.toLocaleString() : value}</div>
      {subtitle && <div className="text-xs text-neutral-500 mt-1">{subtitle}</div>}
    </motion.div>
  );
}

/* ─── Main Page ─── */

export default function InsightsPage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/_misc/usage");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const executions = data?.usage?.executions;
  const topAgents = data?.usage?.topAgents || [];
  const plan = data?.plan;

  // Estimate hours saved (avg 15 min per task that would take a human)
  const hoursSaved = executions ? Math.round((executions.last30d * 15) / 60) : 0;

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Brain className="w-6 h-6 text-emerald-400" />
              Execution Intelligence
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              How your agents are performing across the platform
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-400 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* ─── Time Saved Banner ─── */}
        {hoursSaved > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="text-lg font-bold text-white">
                  ~{hoursSaved} hours saved this month
                </div>
                <div className="text-sm text-neutral-400">
                  Your agents completed {executions?.last30d.toLocaleString()} tasks that would take ~15 min each manually
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── KPI Grid ─── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Today"
            value={executions?.last24h ?? 0}
            subtitle="Agent executions"
            icon={Zap}
            color="emerald"
          />
          <StatCard
            label="This Week"
            value={executions?.last7d ?? 0}
            subtitle="Agent executions"
            icon={Activity}
            color="cyan"
          />
          <StatCard
            label="This Month"
            value={executions?.last30d ?? 0}
            subtitle="Agent executions"
            icon={BarChart3}
            color="violet"
          />
          <StatCard
            label="All Time"
            value={executions?.allTime ?? 0}
            subtitle="Total executions"
            icon={TrendingUp}
            color="amber"
          />
        </div>

        {/* ─── Two Column Layout ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Agents */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-6"
          >
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Most Active Agents
            </h3>
            {topAgents.length === 0 ? (
              <p className="text-sm text-neutral-500">No agent activity yet. Run your first agent to see data here.</p>
            ) : (
              <div className="space-y-3">
                {topAgents.slice(0, 8).map((agent, i) => (
                  <div key={agent.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-neutral-600 font-mono w-5">{i + 1}.</span>
                      <Link
                        href={`/dashboard/${agent.name}`}
                        className="text-sm text-neutral-300 hover:text-white transition-colors flex items-center gap-1"
                      >
                        {agent.name}
                        <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500/60"
                          style={{
                            width: `${Math.min(100, (agent.executions / (topAgents[0]?.executions || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-neutral-500 font-mono w-12 text-right">
                        {agent.executions}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Output Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-6"
          >
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-cyan-400" />
              Output This Month
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <span className="text-sm text-neutral-400">Leads Generated</span>
                <span className="text-lg font-bold text-white">{(data?.usage?.leadsGenerated30d ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <span className="text-sm text-neutral-400">Content Created</span>
                <span className="text-lg font-bold text-white">{(data?.usage?.contentGenerated30d ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-white/5">
                <span className="text-sm text-neutral-400">Plan Usage</span>
                <span className="text-lg font-bold text-white">{data?.usage?.usagePercent ?? 0}%</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-neutral-400">Runs Remaining</span>
                <span className="text-lg font-bold text-emerald-400">
                  {data?.usage?.runsRemaining === "unlimited" ? "Unlimited" : (data?.usage?.runsRemaining ?? 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Upgrade CTA if usage is high */}
            {(data?.usage?.usagePercent ?? 0) > 70 && plan?.name !== "enterprise" && (
              <Link
                href="/dashboard/billing"
                className="mt-4 block w-full text-center py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
              >
                Upgrade for More Runs
              </Link>
            )}
          </motion.div>
        </div>

        {/* ─── Recommendation ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-6"
        >
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-violet-400" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Link
              href="/dashboard/leads"
              className="p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
            >
              <div className="text-sm font-medium text-white group-hover:text-emerald-400 transition-colors">
                Find New Leads
              </div>
              <div className="text-xs text-neutral-500 mt-1">
                Discover qualified prospects in any niche
              </div>
            </Link>
            <Link
              href="/dashboard/blog-gen"
              className="p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
            >
              <div className="text-sm font-medium text-white group-hover:text-cyan-400 transition-colors">
                Generate Content
              </div>
              <div className="text-xs text-neutral-500 mt-1">
                SEO blog posts with real research data
              </div>
            </Link>
            <Link
              href="/dashboard/workflow-builder"
              className="p-4 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
            >
              <div className="text-sm font-medium text-white group-hover:text-violet-400 transition-colors">
                Build a Workflow
              </div>
              <div className="text-xs text-neutral-500 mt-1">
                Chain agents into automated pipelines
              </div>
            </Link>
          </div>
        </motion.div>

        {/* ─── Clock indicator ─── */}
        <div className="mt-6 text-center">
          <span className="text-xs text-neutral-600 flex items-center justify-center gap-1">
            <Clock className="w-3 h-3" />
            Data refreshes every page load
          </span>
        </div>
      </div>
    </div>
  );
}
