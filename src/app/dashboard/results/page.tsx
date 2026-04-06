"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  History, Search, RefreshCw, Copy, Play, CheckCircle2,
  Clock, Filter, ChevronDown,
} from "lucide-react";
import Link from "next/link";

/* ─── Types ─── */

interface ActivityItem {
  id: string;
  agentName: string;
  agentType: string;
  action: string;
  summary: string;
  result: string | null;
  metadata: string | null;
  isRead: boolean;
  createdAt: string;
}

/* ─── Agent color map ─── */
const AGENT_COLORS: Record<string, string> = {
  leads: "text-emerald-400",
  "blog-gen": "text-cyan-400",
  "seo-dominator": "text-amber-400",
  "email-sequence": "text-rose-400",
  "competitor-scan": "text-violet-400",
  "brand-voice": "text-pink-400",
  "proposal-generator": "text-blue-400",
  "creative-director": "text-orange-400",
};

function getAgentColor(name: string): string {
  return AGENT_COLORS[name] || "text-neutral-400";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ─── Main Page ─── */

export default function ResultsLibraryPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAgent, setFilterAgent] = useState("all");
  const [showFilter, setShowFilter] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/_misc/inbox?limit=100");
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchActivities(); }, []);

  // Get unique agent names for filter
  const agentNames = [...new Set(activities.map(a => a.agentName))].sort();

  // Filter + search
  const filtered = activities.filter(a => {
    if (filterAgent !== "all" && a.agentName !== filterAgent) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.agentName.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        (a.result || "").toLowerCase().includes(q);
    }
    return true;
  });

  const copyResult = (item: ActivityItem) => {
    const text = item.result || item.summary;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <History className="w-6 h-6 text-emerald-400" />
              Results Library
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Every agent output, searchable and re-runnable
            </p>
          </div>
          <button
            onClick={fetchActivities}
            disabled={loading}
            className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-neutral-400 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Search + Filter */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search results..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-emerald-500/30"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setShowFilter(!showFilter)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/[0.08] bg-white/[0.04] text-sm text-neutral-300 hover:bg-white/[0.06] transition-colors"
            >
              <Filter className="w-3.5 h-3.5" />
              {filterAgent === "all" ? "All agents" : filterAgent}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showFilter && (
              <div className="absolute top-full right-0 mt-1 w-48 rounded-lg border border-white/[0.08] bg-[#0A0A0A] shadow-xl z-20 py-1 max-h-60 overflow-y-auto">
                <button
                  onClick={() => { setFilterAgent("all"); setShowFilter(false); }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 ${filterAgent === "all" ? "text-emerald-400" : "text-neutral-300"}`}
                >
                  All agents
                </button>
                {agentNames.map(name => (
                  <button
                    key={name}
                    onClick={() => { setFilterAgent(name); setShowFilter(false); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 ${filterAgent === name ? "text-emerald-400" : "text-neutral-300"}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Results count */}
        <div className="text-xs text-neutral-600 mb-4">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          {search && ` matching "${search}"`}
          {filterAgent !== "all" && ` from ${filterAgent}`}
        </div>

        {/* Results List */}
        {loading && activities.length === 0 ? (
          <div className="text-center py-20">
            <RefreshCw className="w-6 h-6 text-neutral-600 animate-spin mx-auto mb-3" />
            <p className="text-sm text-neutral-500">Loading results...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <History className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
            <p className="text-sm text-neutral-500">
              {activities.length === 0 ? "No agent results yet. Run an agent to see results here." : "No results match your search."}
            </p>
            {activities.length === 0 && (
              <Link href="/dashboard/leads" className="text-xs text-emerald-500 hover:text-emerald-400 mt-2 inline-block">
                Try the Lead Finder →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item, i) => {
              const meta = item.metadata ? JSON.parse(item.metadata) : {};
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 hover:bg-white/[0.03] transition-colors group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-bold ${getAgentColor(item.agentName)}`}>
                        {item.agentName}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        item.action === "completed" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                      }`}>
                        {item.action}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {meta.durationMs && (
                        <span className="text-[10px] text-neutral-600 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {(meta.durationMs / 1000).toFixed(1)}s
                        </span>
                      )}
                      <span className="text-[10px] text-neutral-600 ml-2">
                        {timeAgo(item.createdAt)}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-neutral-300 line-clamp-2 mb-3">
                    {item.summary}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => copyResult(item)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-xs text-neutral-400 transition-colors"
                    >
                      {copiedId === item.id ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copiedId === item.id ? "Copied" : "Copy"}
                    </button>
                    <Link
                      href={`/dashboard/${item.agentName}`}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-xs text-neutral-400 transition-colors"
                    >
                      <Play className="w-3 h-3" />
                      Re-run
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
