"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  BarChart3,
  FileText,
  Search,
  CheckCircle2,
  Users,
  Zap,
  ExternalLink,
  ArrowRight,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { useState, useEffect, use } from "react";

/* ═══════════════════════════════════════════
   Types
   ═══════════════════════════════════════════ */

interface Metrics {
  leads: number;
  content: number;
  seo: number;
  tasks: number;
  recentActivity: ActivityItem[];
}

interface ActivityItem {
  id: string;
  agent: string;
  type: string;
  action: string;
  summary: string;
  timestamp: string;
}

/* ═══════════════════════════════════════════
   Main Dashboard
   ═══════════════════════════════════════════ */

export default function ClientDashboard({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = use(params);
  const decodedId = decodeURIComponent(clientId);

  const [metrics, setMetrics] = useState<Metrics>({
    leads: 0,
    content: 0,
    seo: 0,
    tasks: 0,
    recentActivity: [],
  });
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
          `/api/portal/metrics?clientId=${encodeURIComponent(decodedId)}`
        );
        const data = await res.json();
        if (data.success) {
          setMetrics({
            leads: data.metrics.leads ?? 0,
            content: data.metrics.content ?? 0,
            seo: data.metrics.seo ?? 0,
            tasks: data.metrics.tasks ?? 0,
            recentActivity: data.metrics.recentActivity ?? [],
          });
        }
      } catch {
        // Silently handle — metrics stay at 0
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [decodedId]);

  const kpis = [
    {
      label: "Leads Generated",
      value: metrics.leads,
      icon: Users,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      border: "border-emerald-400/20",
    },
    {
      label: "Content Created",
      value: metrics.content,
      icon: FileText,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
      border: "border-blue-400/20",
    },
    {
      label: "SEO Score",
      value: metrics.seo,
      icon: Search,
      color: "text-violet-400",
      bg: "bg-violet-400/10",
      border: "border-violet-400/20",
      suffix: "/100",
    },
    {
      label: "Tasks Completed",
      value: metrics.tasks,
      icon: CheckCircle2,
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      border: "border-amber-400/20",
    },
  ];

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200">
      {/* ── Top Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#030303]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-bold tracking-widest uppercase text-white">
              Client Portal
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/portal/${clientId}/revenue`}
              className="text-xs text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Revenue
            </Link>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </div>
            <Link
              href="/portal"
              className="text-xs text-neutral-500 hover:text-white transition-colors"
            >
              Sign Out
            </Link>
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
          <h1 className="text-3xl font-bold text-white mb-1">Dashboard</h1>
          <p className="text-sm text-neutral-500">
            Client:{" "}
            <span className="font-mono text-neutral-400">{decodedId}</span>
          </p>
        </motion.div>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`backdrop-blur-xl bg-white/[0.03] rounded-2xl p-6 border border-white/[0.06] relative overflow-hidden group hover:border-white/[0.12] transition-colors`}
            >
              <div className="absolute -top-4 -right-4 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity">
                <kpi.icon className={`w-28 h-28 ${kpi.color}`} />
              </div>
              <div
                className={`w-10 h-10 rounded-xl ${kpi.bg} flex items-center justify-center mb-4`}
              >
                <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
              </div>
              <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-widest mb-1">
                {kpi.label}
              </p>
              <div className="flex items-baseline gap-1">
                {loading ? (
                  <div className="h-8 w-16 bg-white/5 rounded animate-pulse" />
                ) : (
                  <>
                    <span className="text-3xl font-bold font-mono text-white">
                      {kpi.value.toLocaleString()}
                    </span>
                    {kpi.suffix && (
                      <span className="text-sm text-neutral-500">
                        {kpi.suffix}
                      </span>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Content Area ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Activity Feed */}
          <div className="lg:col-span-2 backdrop-blur-xl bg-white/[0.03] rounded-2xl border border-white/[0.06] overflow-hidden flex flex-col max-h-[600px]">
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0">
              <h2 className="text-xs font-bold uppercase tracking-widest text-neutral-500 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Recent Activity
              </h2>
              <span className="text-[10px] text-neutral-600">
                Last 10 executions
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loading ? (
                <div className="space-y-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex gap-4 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-white/5 shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-40 bg-white/5 rounded" />
                        <div className="h-2 w-64 bg-white/5 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : metrics.recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-neutral-600">
                  <Activity className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm">No activity recorded yet.</p>
                  <p className="text-xs mt-1">
                    Agent executions will appear here.
                  </p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-4 bottom-4 w-px bg-white/[0.06]" />
                  <div className="space-y-6">
                    <AnimatePresence>
                      {metrics.recentActivity.map((item, i) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="relative flex gap-5 pl-1"
                        >
                          <div className="w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.06] flex items-center justify-center shrink-0 z-10">
                            <AgentIcon type={item.type} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3 mb-0.5">
                              <span className="text-sm font-semibold text-white truncate">
                                {item.agent}
                              </span>
                              <span className="text-[10px] text-neutral-600 font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(item.timestamp)}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2">
                              {item.summary}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Revenue CTA */}
            <Link
              href={`/portal/${clientId}/revenue`}
              className="block backdrop-blur-xl bg-white/[0.03] rounded-2xl p-6 border border-white/[0.06] hover:border-white/[0.12] transition-colors group"
            >
              <div className="w-10 h-10 rounded-xl bg-violet-400/10 flex items-center justify-center mb-4">
                <BarChart3 className="w-5 h-5 text-violet-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                Revenue Attribution
              </h3>
              <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
                See which AI agents are driving the most value for your
                business.
              </p>
              <span className="text-xs text-violet-400 flex items-center gap-1.5 font-semibold group-hover:gap-2.5 transition-all">
                View breakdown{" "}
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>

            {/* Upgrade CTA */}
            <div className="backdrop-blur-xl bg-gradient-to-br from-white/[0.03] to-emerald-500/[0.03] rounded-2xl p-6 border border-white/[0.06]">
              <div className="w-10 h-10 rounded-xl bg-emerald-400/10 flex items-center justify-center mb-4">
                <ExternalLink className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                Scale your results
              </h3>
              <p className="text-xs text-neutral-500 mb-6 leading-relaxed">
                Unlock additional AI agents and expand your coverage area.
              </p>
              <button className="w-full py-3 rounded-xl bg-white text-[#030303] font-bold text-sm hover:bg-neutral-200 transition-colors">
                Contact Account Manager
              </button>
            </div>
          </div>
        </div>
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

function AgentIcon({ type }: { type: string }) {
  const lower = type.toLowerCase();
  if (lower.includes("lead") || lower.includes("sales"))
    return <Users className="w-3.5 h-3.5 text-emerald-400" />;
  if (lower.includes("content") || lower.includes("blog") || lower.includes("social"))
    return <FileText className="w-3.5 h-3.5 text-blue-400" />;
  if (lower.includes("seo"))
    return <Search className="w-3.5 h-3.5 text-violet-400" />;
  return <Zap className="w-3.5 h-3.5 text-amber-400" />;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}
