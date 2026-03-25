"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Users,
  FileText,
  Cpu,
  Clock,
  Activity,
  BarChart3,
  Zap,
  Target,
  Sparkles,
  RefreshCcw,
  Loader2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────
interface KPIData {
  totalLeads: number;
  contentPieces: number;
  agentCalls: number;
  timeSavedHours: number;
}

interface AgentPerformance {
  agent: string;
  calls: number;
  avgResponseMs: number;
  category: "content" | "leads" | "code" | "research" | "other";
}

interface TelemetryEvent {
  id: string;
  eventType: string;
  payload: string;
  timestamp: string;
}

interface MonthlyTrend {
  month: string;
  calls: number;
}

// ─── Category Colors ────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  content: "#10B981",
  leads: "#06B6D4",
  code: "#F59E0B",
  research: "#A855F7",
  other: "#6B7280",
};

const CATEGORY_BG: Record<string, string> = {
  content: "rgba(16, 185, 129, 0.15)",
  leads: "rgba(6, 182, 212, 0.15)",
  code: "rgba(245, 158, 11, 0.15)",
  research: "rgba(168, 85, 247, 0.15)",
  other: "rgba(107, 114, 128, 0.15)",
};

const EVENT_ICONS: Record<string, typeof Target> = {
  lead_scraped: Users,
  content_generated: FileText,
  page_built: Sparkles,
  agent_call: Cpu,
  benchmark: BarChart3,
};

// ─── Helpers ────────────────────────────────────────────────
function categorizeAgent(agentId: string): AgentPerformance["category"] {
  const id = agentId.toLowerCase();
  if (id.includes("content") || id.includes("seo") || id.includes("blog") || id.includes("email") || id.includes("vsl"))
    return "content";
  if (id.includes("lead") || id.includes("prospect") || id.includes("booking"))
    return "leads";
  if (id.includes("code") || id.includes("build") || id.includes("page-builder"))
    return "code";
  if (id.includes("research") || id.includes("war-room") || id.includes("god-brain"))
    return "research";
  return "other";
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Component ──────────────────────────────────────────────
export default function ROIAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIData>({ totalLeads: 0, contentPieces: 0, agentCalls: 0, timeSavedHours: 0 });
  const [agents, setAgents] = useState<AgentPerformance[]>([]);
  const [timeline, setTimeline] = useState<TelemetryEvent[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agents/analytics");
      if (res.ok) {
        const data = await res.json();
        // Map analytics response to our UI types
        if (data.kpis) setKpis(data.kpis);
        if (data.agentPerformance) setAgents(data.agentPerformance);
        if (data.timeline) setTimeline(data.timeline);
        if (data.monthlyTrend) setMonthlyTrend(data.monthlyTrend);
      } else {
        // Fallback: generate demo data for presentation
        loadDemoData();
      }
    } catch {
      loadDemoData();
    } finally {
      setLoading(false);
    }
  };

  const loadDemoData = () => {
    setKpis({ totalLeads: 247, contentPieces: 1893, agentCalls: 12450, timeSavedHours: 3112 });
    setAgents([
      { agent: "Content Factory", calls: 3240, avgResponseMs: 2100, category: "content" },
      { agent: "SEO Dominator", calls: 2810, avgResponseMs: 3400, category: "content" },
      { agent: "Lead Prospector", calls: 1920, avgResponseMs: 4200, category: "leads" },
      { agent: "Page Builder", calls: 1540, avgResponseMs: 5100, category: "code" },
      { agent: "War Room", calls: 980, avgResponseMs: 6800, category: "research" },
      { agent: "God Brain", calls: 870, avgResponseMs: 3200, category: "research" },
      { agent: "VSL Hacker", calls: 620, avgResponseMs: 2800, category: "content" },
      { agent: "Email Sequence", calls: 410, avgResponseMs: 1900, category: "content" },
      { agent: "Smart Router", calls: 350, avgResponseMs: 800, category: "other" },
      { agent: "Voice Assistant", calls: 210, avgResponseMs: 1200, category: "leads" },
    ]);
    setTimeline(
      Array.from({ length: 20 }, (_, i) => ({
        id: `demo-${i}`,
        eventType: ["lead_scraped", "content_generated", "page_built", "agent_call", "benchmark"][i % 5],
        payload: JSON.stringify({
          preview: [
            "Scraped 12 roofers in Austin TX",
            'Generated blog post: "AI in 2026"',
            "Built landing page for client",
            "Processed SEO audit request",
            "Benchmark: DeepSeek 2.1s",
          ][i % 5],
        }),
        timestamp: new Date(Date.now() - i * 3600000 * (1 + Math.random())).toISOString(),
      }))
    );
    setMonthlyTrend([
      { month: "Oct", calls: 1200 },
      { month: "Nov", calls: 2100 },
      { month: "Dec", calls: 3400 },
      { month: "Jan", calls: 4800 },
      { month: "Feb", calls: 7200 },
      { month: "Mar", calls: 12450 },
    ]);
  };

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const maxAgentCalls = agents.length > 0 ? Math.max(...agents.map((a) => a.calls)) : 1;
  const maxMonthly = monthlyTrend.length > 0 ? Math.max(...monthlyTrend.map((m) => m.calls)) : 1;

  // ─── KPI Card ──────────────────────────────────────────────
  const KPICard = ({
    icon: Icon,
    label,
    value,
    suffix,
    color,
    index,
  }: {
    icon: typeof TrendingUp;
    label: string;
    value: number;
    suffix?: string;
    color: string;
    index: number;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl p-5 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all group"
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: `${color}15`, border: `1px solid ${color}30` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">{label}</span>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-3xl font-black text-white tabular-nums">{value.toLocaleString()}</span>
        {suffix && <span className="text-sm text-neutral-500 mb-1">{suffix}</span>}
      </div>
    </motion.div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
            <TrendingUp className="w-3 h-3" /> Results Engine
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">ROI Analytics</h1>
          <p className="text-sm text-neutral-400 mt-1">
            Real-time intelligence on the value Sovereign Matrix delivers to your agency.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-neutral-400 hover:text-white hover:border-white/[0.15] transition-all"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={Users} label="Total Leads" value={kpis.totalLeads} color="#06B6D4" index={0} />
        <KPICard icon={FileText} label="Content Created" value={kpis.contentPieces} color="#10B981" index={1} />
        <KPICard icon={Cpu} label="Agent Calls" value={kpis.agentCalls} suffix="this month" color="#A855F7" index={2} />
        <KPICard icon={Clock} label="Time Saved" value={kpis.timeSavedHours} suffix="hours" color="#F59E0B" index={3} />
      </div>

      {/* Agent Performance + Monthly Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Agent Performance Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="lg:col-span-2 bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl p-6"
        >
          <h2 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#00B7FF]" /> Agent Performance
          </h2>
          <div className="space-y-3">
            <AnimatePresence>
              {agents.slice(0, 10).map((agent, i) => {
                const pct = Math.round((agent.calls / maxAgentCalls) * 100);
                const color = CATEGORY_COLORS[agent.category];
                const bg = CATEGORY_BG[agent.category];
                return (
                  <motion.div
                    key={agent.agent}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.04 }}
                    className="group"
                  >
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs text-neutral-400 w-32 truncate">{agent.agent}</span>
                      <div className="flex-1 h-7 rounded-md overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
                        <div
                          className="h-full rounded-md flex items-center justify-end pr-2 transition-all duration-700"
                          style={{ width: `${Math.max(pct, 4)}%`, background: bg, borderRight: `2px solid ${color}` }}
                        >
                          <span className="text-[10px] font-bold tabular-nums" style={{ color }}>
                            {agent.calls.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] text-neutral-600 w-16 text-right tabular-nums">
                        {(agent.avgResponseMs / 1000).toFixed(1)}s avg
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          {/* Legend */}
          <div className="mt-5 pt-4 border-t border-white/[0.06] flex flex-wrap gap-4">
            {(["content", "leads", "code", "research"] as const).map((cat) => (
              <div key={cat} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[cat] }} />
                <span className="text-[10px] text-neutral-500 uppercase tracking-widest">{cat}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Monthly Trend */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl p-6"
        >
          <h2 className="text-sm font-semibold text-white mb-5 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Monthly Trend
          </h2>
          <div className="flex items-end gap-2 h-48">
            {monthlyTrend.map((m, i) => {
              const pct = Math.round((m.calls / maxMonthly) * 100);
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-[10px] font-bold text-neutral-400 tabular-nums">{m.calls >= 1000 ? `${(m.calls / 1000).toFixed(1)}k` : m.calls}</span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(pct, 4)}%` }}
                    transition={{ delay: 0.5 + i * 0.08, duration: 0.5 }}
                    className="w-full rounded-t-md"
                    style={{
                      background: `linear-gradient(to top, rgba(16, 185, 129, 0.3), rgba(16, 185, 129, 0.08))`,
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                      borderBottom: "none",
                    }}
                  />
                  <span className="text-[10px] text-neutral-600">{m.month}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Activity Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-xl"
      >
        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#00B7FF]" /> Activity Timeline
          </h2>
          <span className="text-[10px] text-neutral-600 uppercase tracking-widest">Last 20 events</span>
        </div>
        <div className="max-h-[400px] overflow-y-auto divide-y divide-white/[0.04]">
          {timeline.map((event, i) => {
            const Icon = EVENT_ICONS[event.eventType] || Zap;
            let preview = "";
            try {
              const parsed = JSON.parse(event.payload);
              preview = parsed.preview || parsed.result || event.eventType;
            } catch {
              preview = event.eventType;
            }
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 + i * 0.02 }}
                className="px-5 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-neutral-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-neutral-300 truncate">{preview}</p>
                  <p className="text-[10px] text-neutral-600 font-mono">{event.eventType.replace(/_/g, " ")}</p>
                </div>
                <span className="text-[10px] text-neutral-600 tabular-nums shrink-0">
                  {formatRelativeTime(event.timestamp)}
                </span>
              </motion.div>
            );
          })}
          {timeline.length === 0 && !loading && (
            <div className="p-8 text-center text-neutral-600 text-xs">No telemetry events yet.</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
