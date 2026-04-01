"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Clock, CheckCircle2, XCircle, Loader2, ChevronDown,
  Bot, Cpu, Filter, RefreshCw, Zap,
} from "lucide-react";

/* ── Types ── */

interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface ParsedDetails {
  agent?: string;
  agentName?: string;
  model?: string;
  duration?: number;
  durationMs?: number;
  input?: string;
  prompt?: string;
  output?: string;
  result?: string;
  status?: string;
  error?: string;
  tokens?: number;
  [key: string]: unknown;
}

/* ── Helpers ── */

function parseDetails(raw: string | null): ParsedDetails {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function formatDuration(ms: number | undefined): string {
  if (!ms) return "N/A";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function getAgentName(entry: AuditLogEntry, details: ParsedDetails): string {
  return details.agentName || details.agent || entry.resource || "Unknown Agent";
}

function isSuccess(details: ParsedDetails): boolean {
  if (details.status === "failed" || details.error) return false;
  return true;
}

/* ── Component ── */

export default function ReplaysPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterAgent, setFilterAgent] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "success" | "failed">("all");
  const [showFilters, setShowFilters] = useState(false);

  const fetchReplays = useCallback(async (pageNum: number, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    try {
      const params = new URLSearchParams({
        action: "agent.execute",
        since: "30d",
        page: pageNum.toString(),
      });
      const res = await fetch(`/api/audit-logs?${params}`);
      const data = await res.json();

      const logs = data.logs || [];
      setEntries((prev) => (append ? [...prev, ...logs] : logs));
      setTotalPages(data.totalPages || 1);
      setPage(pageNum);
    } catch {
      // empty state
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchReplays(1);
  }, [fetchReplays]);

  const handleLoadMore = () => {
    if (page < totalPages) fetchReplays(page + 1, true);
  };

  // Client-side filtering
  const filtered = entries.filter((entry) => {
    const details = parseDetails(entry.details);
    const agentName = getAgentName(entry, details).toLowerCase();
    const success = isSuccess(details);

    if (filterAgent && !agentName.includes(filterAgent.toLowerCase())) return false;
    if (filterStatus === "success" && !success) return false;
    if (filterStatus === "failed" && success) return false;
    return true;
  });

  // Collect unique agent names for filter
  const allAgents = Array.from(
    new Set(entries.map((e) => getAgentName(e, parseDetails(e.details))))
  ).sort();

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Play className="h-7 w-7 text-cyan-400" />
            Execution Replays
          </h1>
          <p className="text-neutral-400 mt-1 text-sm">
            Step through past agent executions to understand what happened and why.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition ${
              showFilters
                ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                : "bg-white/[0.03] text-neutral-400 border-white/10 hover:border-white/20"
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>
          <button
            onClick={() => fetchReplays(1)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] text-neutral-400 border border-white/10 hover:border-white/20 transition text-sm"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-wrap gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="space-y-1">
                <label className="text-xs text-neutral-500 uppercase tracking-wider">Agent</label>
                <select
                  value={filterAgent}
                  onChange={(e) => setFilterAgent(e.target.value)}
                  className="block w-48 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-neutral-300 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                >
                  <option value="">All Agents</option>
                  {allAgents.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-neutral-500 uppercase tracking-wider">Status</label>
                <div className="flex gap-1">
                  {(["all", "success", "failed"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        filterStatus === s
                          ? s === "success"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : s === "failed"
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-white/10 text-white border border-white/20"
                          : "bg-white/[0.03] text-neutral-500 border border-white/5 hover:text-neutral-300"
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-cyan-400 animate-spin" />
          <span className="ml-3 text-neutral-400">Loading execution history...</span>
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 space-y-3"
        >
          <Play className="h-12 w-12 text-neutral-500 mx-auto" />
          <p className="text-neutral-400">
            No executions yet. Run an agent to see replays here.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-neutral-500">{filtered.length} executions</p>

          {/* Timeline line */}
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-white/5" />

            <AnimatePresence mode="popLayout">
              {filtered.map((entry, i) => {
                const details = parseDetails(entry.details);
                const agentName = getAgentName(entry, details);
                const success = isSuccess(details);
                const duration = details.durationMs || details.duration;
                const isExpanded = expandedId === entry.id;

                return (
                  <motion.div
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ delay: i * 0.015 }}
                    className="relative pl-12 pb-3"
                  >
                    {/* Timeline dot */}
                    <div className="absolute left-3.5 top-4 z-10">
                      {success ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-400" />
                      )}
                    </div>

                    <div
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-4 cursor-pointer hover:border-white/10 transition group"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                            <Bot className="h-3 w-3" />
                            {agentName}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            success
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-red-500/10 text-red-400"
                          }`}>
                            {success ? "Success" : "Failed"}
                          </span>
                          {duration && (
                            <span className="text-xs text-neutral-500 flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {formatDuration(duration)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-neutral-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTime(entry.createdAt)}
                          </span>
                          <ChevronDown
                            className={`h-4 w-4 text-neutral-500 group-hover:text-neutral-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                      </div>

                      {/* Expanded Detail */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 space-y-3 overflow-hidden"
                          >
                            {/* Model */}
                            {details.model && (
                              <div className="flex items-center gap-2 text-xs">
                                <Cpu className="h-3.5 w-3.5 text-neutral-500" />
                                <span className="text-neutral-500">Model:</span>
                                <span className="text-neutral-300 font-mono">{details.model}</span>
                              </div>
                            )}

                            {/* Input */}
                            {(details.input || details.prompt) && (
                              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                                <p className="text-xs text-neutral-500 mb-1 uppercase tracking-wider">Input / Prompt</p>
                                <p className="text-sm text-neutral-300 whitespace-pre-wrap">
                                  {details.input || details.prompt}
                                </p>
                              </div>
                            )}

                            {/* Output */}
                            {(details.output || details.result) && (
                              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                                <p className="text-xs text-neutral-500 mb-1 uppercase tracking-wider">Output</p>
                                <p className="text-sm text-neutral-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                  {typeof (details.output || details.result) === "string"
                                    ? (details.output || details.result)
                                    : JSON.stringify(details.output || details.result, null, 2)}
                                </p>
                              </div>
                            )}

                            {/* Error */}
                            {details.error && (
                              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                                <p className="text-xs text-red-400 mb-1 uppercase tracking-wider">Error</p>
                                <p className="text-sm text-red-300 whitespace-pre-wrap">{details.error}</p>
                              </div>
                            )}

                            {/* Tokens */}
                            {details.tokens && (
                              <div className="flex items-center gap-2 text-xs">
                                <Zap className="h-3.5 w-3.5 text-neutral-500" />
                                <span className="text-neutral-500">Tokens:</span>
                                <span className="text-neutral-300">{details.tokens.toLocaleString()}</span>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Load More */}
          {page < totalPages && (
            <div className="text-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white/[0.05] text-neutral-300 border border-white/10 hover:bg-white/[0.08] hover:border-white/20 transition text-sm font-medium disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                Load More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
