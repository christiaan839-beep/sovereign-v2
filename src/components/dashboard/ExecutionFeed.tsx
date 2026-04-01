"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, CheckCircle2, AlertTriangle, Clock, Trash2,
  ChevronDown, ChevronUp, Brain, Target, Search,
  FileText, Code2, Shield, Globe, Sparkles, Mic,
} from "lucide-react";

/* ─── Types ─── */

type ExecutionStatus = "running" | "complete" | "failed";

interface ExecutionEntry {
  id: string;
  agentName: string;
  agentColor: string;
  model: string;
  status: ExecutionStatus;
  startedAt: number;
  duration?: number;
  output?: string;
  icon: React.ComponentType<{ className?: string }>;
}

/* ─── Agent Presets (used for demo data) ─── */

const AGENT_PRESETS = [
  { name: "Lead Hunter", color: "#10b981", model: "gemini-2.5-flash", icon: Target },
  { name: "Site Assassin", color: "#ef4444", model: "claude-sonnet-4", icon: Shield },
  { name: "Content Engine", color: "#8b5cf6", model: "deepseek-v3", icon: FileText },
  { name: "SEO Dominator", color: "#ec4899", model: "gemini-2.5-pro", icon: Search },
  { name: "Code Agent", color: "#06b6d4", model: "claude-sonnet-4", icon: Code2 },
  { name: "Voice Closer", color: "#f59e0b", model: "elevenlabs-tts", icon: Mic },
  { name: "God Brain", color: "#a855f7", model: "claude-opus-4", icon: Brain },
  { name: "Web Scraper", color: "#3b82f6", model: "groq-llama-70b", icon: Globe },
  { name: "Anti-Slop Filter", color: "#14b8a6", model: "deepseek-r1", icon: Sparkles },
];

const SAMPLE_OUTPUTS = [
  "Found 47 qualified leads matching ICP criteria. Top prospect: Acme Corp (Series B, $12M ARR). Enriched with email + phone for 38 contacts.",
  "Competitor teardown complete. Target site uses Next.js + Vercel. Missing schema markup on 23 pages. Content gap: 15 high-value keywords they don't rank for.",
  "Generated 5 blog posts (avg 1,800 words). AI detection score: 3.2% (human-like). SEO optimization applied. Ready for review.",
  "Full site audit complete. Score: 74/100. Critical: 3 broken canonical tags, missing alt text on 12 images. Quick wins identified.",
  "Voice call completed. Duration: 4m 32s. Prospect qualified (BANT: 4/4). Meeting booked for Thursday 2pm.",
  "Code generated: 3 React components, 2 API routes, 1 database migration. All tests passing (14/14). Ready for deployment.",
];

/* ─── Feed Component ─── */

const MAX_ENTRIES = 20;

export function ExecutionFeed() {
  const [entries, setEntries] = useState<ExecutionEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate a simulated execution entry
  const addExecution = useCallback(() => {
    const preset = AGENT_PRESETS[Math.floor(Math.random() * AGENT_PRESETS.length)];
    const id = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const entry: ExecutionEntry = {
      id,
      agentName: preset.name,
      agentColor: preset.color,
      model: preset.model,
      status: "running",
      startedAt: Date.now(),
      icon: preset.icon,
    };

    setEntries((prev) => [entry, ...prev].slice(0, MAX_ENTRIES));

    // Complete after random duration
    const duration = 2000 + Math.random() * 8000;
    setTimeout(() => {
      const succeeded = Math.random() > 0.1; // 90% success rate
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                status: succeeded ? "complete" : "failed",
                duration,
                output: succeeded
                  ? SAMPLE_OUTPUTS[Math.floor(Math.random() * SAMPLE_OUTPUTS.length)]
                  : "Error: Rate limit exceeded. Retrying in 30s...",
              }
            : e
        )
      );
    }, duration);
  }, []);

  // Auto-generate executions for demo
  useEffect(() => {
    // Start with a few entries
    const initial = setTimeout(() => addExecution(), 500);
    const second = setTimeout(() => addExecution(), 1500);
    const third = setTimeout(() => addExecution(), 3000);

    // Then periodically add more
    const interval = setInterval(() => {
      if (Math.random() > 0.4) addExecution();
    }, 6000);

    return () => {
      clearTimeout(initial);
      clearTimeout(second);
      clearTimeout(third);
      clearInterval(interval);
    };
  }, [addExecution]);

  // Auto-scroll to top when new entry arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [entries.length]);

  const clearFeed = () => {
    setEntries([]);
    setExpandedId(null);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  const runningCount = entries.filter((e) => e.status === "running").length;

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#00B7FF]" />
            <span className="text-sm font-semibold text-white">Live Executions</span>
          </div>
          {runningCount > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-2 h-2 rounded-full bg-emerald-400"
              />
              <span className="text-[10px] font-mono text-emerald-400">{runningCount} active</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-neutral-600">{entries.length} entries</span>
          {entries.length > 0 && (
            <button
              onClick={clearFeed}
              className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-300 hover:bg-white/5 transition-colors"
              title="Clear feed"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Feed */}
      <div ref={scrollRef} className="max-h-[480px] overflow-y-auto custom-scrollbar">
        <AnimatePresence initial={false}>
          {entries.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <Zap className="w-6 h-6 text-neutral-700 mx-auto mb-2" />
              <p className="text-sm text-neutral-600">No executions yet</p>
              <p className="text-[11px] text-neutral-700 mt-1">Agent activity will appear here in real-time</p>
            </div>
          ) : (
            entries.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const Icon = entry.icon;

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-b border-white/[0.03] last:border-b-0"
                >
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors text-left"
                  >
                    {/* Agent icon */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${entry.agentColor}15`, color: entry.agentColor }}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-200 truncate">{entry.agentName}</span>
                        {entry.status === "running" && (
                          <motion.div
                            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.4, 1] }}
                            transition={{ repeat: Infinity, duration: 1.2 }}
                            className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"
                          />
                        )}
                        {entry.status === "complete" && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        )}
                        {entry.status === "failed" && (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono text-neutral-600">{entry.model}</span>
                        <span className="text-[10px] text-neutral-700">{formatTime(entry.startedAt)}</span>
                      </div>
                    </div>

                    {/* Duration + expand */}
                    <div className="flex items-center gap-2 shrink-0">
                      {entry.status === "running" ? (
                        <RunningTimer startedAt={entry.startedAt} />
                      ) : entry.duration ? (
                        <span className="text-[10px] font-mono text-neutral-500">
                          {formatDuration(entry.duration)}
                        </span>
                      ) : null}
                      {entry.output && (
                        isExpanded
                          ? <ChevronUp className="w-3.5 h-3.5 text-neutral-600" />
                          : <ChevronDown className="w-3.5 h-3.5 text-neutral-600" />
                      )}
                    </div>
                  </button>

                  {/* Expanded output */}
                  <AnimatePresence>
                    {isExpanded && entry.output && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className={`mx-4 mb-3 p-3 rounded-lg text-xs leading-relaxed font-mono whitespace-pre-wrap ${
                          entry.status === "failed"
                            ? "bg-rose-500/5 border border-rose-500/10 text-rose-300"
                            : "bg-white/[0.02] border border-white/5 text-neutral-400"
                        }`}>
                          {entry.output}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Running Timer (live counter) ─── */

function RunningTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startedAt);
    }, 100);
    return () => clearInterval(interval);
  }, [startedAt]);

  const seconds = Math.floor(elapsed / 1000);
  const tenths = Math.floor((elapsed % 1000) / 100);

  return (
    <span className="text-[10px] font-mono text-emerald-400 tabular-nums flex items-center gap-1">
      <Clock className="w-3 h-3" />
      {seconds}.{tenths}s
    </span>
  );
}
