"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Send, Loader2, CheckCircle2, XCircle, Clock,
  Target, FileText, Search, Mail, Shield, Brain,
  ArrowRight, Sparkles, Activity, Globe,
} from "lucide-react";

/**
 * MISSION CONTROL — The Manus-Killer Experience
 *
 * One input box. Type any goal. Watch agents execute in real-time.
 * Each step shows: which agent, what it's doing, how long it took.
 * The "watching AI work" experience that makes demo videos go viral.
 */

// Map agent names to icons and colors
const AGENT_VISUALS: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  "leads": { icon: Target, color: "emerald" },
  "email-sequence": { icon: Mail, color: "cyan" },
  "seo-dominator": { icon: Search, color: "violet" },
  "site-assassin": { icon: Globe, color: "red" },
  "competitor-scan": { icon: Shield, color: "orange" },
  "blog-gen": { icon: FileText, color: "blue" },
  "smart-router": { icon: Brain, color: "amber" },
  "omni-search": { icon: Search, color: "cyan" },
  "deep-think": { icon: Brain, color: "violet" },
  "proposal-generator": { icon: FileText, color: "emerald" },
  "case-study": { icon: FileText, color: "pink" },
  "brand-voice": { icon: Sparkles, color: "violet" },
  "content": { icon: FileText, color: "blue" },
  "funnel-xray": { icon: Activity, color: "orange" },
  "contract-analyzer": { icon: Shield, color: "amber" },
  "ad-report": { icon: Target, color: "pink" },
};

function getAgentVisual(agent: string) {
  return AGENT_VISUALS[agent] || { icon: Zap, color: "neutral" };
}

const COLOR_CLASSES: Record<string, string> = {
  emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  red: "text-red-400 bg-red-500/10 border-red-500/20",
  orange: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  pink: "text-pink-400 bg-pink-500/10 border-pink-500/20",
  neutral: "text-neutral-400 bg-white/5 border-white/10",
};

interface LiveStep {
  agent: string;
  reason: string;
  status: "pending" | "running" | "success" | "failed";
  duration_ms?: number;
  preview?: string;
}

const EXAMPLE_GOALS = [
  "Find 50 fintech companies in London and draft outreach emails",
  "Analyze competitor.com — SEO, pricing, and positioning gaps",
  "Write an SEO blog about AI agents and create social posts from it",
  "Review this contract for risks and draft a response letter",
  "Research Acme Corp for my sales call tomorrow — talking points and objections",
];

export default function MissionControlPage() {
  const [goal, setGoal] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<LiveStep[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Elapsed time counter
  useEffect(() => {
    if (running) {
      const start = Date.now();
      timerRef.current = setInterval(() => setElapsed(Date.now() - start), 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running]);

  const execute = async () => {
    if (!goal.trim() || running) return;
    setRunning(true);
    setSteps([]);
    setSummary(null);
    setElapsed(0);

    // Show "Planning..." step immediately
    setSteps([{ agent: "super-agent", reason: "Understanding goal and planning execution...", status: "running" }]);

    try {
      const res = await fetch("/api/agents/super-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim(), confirmed: true }),
      });

      const data = await res.json();

      if (data.plan && Array.isArray(data.plan)) {
        // Show the plan with results
        const liveSteps: LiveStep[] = data.plan.map((step: { agent: string; reason: string }, i: number) => {
          const result = data.results?.[i];
          return {
            agent: step.agent,
            reason: step.reason,
            status: result?.status || "pending",
            duration_ms: result?.duration_ms,
            preview: result?.data ? JSON.stringify(result.data).slice(0, 200) : result?.error,
          };
        });
        setSteps(liveSteps);
        setSummary(data.summary || null);
      } else if (data.error) {
        setSteps([{ agent: "super-agent", reason: data.error, status: "failed" }]);
      }
    } catch (err) {
      setSteps([{ agent: "super-agent", reason: err instanceof Error ? err.message : "Network error", status: "failed" }]);
    } finally {
      setRunning(false);
    }
  };

  const reset = () => {
    setGoal("");
    setSteps([]);
    setSummary(null);
    setElapsed(0);
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-[#050505] p-6 md:p-10">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-40" />
              <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">Mission Control</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight mb-2">
            One goal. Multiple agents. Real results.
          </h1>
          <p className="text-sm text-neutral-500 max-w-lg mx-auto">
            Type what you want to accomplish. The Super Agent plans the execution, picks the right agents, and delivers results — all automatically.
          </p>
        </motion.div>

        {/* Input */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && execute()}
              placeholder="Describe your goal..."
              disabled={running}
              className="w-full bg-[#0A0A0A] border border-white/[0.08] rounded-2xl px-6 py-5 pr-16 text-base text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/30 transition-colors disabled:opacity-50"
            />
            <button
              onClick={execute}
              disabled={running || !goal.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/25 transition-colors disabled:opacity-30"
            >
              {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>

          {/* Example goals */}
          {steps.length === 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {EXAMPLE_GOALS.map((eg) => (
                <button
                  key={eg}
                  onClick={() => setGoal(eg)}
                  className="text-[10px] px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-neutral-500 hover:text-emerald-400 hover:border-emerald-500/20 transition-colors"
                >
                  {eg.length > 50 ? eg.slice(0, 50) + "..." : eg}
                </button>
              ))}
            </div>
          )}
        </motion.div>

        {/* Elapsed timer */}
        {(running || steps.length > 0) && (
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-neutral-500">
              {running ? "Executing..." : "Complete"}
            </span>
            <span className="text-xs font-mono text-neutral-500">
              {(elapsed / 1000).toFixed(1)}s
            </span>
          </div>
        )}

        {/* Live execution steps */}
        <div className="space-y-3">
          <AnimatePresence>
            {steps.map((step, i) => {
              const visual = getAgentVisual(step.agent);
              const Icon = visual.icon;
              const colorClass = COLOR_CLASSES[visual.color] || COLOR_CLASSES.neutral;

              return (
                <motion.div
                  key={`${step.agent}-${i}`}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`rounded-2xl border p-5 transition-all ${
                    step.status === "running"
                      ? `${colorClass} ring-1 ring-emerald-500/20`
                      : step.status === "success"
                      ? "bg-emerald-500/5 border-emerald-500/15"
                      : step.status === "failed"
                      ? "bg-red-500/5 border-red-500/15"
                      : "bg-white/[0.02] border-white/[0.06]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Status icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colorClass}`}>
                      {step.status === "running" ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : step.status === "success" ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : step.status === "failed" ? (
                        <XCircle className="w-5 h-5 text-red-400" />
                      ) : (
                        <Clock className="w-5 h-5 text-neutral-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`w-3.5 h-3.5 ${colorClass.split(" ")[0]}`} />
                        <span className="text-xs font-mono text-neutral-500">{step.agent}</span>
                        {step.duration_ms && (
                          <span className="text-[10px] text-neutral-500 font-mono">{(step.duration_ms / 1000).toFixed(1)}s</span>
                        )}
                      </div>
                      <p className="text-sm text-white">{step.reason}</p>
                    </div>
                  </div>

                  {/* Preview of result */}
                  {step.preview && step.status === "success" && (
                    <div className="mt-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-xs text-neutral-500 font-mono truncate">
                      {step.preview}
                    </div>
                  )}

                  {/* Error */}
                  {step.preview && step.status === "failed" && (
                    <div className="mt-3 p-3 rounded-xl bg-red-500/5 border border-red-500/10 text-xs text-red-400">
                      {step.preview}
                    </div>
                  )}

                  {/* Running progress bar */}
                  {step.status === "running" && (
                    <div className="mt-3 h-1 rounded-full bg-white/[0.04] overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                        animate={{ width: ["0%", "100%"] }}
                        transition={{ duration: 15, ease: "linear" }}
                      />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Summary */}
        {summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-semibold text-white">Mission Complete</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-400">
                  {(summary as Record<string, number>).succeeded || 0}
                </p>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Succeeded</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-400">
                  {(summary as Record<string, number>).failed || 0}
                </p>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Failed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-white">
                  {(((summary as Record<string, number>).total_duration_ms || 0) / 1000).toFixed(1)}s
                </p>
                <p className="text-[10px] text-neutral-500 uppercase tracking-wider">Total Time</p>
              </div>
            </div>

            <button
              onClick={reset}
              className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-neutral-400 hover:text-white transition-colors"
            >
              <ArrowRight className="w-4 h-4" /> Run Another Mission
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
