"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Library, Search, FileText, Globe, PenTool, Loader2,
  ChevronRight, Clock, Zap, Filter, CheckCircle2,
} from "lucide-react";
import { MarkdownRenderer } from "@/components/ui/MarkdownRenderer";
import { ExportButtons } from "@/components/ui/ExportButtons";

const TOOL_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  "seo-dominator": { label: "SEO X-Ray", icon: <Globe className="w-3 h-3" />, color: "text-rose-400" },
  "content-factory": { label: "Content Factory", icon: <PenTool className="w-3 h-3" />, color: "text-purple-400" },
  "competitor": { label: "Competitor Intel", icon: <Search className="w-3 h-3" />, color: "text-amber-400" },
  "leads": { label: "Lead Prospector", icon: <Zap className="w-3 h-3" />, color: "text-emerald-400" },
  "architect": { label: "Architect", icon: <FileText className="w-3 h-3" />, color: "text-blue-400" },
  "designer": { label: "Designer", icon: <PenTool className="w-3 h-3" />, color: "text-pink-400" },
};

interface Generation {
  id: string;
  tool: string;
  action: string;
  inputSummary: string | null;
  tokens: number | null;
  createdAt: string;
  output?: string;
}

export default function LibraryPage() {
  const [results, setResults] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOutput, setSelectedOutput] = useState<string | null>(null);
  const [loadingOutput, setLoadingOutput] = useState(false);
  const [filterTool, setFilterTool] = useState<string>("");
  const [usage, setUsage] = useState({ today: 0, total: 0, limit: 20, remaining: 20 });

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", tool: filterTool || undefined }),
      });
      const data = await res.json();
      if (data.success) setResults(data.results || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [filterTool]);

  const loadUsage = async () => {
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "usage" }),
      });
      const data = await res.json();
      if (data.success) setUsage(data);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    loadHistory();
    loadUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTool]);

  const viewOutput = async (id: string) => {
    if (selectedId === id) { setSelectedId(null); return; }
    setSelectedId(id);
    setLoadingOutput(true);
    try {
      const res = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get", id }),
      });
      const data = await res.json();
      if (data.success) setSelectedOutput(data.result.output);
    } catch { /* ignore */ }
    setLoadingOutput(false);
  };

  const getToolInfo = (tool: string) => TOOL_LABELS[tool] || { label: tool, icon: <FileText className="w-3 h-3" />, color: "text-neutral-400" };

  const formatDate = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 bg-[#050505]" role="main" aria-label="Generation history library">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-wider mb-3">
          <Library className="w-3 h-3" /> My Library
        </div>
        <h1 className="text-3xl font-bold font-mono text-white tracking-tight">
          Generation History
        </h1>
        <p className="text-sm text-[#8A95A5] mt-1 font-mono uppercase tracking-widest">
          Every AI output, saved and searchable
        </p>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card border border-glass-border p-4">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">Today</p>
          <p className="text-2xl font-bold text-white">{usage.today}<span className="text-sm text-neutral-500">/{usage.limit}</span></p>
        </div>
        <div className="glass-card border border-glass-border p-4">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">Remaining</p>
          <p className={`text-2xl font-bold ${usage.remaining > 5 ? "text-emerald-400" : usage.remaining > 0 ? "text-amber-400" : "text-rose-400"}`}>
            {usage.remaining}
          </p>
        </div>
        <div className="glass-card border border-glass-border p-4">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">All Time</p>
          <p className="text-2xl font-bold text-white">{usage.total}</p>
        </div>
        <div className="glass-card border border-glass-border p-4">
          <p className="text-[10px] uppercase tracking-widest text-neutral-500 font-bold mb-1">Usage</p>
          <div className="w-full h-2 bg-white/5 rounded-full mt-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-gpu ${usage.remaining > 5 ? "bg-emerald-500" : usage.remaining > 0 ? "bg-amber-500" : "bg-rose-500"}`}
              style={{ width: `${Math.min(100, (usage.today / usage.limit) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex items-center gap-1 text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
          <Filter className="w-3 h-3" /> Filter:
        </div>
        <button
          onClick={() => setFilterTool("")}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-gpu ${!filterTool ? "bg-[#00B7FF]/10 border border-[#00B7FF]/20 text-[#00B7FF]" : "bg-white/5 border border-white/10 text-neutral-500 hover:text-white"}`}
        >
          All
        </button>
        {Object.entries(TOOL_LABELS).map(([key, { label }]) => (
          <button
            key={key}
            onClick={() => setFilterTool(key)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-gpu ${filterTool === key ? "bg-[#00B7FF]/10 border border-[#00B7FF]/20 text-[#00B7FF]" : "bg-white/5 border border-white/10 text-neutral-500 hover:text-white"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Results List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-[#00B7FF] animate-spin" />
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-16">
          <Library className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
          <p className="text-sm text-neutral-500">No generations yet</p>
          <p className="text-[10px] text-neutral-600 mt-1">Run a tool and your results will appear here automatically</p>
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((gen) => {
            const toolInfo = getToolInfo(gen.tool);
            const isOpen = selectedId === gen.id;
            return (
              <motion.div
                key={gen.id}
                layout
                className="glass-card border border-glass-border overflow-hidden"
              >
                <button
                  onClick={() => viewOutput(gen.id)}
                  className="w-full p-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors text-left"
                >
                  <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center ${toolInfo.color}`}>
                    {toolInfo.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{toolInfo.label}</span>
                      <span className="text-[10px] text-neutral-600">•</span>
                      <span className="text-[10px] text-neutral-500 uppercase tracking-wider">{gen.action}</span>
                    </div>
                    {gen.inputSummary && (
                      <p className="text-[11px] text-neutral-400 truncate mt-0.5">{gen.inputSummary}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden md:block">
                      <p className="text-[10px] text-neutral-600"><Clock className="w-2.5 h-2.5 inline mr-1" />{formatDate(gen.createdAt)}</p>
                      {gen.tokens && <p className="text-[10px] text-neutral-700">{gen.tokens.toLocaleString()} tokens</p>}
                    </div>
                    <ChevronRight className={`w-4 h-4 text-neutral-600 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-glass-border"
                    >
                      <div className="p-4 bg-black/30">
                        {loadingOutput ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-5 h-5 text-[#00B7FF] animate-spin" />
                          </div>
                        ) : selectedOutput ? (
                          <>
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-[9px] uppercase tracking-[0.3em] text-emerald-400 font-mono flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Saved Output
                              </span>
                              <ExportButtons content={selectedOutput} filename={`sovereign-${gen.tool}-${gen.action}`} />
                            </div>
                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                              <MarkdownRenderer content={selectedOutput} />
                            </div>
                          </>
                        ) : (
                          <p className="text-xs text-neutral-500">Failed to load output</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
