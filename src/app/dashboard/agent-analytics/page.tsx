"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3, Activity, Zap, Users, Clock, TrendingUp,
  RefreshCcw, Loader2, Calendar, Play, ToggleLeft, ToggleRight
} from "lucide-react";

interface AnalyticsData {
  total_calls_today: number;
  total_calls_all_time: number;
  unique_users_today: number;
  top_agents: [string, number][];
  calls_by_agent: Record<string, number>;
  recent_activity: Array<{ timestamp: string; userId: string; agent: string; plan: string }>;
}

interface ScheduledJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
  run_count: number;
  last_run?: string;
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const [analyticsRes, jobsRes] = await Promise.all([
      fetch("/api/agents/analytics"),
      fetch("/api/agents/scheduler"),
    ]);
    const analyticsData = await analyticsRes.json();
    const jobsData = await jobsRes.json();
    setData(analyticsData);
    setJobs(jobsData.jobs || []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

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

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-8 font-mono">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* Header */}
        <header className="border-b border-[#00B7FF]/20 pb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00B7FF]/10 border border-[#00B7FF]/30 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-[#00B7FF]" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-[0.2em]">Agent Analytics</h1>
              <p className="text-[#00B7FF]/60 text-xs uppercase tracking-widest">Usage Metering · Telemetry · Scheduled Jobs</p>
            </div>
          </div>
          <button onClick={refresh} className="p-2 border border-neutral-800 hover:border-neutral-600 transition-gpu">
            <RefreshCcw className={`w-4 h-4 text-neutral-500 ${loading ? "animate-spin" : ""}`} />
          </button>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-neutral-950 border border-neutral-800 p-5 text-center">
            <Activity className="w-5 h-5 text-[#00B7FF] mx-auto mb-2" />
            <p className="text-3xl font-black text-[#00B7FF]">{data?.total_calls_today || 0}</p>
            <p className="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Calls Today</p>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 p-5 text-center">
            <TrendingUp className="w-5 h-5 text-[#00B7FF] mx-auto mb-2" />
            <p className="text-3xl font-black text-[#00B7FF]">{data?.total_calls_all_time || 0}</p>
            <p className="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">All-Time Calls</p>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 p-5 text-center">
            <Users className="w-5 h-5 text-[#A855F7] mx-auto mb-2" />
            <p className="text-3xl font-black text-[#A855F7]">{data?.unique_users_today || 0}</p>
            <p className="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Users Today</p>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 p-5 text-center">
            <Zap className="w-5 h-5 text-[#FF6B00] mx-auto mb-2" />
            <p className="text-3xl font-black text-[#FF6B00]">{data?.top_agents?.length || 0}</p>
            <p className="text-[9px] text-neutral-500 uppercase tracking-widest mt-1">Active Agents</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Top Agents */}
          <div className="bg-neutral-950 border border-neutral-800 p-5 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400">Top Agents</h2>
            {(data?.top_agents || []).map(([agent, count], i) => (
              <div key={agent} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-neutral-600 w-4">{i + 1}</span>
                  <span className="text-xs text-white">{agent}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 bg-[#00B7FF]/20 rounded-full" style={{ width: `${Math.min(count * 10, 100)}px` }}>
                    <div className="h-2 bg-[#00B7FF] rounded-full" style={{ width: "100%" }} />
                  </div>
                  <span className="text-[10px] font-bold text-[#00B7FF]">{count}</span>
                </div>
              </div>
            ))}
            {(!data?.top_agents || data.top_agents.length === 0) && (
              <p className="text-xs text-neutral-600 text-center py-4">No activity yet. Execute an agent to see metrics.</p>
            )}
          </div>

          {/* Scheduled Jobs */}
          <div className="bg-neutral-950 border border-neutral-800 p-5 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Scheduled Jobs
            </h2>
            {jobs.map(job => (
              <div key={job.id} className="border border-neutral-800 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{job.name}</span>
                  <button onClick={() => toggleJob(job.id)}>
                    {job.enabled ? <ToggleRight className="w-5 h-5 text-[#00ff66]" /> : <ToggleLeft className="w-5 h-5 text-neutral-600" />}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[9px] text-neutral-500">
                  <span>{job.schedule}</span>
                  <span>Runs: {job.run_count}</span>
                </div>
                <button
                  onClick={() => triggerJob(job.id)}
                  disabled={triggering === job.id}
                  className="w-full py-1.5 text-[9px] font-bold uppercase tracking-widest bg-[#00B7FF]/10 border border-[#00B7FF]/30 text-[#00B7FF] hover:bg-[#00B7FF]/20 transition-gpu disabled:opacity-50"
                >
                  {triggering === job.id ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : <><Play className="w-3 h-3 inline mr-1" /> Trigger Now</>}
                </button>
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <div className="bg-neutral-950 border border-neutral-800 p-5 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Recent Activity
            </h2>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {(data?.recent_activity || []).map((log, i) => (
                <div key={i} className="flex items-center justify-between text-[10px] py-1 border-b border-neutral-900">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00ff66]" />
                    <span className="text-white font-bold">{log.agent}</span>
                  </div>
                  <span className="text-neutral-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
              {(!data?.recent_activity || data.recent_activity.length === 0) && (
                <p className="text-xs text-neutral-600 text-center py-4">No recent activity.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
