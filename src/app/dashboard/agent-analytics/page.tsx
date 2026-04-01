"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, Activity, Zap, Users, Clock, TrendingUp, TrendingDown,
  RefreshCcw, Loader2, Calendar, Play, ToggleLeft, ToggleRight,
  CheckCircle, XCircle, Timer, ArrowUp, ArrowDown,
} from "lucide-react";

/* ─── Types ─── */

interface AgentStat {
  agent: string;
  executions: number;
}

interface DurationStat {
  agent: string;
  avgMs: number | null;
  executions: number;
}

interface SuccessRateStat {
  agent: string;
  total: number;
  successes: number;
  rate: number;
}

interface DailyCount {
  day: string;
  label: string;
  count: number;
}

interface AnalyticsPayload {
  topAgents: AgentStat[];
  avgDuration: DurationStat[];
  successRate: SuccessRateStat[];
  dailyCounts: DailyCount[];
  totalMonth: number;
  trend: number;
}

interface ScheduledJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  run_count: number;
  last_run?: string;
}

/* ─── Helpers ─── */

const AGENT_COLORS = [
  "#00B7FF", "#A855F7", "#FF6B00", "#10B981", "#F43F5E",
  "#FACC15", "#3B82F6", "#EC4899", "#14B8A6", "#F97316",
];

function formatMs(ms: number | null): string {
  if (ms === null) return "N/A";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatAgent(name: string): string {
  return name
    .replace(/^\/api\/_agents\//, "")
    .replace(/\//g, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ─── Component ─── */

export default function AgentAnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        fetch("/api/agent-analytics").then((r) => r.json()),
        fetch("/api/agents/scheduler").then((r) => r.json()),
      ]);
      const analyticsData = results[0].status === "fulfilled" ? results[0].value : null;
      const jobsData = results[1].status === "fulfilled" ? results[1].value : { jobs: [] };
      if (analyticsData) setData(analyticsData);
      setJobs(jobsData.jobs || []);
    } catch {
      // Keep existing data on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const triggerJob = async (jobId: string) => {
    setTriggering(jobId);
    await fetch("/api/agents/scheduler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "trigger", jobId }),
    });
    await refresh();
    setTriggering(null);
  };

  const toggleJob = async (jobId: string) => {
    await fetch("/api/agents/scheduler", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", jobId }),
    });
    await refresh();
  };

  const maxDailyCount = data?.dailyCounts ? Math.max(...data.dailyCounts.map((d) => d.count), 1) : 1;
  const maxExecCount = data?.topAgents?.[0]?.executions || 1;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-8 font-mono" role="main" aria-label="Agent analytics dashboard">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="border-b border-[#00B7FF]/20 pb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00B7FF]/10 border border-[#00B7FF]/30 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-[#00B7FF]" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-[0.2em]">Agent Analytics</h1>
              <p className="text-[#00B7FF]/60 text-xs uppercase tracking-widest">Execution Metrics &middot; Performance &middot; Success Rates</p>
            </div>
          </div>
          <button
            onClick={refresh}
            aria-label="Refresh analytics data"
            className="p-2 border border-neutral-800 hover:border-neutral-600 transition-all rounded-lg"
          >
            <RefreshCcw className={`w-4 h-4 text-neutral-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Executions This Month */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
            className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 text-center relative overflow-hidden"
          >
            <Activity className="w-5 h-5 text-[#00B7FF] mx-auto mb-2" />
            <p className="text-3xl font-black text-[#00B7FF]">
              {loading ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : (data?.totalMonth ?? 0).toLocaleString()}
            </p>
            <p className="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Executions This Month</p>
            {data && data.trend !== 0 && (
              <div className={`absolute top-3 right-3 flex items-center gap-0.5 text-[10px] font-bold ${data.trend > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {data.trend > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(data.trend)}%
              </div>
            )}
          </motion.div>

          {/* Top Agent */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 text-center"
          >
            <Zap className="w-5 h-5 text-[#FF6B00] mx-auto mb-2" />
            <p className="text-lg font-black text-[#FF6B00] truncate">
              {data?.topAgents?.[0] ? formatAgent(data.topAgents[0].agent) : "---"}
            </p>
            <p className="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Most Used Agent</p>
          </motion.div>

          {/* Avg Success Rate */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 text-center"
          >
            <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
            <p className="text-3xl font-black text-emerald-400">
              {data?.successRate?.length
                ? `${Math.round(data.successRate.reduce((a, r) => a + r.rate, 0) / data.successRate.length)}%`
                : "---"}
            </p>
            <p className="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Avg Success Rate</p>
          </motion.div>

          {/* Active Agents */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 text-center"
          >
            <Users className="w-5 h-5 text-[#A855F7] mx-auto mb-2" />
            <p className="text-3xl font-black text-[#A855F7]">{data?.topAgents?.length || 0}</p>
            <p className="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Active Agents</p>
          </motion.div>
        </div>

        {/* Usage Over Time — Last 7 Days */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-neutral-950 border border-neutral-800 rounded-xl p-6"
        >
          <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-6 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Usage Over Time (Last 7 Days)
          </h2>
          <div className="flex items-end gap-2 h-40">
            {(data?.dailyCounts || Array.from({ length: 7 }, (_, i) => ({ day: "", label: ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i], count: 0 }))).map((d, i) => {
              const height = maxDailyCount > 0 ? (d.count / maxDailyCount) * 100 : 0;
              return (
                <div key={d.day || i} className="flex-1 flex flex-col items-center gap-2">
                  <span className="text-[10px] font-bold text-[#00B7FF]">
                    {d.count > 0 ? d.count : ""}
                  </span>
                  <div className="w-full relative" style={{ height: "120px" }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(height, 2)}%` }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 0.4 }}
                      className="absolute bottom-0 left-0 right-0 rounded-t-md bg-gradient-to-t from-[#00B7FF] to-[#00B7FF]/40"
                    />
                  </div>
                  <span className="text-[9px] text-neutral-500 uppercase">{d.label}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Top 10 Agents by Execution Count */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-3"
          >
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Top Agents by Executions
            </h2>
            {(data?.topAgents || []).map((a, i) => {
              const pct = (a.executions / maxExecCount) * 100;
              const color = AGENT_COLORS[i % AGENT_COLORS.length];
              return (
                <div key={a.agent} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-neutral-500 w-4">{i + 1}</span>
                      <span className="text-xs text-white truncate max-w-[140px]">{formatAgent(a.agent)}</span>
                    </div>
                    <span className="text-[10px] font-bold" style={{ color }}>{a.executions}</span>
                  </div>
                  <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.4 + i * 0.05, duration: 0.5 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
            {(!data?.topAgents || data.topAgents.length === 0) && (
              <p className="text-xs text-neutral-500 text-center py-4">No agent executions recorded yet.</p>
            )}
          </motion.div>

          {/* Average Execution Time */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-3"
          >
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <Timer className="w-4 h-4" /> Avg Execution Time
            </h2>
            {(data?.avgDuration || []).map((a, i) => (
              <div key={a.agent} className="flex items-center justify-between py-1.5 border-b border-neutral-900 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-neutral-500 w-4">{i + 1}</span>
                  <span className="text-xs text-white truncate max-w-[120px]">{formatAgent(a.agent)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-neutral-500">{a.executions} runs</span>
                  <span className={`text-xs font-bold ${
                    a.avgMs !== null && a.avgMs < 2000 ? "text-emerald-400" :
                    a.avgMs !== null && a.avgMs < 5000 ? "text-amber-400" :
                    "text-rose-400"
                  }`}>
                    {formatMs(a.avgMs)}
                  </span>
                </div>
              </div>
            ))}
            {(!data?.avgDuration || data.avgDuration.length === 0) && (
              <p className="text-xs text-neutral-500 text-center py-4">No duration data available.</p>
            )}
          </motion.div>

          {/* Success Rate */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-3"
          >
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Success Rate
            </h2>
            {(data?.successRate || []).map((a, i) => (
              <div key={a.agent} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white truncate max-w-[130px]">{formatAgent(a.agent)}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-neutral-500">
                      {a.successes}/{a.total}
                    </span>
                    <span className={`text-xs font-bold ${
                      a.rate >= 90 ? "text-emerald-400" :
                      a.rate >= 70 ? "text-amber-400" :
                      "text-rose-400"
                    }`}>
                      {a.rate}%
                    </span>
                  </div>
                </div>
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden flex">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${a.rate}%` }}
                    transition={{ delay: 0.5 + i * 0.05, duration: 0.5 }}
                    className={`h-full rounded-full ${
                      a.rate >= 90 ? "bg-emerald-400" :
                      a.rate >= 70 ? "bg-amber-400" :
                      "bg-rose-400"
                    }`}
                  />
                </div>
              </div>
            ))}
            {(!data?.successRate || data.successRate.length === 0) && (
              <p className="text-xs text-neutral-500 text-center py-4">No success data recorded yet.</p>
            )}
          </motion.div>
        </div>

        {/* Scheduled Jobs */}
        {jobs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-neutral-950 border border-neutral-800 rounded-xl p-5 space-y-3"
          >
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Scheduled Jobs
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobs.map((job) => (
                <div key={job.id} className="border border-neutral-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{job.name}</span>
                    <button
                      onClick={() => toggleJob(job.id)}
                      aria-label={job.enabled ? `Disable ${job.name}` : `Enable ${job.name}`}
                    >
                      {job.enabled ? (
                        <ToggleRight className="w-5 h-5 text-[#00ff66]" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-neutral-500" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-neutral-500">
                    <span>{job.schedule}</span>
                    <span>Runs: {job.run_count}</span>
                  </div>
                  <button
                    onClick={() => triggerJob(job.id)}
                    disabled={triggering === job.id}
                    className="w-full py-1.5 text-[9px] font-bold uppercase tracking-widest bg-[#00B7FF]/10 border border-[#00B7FF]/30 rounded-md text-[#00B7FF] hover:bg-[#00B7FF]/20 transition-all disabled:opacity-50"
                  >
                    {triggering === job.id ? (
                      <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                    ) : (
                      <>
                        <Play className="w-3 h-3 inline mr-1" /> Trigger Now
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
