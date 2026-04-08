"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Activity, BarChart3, Zap, TrendingUp, Clock,
  ArrowUpRight, Cpu, Sparkles,
} from "lucide-react";
import Link from "next/link";

/* ── Types ── */

interface DailyUsage {
  date: string;
  count: number;
}

interface TopAgent {
  name: string;
  count: number;
}

interface UsageData {
  plan: string;
  used: number;
  limit: number;
  dailyUsage: DailyUsage[];
  topAgents: TopAgent[];
}

/* ── Constants ── */

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Free",
  pro: "Pro",
  node: "Sovereign Node",
  array: "Growth",
  enterprise: "Enterprise",
};

const HOURS_PER_RUN = 0.4; // estimated manual hours saved per agent run

/* ── Component ── */

export default function UsageDashboard() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const results = await Promise.allSettled([
          fetch("/api/agents/dashboard-stats").then((r) => r.json()).then((d) => ({
            plan: "free", isPaid: false, limit: 100, agentExecutions: d.stats?.agentExecutions || 0,
          })),
          fetch("/api/audit-logs?action=agent.execute&since=30d")
            .then((r) => r.json()),
        ]);
        const planRes = results[0].status === "fulfilled" ? results[0].value : { plan: "free", isPaid: false, limit: 100, agentExecutions: 0 };
        const logsRes = results[1].status === "fulfilled" ? results[1].value : { logs: [] };

        const plan = planRes.plan || "free";
        const logs: Array<{ resource?: string; createdAt?: string }> = logsRes.logs || [];

        // Build daily usage for last 7 days
        const now = new Date();
        const dailyMap = new Map<string, number>();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          dailyMap.set(key, 0);
        }
        // Count agent executions by agent name
        const agentCounts = new Map<string, number>();
        for (const log of logs) {
          if (log.createdAt) {
            const dayKey = log.createdAt.slice(0, 10);
            if (dailyMap.has(dayKey)) {
              dailyMap.set(dayKey, (dailyMap.get(dayKey) ?? 0) + 1);
            }
          }
          if (log.resource) {
            agentCounts.set(log.resource, (agentCounts.get(log.resource) ?? 0) + 1);
          }
        }

        const dailyUsage = Array.from(dailyMap.entries()).map(([date, count]) => ({ date, count }));
        const topAgents = Array.from(agentCounts.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8);

        const limit =
          plan === "enterprise" ? Infinity :
          plan === "pro" ? 5000 :
          plan === "array" ? 10000 :
          plan === "node" ? 2000 : 100;

        setData({
          plan,
          used: logs.length,
          limit,
          dailyUsage,
          topAgents,
        });
      } catch {
        // Fail gracefully
      }
      setLoading(false);
    }
    fetchUsage();
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-4 lg:p-8 space-y-6">
        <div className="h-8 w-48 bg-white/5 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto p-4 lg:p-8">
        <p className="text-neutral-400">Unable to load usage data. Please try again.</p>
      </div>
    );
  }

  const usagePercent = data.limit === Infinity ? 5 : Math.min(100, (data.used / data.limit) * 100);
  const hoursSaved = Math.round(data.used * HOURS_PER_RUN);
  const isFreeTier = data.plan === "free" || data.plan === "starter";
  const maxDaily = Math.max(...data.dailyUsage.map((d) => d.count), 1);
  const planLabel = PLAN_LABELS[data.plan] || data.plan;

  return (
    <div className="max-w-5xl mx-auto space-y-8 p-4 lg:p-8">
      {/* Header */}
      <header className="pb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Usage</h1>
            <p className="text-sm text-neutral-500">Monitor your agent activity and resource consumption</p>
          </div>
        </div>
      </header>

      {/* Top stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Current Plan */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
          <div className="flex items-center gap-2 text-neutral-400 text-xs uppercase tracking-wider mb-3">
            <Zap className="w-3.5 h-3.5" />
            Current Plan
          </div>
          <p className="text-2xl font-bold text-white">{planLabel}</p>
          <p className="text-sm text-neutral-500 mt-1">
            {data.limit === Infinity ? "Unlimited runs" : `${data.limit.toLocaleString()} runs/month`}
          </p>
        </div>

        {/* Usage This Month */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
          <div className="flex items-center gap-2 text-neutral-400 text-xs uppercase tracking-wider mb-3">
            <BarChart3 className="w-3.5 h-3.5" />
            Usage This Month
          </div>
          <p className="text-2xl font-bold text-white">
            {data.used.toLocaleString()}
            {data.limit !== Infinity && (
              <span className="text-neutral-500 text-base font-normal">
                /{data.limit.toLocaleString()}
              </span>
            )}
          </p>
          {/* Animated progress bar */}
          <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                usagePercent > 90 ? "bg-red-500" : usagePercent > 70 ? "bg-amber-500" : "bg-emerald-500"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${usagePercent}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
          </div>
          <p className="text-xs text-neutral-500 mt-2">
            {data.limit === Infinity
              ? "Unlimited"
              : `${Math.max(0, data.limit - data.used).toLocaleString()} runs remaining`}
          </p>
        </div>

        {/* Time Saved */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
          <div className="flex items-center gap-2 text-neutral-400 text-xs uppercase tracking-wider mb-3">
            <Clock className="w-3.5 h-3.5" />
            Estimated Savings
          </div>
          <p className="text-2xl font-bold text-emerald-400">~{hoursSaved} hours</p>
          <p className="text-sm text-neutral-500 mt-1">saved this month vs. doing it manually</p>
        </div>
      </div>

      {/* Usage Over Time (last 7 days) */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
        <div className="flex items-center gap-2 text-neutral-400 text-xs uppercase tracking-wider mb-5">
          <TrendingUp className="w-3.5 h-3.5" />
          Last 7 Days
        </div>
        <div className="flex items-end gap-2 h-40">
          {data.dailyUsage.map((day, i) => {
            const height = maxDaily > 0 ? (day.count / maxDaily) * 100 : 0;
            const label = new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
              weekday: "short",
            });
            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-neutral-500">{day.count}</span>
                <motion.div
                  className="w-full rounded-t-md bg-emerald-500/80"
                  style={{ minHeight: day.count > 0 ? 4 : 0 }}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.8, delay: i * 0.08 }}
                />
                <span className="text-[10px] text-neutral-500">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Agents */}
      {data.topAgents.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
          <div className="flex items-center gap-2 text-neutral-400 text-xs uppercase tracking-wider mb-4">
            <Cpu className="w-3.5 h-3.5" />
            Top Agents
          </div>
          <div className="space-y-3">
            {data.topAgents.map((agent, i) => {
              const pct = (agent.count / data.topAgents[0].count) * 100;
              return (
                <div key={agent.name} className="flex items-center gap-3">
                  <span className="text-xs text-neutral-500 w-5 text-right">{i + 1}.</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-neutral-200 font-medium">
                        {agent.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <span className="text-xs text-neutral-500">{agent.count} runs</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-emerald-500/60"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.05 }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upgrade CTA for free tier */}
      {isFreeTier && (
        <motion.div
          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.05] backdrop-blur-xl p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">Unlock more power</h3>
              <p className="text-sm text-neutral-400 mb-4">
                You&apos;re on the Free plan with {data.limit} runs/month.
                Upgrade to Pro for 5,000 runs/month, priority support, and 39 NIM models.
              </p>
              <Link
                href="/dashboard/billing"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-500 text-black text-sm font-semibold hover:bg-emerald-400 transition-colors"
              >
                Upgrade Now
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
