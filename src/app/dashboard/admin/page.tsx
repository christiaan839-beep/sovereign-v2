"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  DollarSign,
  Users,
  Activity,
  TrendingUp,
  BarChart3,
  Target,
  Sparkles,
  Crown,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

/* ─── Types ─── */

interface TopAgent {
  name: string;
  executions: number;
}

interface AnalyticsData {
  revenue: {
    activeSubscriptionsByPlan: Record<string, number>;
    estimatedMRR: number;
  };
  users: {
    total: number;
    last7Days: number;
    last30Days: number;
  };
  agents: {
    executions: {
      last24h: number;
      last7d: number;
      last30d: number;
    };
    topAgents: TopAgent[];
  };
  leads: {
    last30Days: number;
  };
  content: {
    generationsLast30Days: number;
  };
}

import { getPlanMrrUsd, PLANS } from "@/lib/plans";

/* ─── Helpers ─── */

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString()}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

/* ─── Skeleton Components ─── */

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-white/[0.06]" />
        <div className="h-3 w-24 rounded bg-white/[0.06]" />
      </div>
      <div className="h-8 w-32 rounded bg-white/[0.06] mb-2" />
      <div className="h-3 w-20 rounded bg-white/[0.06]" />
    </div>
  );
}

function SkeletonAgentList() {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 animate-pulse">
      <div className="h-4 w-40 rounded bg-white/[0.06] mb-6" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 mb-4">
          <div className="h-3 w-4 rounded bg-white/[0.06]" />
          <div className="h-3 flex-1 rounded bg-white/[0.06]" />
          <div className="h-3 w-12 rounded bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}

/* ─── Stat Card ─── */

interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: "emerald" | "cyan" | "violet" | "amber";
  delay?: number;
}

const COLOR_STYLES = {
  emerald: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
  },
  cyan: {
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
    text: "text-cyan-400",
  },
  violet: {
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    text: "text-violet-400",
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
  },
};

function StatCard({ label, value, subtitle, icon: Icon, color, delay = 0 }: StatCardProps) {
  const styles = COLOR_STYLES[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 hover:bg-white/[0.05] hover:border-white/10 transition-all"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2.5 rounded-xl ${styles.bg} border ${styles.border}`}>
          <Icon className={`w-4 h-4 ${styles.text}`} />
        </div>
        <span className="text-xs text-neutral-500 uppercase tracking-wider font-medium">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
      {subtitle && (
        <p className="text-[11px] text-neutral-500 mt-1">{subtitle}</p>
      )}
    </motion.div>
  );
}

/* ─── Top Agents Bar Chart ─── */

function TopAgentsList({ agents }: { agents: TopAgent[] }) {
  const maxExecutions = Math.max(...agents.map((a) => a.executions), 1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.4 }}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <Crown className="w-4 h-4 text-violet-400" />
        </div>
        <h3 className="text-sm font-semibold text-white">Top 5 Agents</h3>
      </div>
      <div className="space-y-3.5">
        {agents.slice(0, 5).map((agent, i) => {
          const pct = (agent.executions / maxExecutions) * 100;
          return (
            <div key={agent.name}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-neutral-500 w-4 text-right">
                    {i + 1}
                  </span>
                  <span className="text-xs text-neutral-300">{agent.name}</span>
                </div>
                <span className="text-xs font-mono text-violet-400">
                  {formatNumber(agent.executions)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.04] overflow-hidden ml-6">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: 0.5 + i * 0.08, duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400"
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

/* ─── Section Header ─── */

function SectionHeader({
  title,
  icon: Icon,
  color,
  delay = 0,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: "emerald" | "cyan" | "violet" | "amber";
  delay?: number;
}) {
  const styles = COLOR_STYLES[color];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="flex items-center gap-2.5 mb-4"
    >
      <Icon className={`w-4 h-4 ${styles.text}`} />
      <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
        {title}
      </h2>
    </motion.div>
  );
}

/* ─── Main Page ─── */

export default function AdminDashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) {
        throw new Error(`Failed to fetch analytics (${res.status})`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // ─── Computed Revenue ───
  const mrr = data
    ? data.revenue.estimatedMRR
    : 0;
  const arr = mrr * 12;
  const totalSubscriptions = data
    ? Object.values(data.revenue.activeSubscriptionsByPlan).reduce((sum, n) => sum + n, 0)
    : 0;
  const valuation = arr * 10;

  // ─── Error State ───
  if (error && !data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center"
        >
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 w-fit mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Failed to Load Analytics</h2>
          <p className="text-sm text-neutral-400 mb-6">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/[0.06] border border-white/[0.1] text-sm font-medium text-white hover:bg-white/[0.1] transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        {/* ─── Header ─── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-white/10">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Admin Command Center
              </h1>
              <p className="text-sm text-neutral-500">
                Platform-wide metrics and revenue
              </p>
            </div>
          </div>
        </motion.div>

        {loading ? (
          /* ─── Loading Skeleton ─── */
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <SkeletonCard key={`rev-${i}`} />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <SkeletonCard key={`user-${i}`} />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <SkeletonCard key={`agent-${i}`} />
              ))}
            </div>
            <SkeletonAgentList />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <SkeletonCard key={`cl-${i}`} />
              ))}
            </div>
          </div>
        ) : data ? (
          /* ─── Data Loaded ─── */
          <div className="space-y-10">
            {/* ─── Revenue Row ─── */}
            <section>
              <SectionHeader title="Revenue" icon={DollarSign} color="emerald" delay={0} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  label="MRR"
                  value={formatCurrency(mrr)}
                  subtitle={`${formatNumber(totalSubscriptions)} active subs`}
                  icon={DollarSign}
                  color="emerald"
                  delay={0.05}
                />
                <StatCard
                  label="ARR"
                  value={formatCurrency(arr)}
                  subtitle="Annualized recurring"
                  icon={TrendingUp}
                  color="emerald"
                  delay={0.1}
                />
                <StatCard
                  label="Active Subscriptions"
                  value={formatNumber(totalSubscriptions)}
                  subtitle={`${formatNumber(totalSubscriptions - (data.revenue.activeSubscriptionsByPlan.free || 0))} paid`}
                  icon={BarChart3}
                  color="emerald"
                  delay={0.15}
                />
                <StatCard
                  label="Valuation Estimate"
                  value={formatCurrency(valuation)}
                  subtitle="ARR x 10 multiple"
                  icon={Sparkles}
                  color="emerald"
                  delay={0.2}
                />
              </div>
            </section>

            {/* ─── User Growth ─── */}
            <section>
              <SectionHeader title="User Growth" icon={Users} color="cyan" delay={0.15} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard
                  label="Total Users"
                  value={formatNumber(data.users.total)}
                  icon={Users}
                  color="cyan"
                  delay={0.2}
                />
                <StatCard
                  label="New This Week"
                  value={formatNumber(data.users.last7Days)}
                  subtitle="Last 7 days"
                  icon={TrendingUp}
                  color="cyan"
                  delay={0.25}
                />
                <StatCard
                  label="New This Month"
                  value={formatNumber(data.users.last30Days)}
                  subtitle="Last 30 days"
                  icon={TrendingUp}
                  color="cyan"
                  delay={0.3}
                />
              </div>
            </section>

            {/* ─── Agent Usage ─── */}
            <section>
              <SectionHeader title="Agent Usage" icon={Activity} color="violet" delay={0.25} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                <StatCard
                  label="Executions (24h)"
                  value={formatNumber(data.agents.executions.last24h)}
                  icon={Activity}
                  color="violet"
                  delay={0.3}
                />
                <StatCard
                  label="Executions (7d)"
                  value={formatNumber(data.agents.executions.last7d)}
                  icon={Activity}
                  color="violet"
                  delay={0.35}
                />
                <StatCard
                  label="Executions (30d)"
                  value={formatNumber(data.agents.executions.last30d)}
                  icon={Activity}
                  color="violet"
                  delay={0.4}
                />
              </div>
              <TopAgentsList agents={data.agents.topAgents} />
            </section>

            {/* ─── Content & Leads ─── */}
            <section>
              <SectionHeader title="Content & Leads" icon={Target} color="amber" delay={0.35} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard
                  label="Leads Generated (30d)"
                  value={formatNumber(data.leads.last30Days)}
                  icon={Target}
                  color="amber"
                  delay={0.4}
                />
                <StatCard
                  label="Content Generated (30d)"
                  value={formatNumber(data.content.generationsLast30Days)}
                  icon={Sparkles}
                  color="amber"
                  delay={0.45}
                />
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
