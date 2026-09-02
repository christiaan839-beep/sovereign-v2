"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ChevronLeft, ChevronRight, Loader2, Filter, Clock,
  Users, Activity, AlertTriangle, Search,
} from "lucide-react";

interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resource: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface Summary {
  totalEvents: number;
  uniqueUsers: number;
  topAction: string;
}

const TIME_RANGES = [
  { label: "Last 24h", value: "24h" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "All time", value: "all" },
];

const ACTION_TYPES = [
  { label: "All Actions", value: "" },
  { label: "User Login", value: "user.login" },
  { label: "User Logout", value: "user.logout" },
  { label: "Agent Execute", value: "agent.execute" },
  { label: "Settings Update", value: "settings.update" },
  { label: "API Key Create", value: "api_key.create" },
  { label: "API Key Delete", value: "api_key.delete" },
  { label: "Subscription Change", value: "subscription.change" },
  { label: "Webhook Received", value: "webhook.received" },
  { label: "Data Export", value: "data.export" },
  { label: "Data Delete", value: "data.delete" },
  { label: "Admin Provision", value: "admin.provision" },
];

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function truncateDetails(details: string | null, max = 60): string {
  if (!details) return "-";
  try {
    const parsed = JSON.parse(details);
    const str = typeof parsed === "object" ? JSON.stringify(parsed) : String(parsed);
    return str.length > max ? str.slice(0, max) + "..." : str;
  } catch {
    return details.length > max ? details.slice(0, max) + "..." : details;
  }
}

function actionBadgeColor(action: string): string {
  if (action.startsWith("user.")) return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (action.startsWith("agent.")) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (action.startsWith("api_key.")) return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (action.startsWith("data.")) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (action.startsWith("settings.")) return "bg-violet-500/20 text-violet-400 border-violet-500/30";
  if (action.startsWith("subscription.")) return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
  return "bg-white/10 text-neutral-300 border-white/10";
}

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalEvents: 0, uniqueUsers: 0, topAction: "N/A" });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [since, setSince] = useState("7d");
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ since, page: String(page) });
      if (action) params.set("action", action);
      const res = await fetch(`/api/audit-logs?${params}`);
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
      setSummary(data.summary || { totalEvents: 0, uniqueUsers: 0, topAction: "N/A" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [since, action, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    setPage(1);
  }, [since, action]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-cyan-600/5 border border-emerald-500/20 backdrop-blur-xl"
      >
        <h1 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
          <Shield className="w-6 h-6 text-emerald-400" />
          Audit Trail
        </h1>
        <p className="text-neutral-400 text-sm">
          Activity log built for SOC 2 CC7 evidence requests. Every action across agents, settings, and data is recorded here with its actor, timestamp, and IP.
        </p>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Events", value: summary.totalEvents.toLocaleString(), icon: Activity, color: "text-emerald-400" },
          { label: "Unique Users", value: String(summary.uniqueUsers), icon: Users, color: "text-blue-400" },
          { label: "Top Action", value: summary.topAction, icon: AlertTriangle, color: "text-amber-400" },
        ].map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-5 rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl"
          >
            <div className="flex items-center gap-3 mb-2">
              <card.icon className={`w-5 h-5 ${card.color}`} />
              <span className="text-xs text-neutral-500 uppercase tracking-widest font-semibold">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-white truncate">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-neutral-400">
          <Clock className="w-4 h-4" />
          <span className="text-xs uppercase tracking-widest font-semibold">Range</span>
        </div>
        <div className="flex gap-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setSince(r.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                since === r.value
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-white/5 text-neutral-400 border border-white/5 hover:bg-white/10"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-white/10 mx-2 hidden sm:block" />

        <div className="flex items-center gap-2 text-neutral-400">
          <Filter className="w-4 h-4" />
          <span className="text-xs uppercase tracking-widest font-semibold">Action</span>
        </div>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-neutral-300 focus:outline-none focus:border-emerald-500/50 appearance-none cursor-pointer"
        >
          {ACTION_TYPES.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border border-white/5 bg-black/40 backdrop-blur-xl overflow-hidden"
      >
        {loading ? (
          <div className="flex items-center justify-center p-16">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center p-16 text-red-400 gap-2">
            <AlertTriangle className="w-8 h-8" />
            <p className="text-sm">{error}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-neutral-500 gap-2">
            <Search className="w-8 h-8" />
            <p className="text-sm">No audit events found for the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-4 py-3 text-xs text-neutral-500 uppercase tracking-widest font-semibold">Time</th>
                  <th className="text-left px-4 py-3 text-xs text-neutral-500 uppercase tracking-widest font-semibold">User</th>
                  <th className="text-left px-4 py-3 text-xs text-neutral-500 uppercase tracking-widest font-semibold">Action</th>
                  <th className="text-left px-4 py-3 text-xs text-neutral-500 uppercase tracking-widest font-semibold">Resource</th>
                  <th className="text-left px-4 py-3 text-xs text-neutral-500 uppercase tracking-widest font-semibold">Details</th>
                  <th className="text-left px-4 py-3 text-xs text-neutral-500 uppercase tracking-widest font-semibold">IP</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="wait">
                  {logs.map((log, i) => (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 text-neutral-400 whitespace-nowrap font-mono text-xs">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-neutral-300 whitespace-nowrap text-xs max-w-[140px] truncate">
                        {log.userId}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-md border ${actionBadgeColor(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-400 text-xs max-w-[150px] truncate">
                        {log.resource || "-"}
                      </td>
                      <td className="px-4 py-3 text-neutral-500 text-xs max-w-[200px] truncate font-mono">
                        {truncateDetails(log.details)}
                      </td>
                      <td className="px-4 py-3 text-neutral-500 whitespace-nowrap font-mono text-xs">
                        {log.ipAddress || "-"}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <span className="text-xs text-neutral-500">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-neutral-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-white/5"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-neutral-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all border border-white/5"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
