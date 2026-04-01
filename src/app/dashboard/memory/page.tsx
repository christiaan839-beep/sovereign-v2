"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Search, Trash2, Loader2, AlertTriangle, Database,
  Clock, Tag, Bot, ChevronDown, X,
} from "lucide-react";

/* ── Types ── */

interface MemoryEntry {
  id: string;
  agentName: string;
  input: string;
  output: string;
  timestamp: number;
  tags: string[];
}

interface MemoryStats {
  totalMemories: number;
  dbMemories: number;
  topAgents: Array<{ agent: string; count: number }>;
  oldestMemory: number | null;
  newestMemory: number | null;
}

/* ── Helpers ── */

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const AGENT_COLORS: Record<string, string> = {
  "seo-dominator": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "content": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "leads": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "god-brain": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "war-room": "bg-red-500/20 text-red-400 border-red-500/30",
  "competitor": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

function agentBadgeClass(agent: string): string {
  for (const [key, cls] of Object.entries(AGENT_COLORS)) {
    if (agent.toLowerCase().includes(key)) return cls;
  }
  return "bg-white/10 text-neutral-300 border-white/10";
}

/* ── Component ── */

export default function MemoryViewerPage() {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchMemories = useCallback(async (query?: string) => {
    setLoading(true);
    try {
      const q = query || debouncedQuery || "all";
      const [memRes, statsRes] = await Promise.all([
        fetch(`/api/agents/memory?action=query&q=${encodeURIComponent(q)}&limit=100`),
        fetch(`/api/agents/memory?action=stats`),
      ]);
      const memData = await memRes.json();
      const statsData = await statsRes.json();

      setMemories(memData.memories || memData.results || []);
      setStats(statsData.stats || statsData || null);
    } catch {
      // Silently handle — empty state will show
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await fetch("/api/agents/memory?action=clear", { method: "DELETE" });
      setMemories([]);
      setStats(null);
      setShowClearConfirm(false);
    } catch {
      // ignore
    } finally {
      setClearing(false);
    }
  };

  const filtered = debouncedQuery
    ? memories
    : memories.sort((a, b) => b.timestamp - a.timestamp);

  const uniqueAgents = new Set(memories.map((m) => m.agentName));

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Brain className="h-7 w-7 text-purple-400" />
            Agent Memory
          </h1>
          <p className="text-neutral-400 mt-1 text-sm">
            Everything your agents have learned about you and your business.
          </p>
        </div>
        <button
          onClick={() => setShowClearConfirm(true)}
          disabled={!memories.length}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
        >
          <Trash2 className="h-4 w-4" />
          Clear All Memory
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: "Total Entries",
            value: stats?.totalMemories ?? 0,
            icon: Database,
            color: "text-blue-400",
          },
          {
            label: "Agents with Memory",
            value: uniqueAgents.size,
            icon: Bot,
            color: "text-emerald-400",
          },
          {
            label: "Oldest Memory",
            value: stats?.oldestMemory ? timeAgo(stats.oldestMemory) : "N/A",
            icon: Clock,
            color: "text-amber-400",
          },
          {
            label: "DB Persisted",
            value: stats?.dbMemories ?? 0,
            icon: Database,
            color: "text-purple-400",
          },
        ].map((stat) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-4"
          >
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <span className="text-xs text-neutral-500 uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="text-xl font-semibold text-white">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
        <input
          type="text"
          placeholder="Search memories by keyword, agent, or tag..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50 transition text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Memory List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 text-purple-400 animate-spin" />
          <span className="ml-3 text-neutral-400">Loading agent memories...</span>
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20 space-y-3"
        >
          <Brain className="h-12 w-12 text-neutral-500 mx-auto" />
          <p className="text-neutral-400">
            {searchQuery
              ? "No memories match your search."
              : "No memories yet. Run an agent to build your data moat."}
          </p>
          {!searchQuery && (stats?.totalMemories ?? 0) === 0 && (
            <p className="text-neutral-500 text-sm max-w-md mx-auto">
              Agent memory requires Pinecone to be configured. Go to Settings &rarr; API Keys to add your Pinecone API key.
            </p>
          )}
        </motion.div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-neutral-500">{filtered.length} memories</p>
          <AnimatePresence mode="popLayout">
            {filtered.map((memory, i) => {
              const isExpanded = expandedId === memory.id;
              return (
                <motion.div
                  key={memory.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => setExpandedId(isExpanded ? null : memory.id)}
                  className="rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-sm p-4 cursor-pointer hover:border-white/10 transition group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border ${agentBadgeClass(memory.agentName)}`}
                        >
                          <Bot className="h-3 w-3" />
                          {memory.agentName}
                        </span>
                        <span className="text-xs text-neutral-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(memory.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-300 truncate">
                        <span className="text-neutral-500">Asked:</span>{" "}
                        {memory.input}
                      </p>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-3 space-y-2"
                        >
                          <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                            <p className="text-xs text-neutral-500 mb-1 uppercase tracking-wider">Result</p>
                            <p className="text-sm text-neutral-300 whitespace-pre-wrap">{memory.output}</p>
                          </div>
                          {memory.tags.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Tag className="h-3 w-3 text-neutral-500" />
                              {memory.tags.map((tag) => (
                                <span
                                  key={tag}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSearchQuery(tag);
                                  }}
                                  className="text-xs px-2 py-0.5 rounded bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white cursor-pointer transition"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 text-neutral-500 group-hover:text-neutral-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Clear Confirmation Dialog */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Clear All Memory</h3>
                  <p className="text-sm text-neutral-400">This cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm text-neutral-400">
                This will permanently delete <strong className="text-white">{stats?.totalMemories ?? 0} memories</strong> from
                both cache and database. Your agents will lose all context they&apos;ve built.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 rounded-lg text-sm text-neutral-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition text-sm font-medium disabled:opacity-50"
                >
                  {clearing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Yes, Clear Everything
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
