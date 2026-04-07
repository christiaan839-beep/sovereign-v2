"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot, CheckCircle2, XCircle, Loader2, Clock,
  ChevronDown, ChevronUp, Play, RefreshCw, Zap,
  BarChart3, Activity,
} from "lucide-react";
import Link from "next/link";

/* ─── Types ─── */

interface RunStep {
  id: string;
  stepIndex: number;
  agentName: string;
  reason: string | null;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  result: string | null;
  error: string | null;
  durationMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface PlaybookRun {
  id: string;
  playbookId: string;
  playbookName: string;
  status: "running" | "done" | "failed";
  stepCount: number;
  stepsSucceeded: number;
  stepsFailed: number;
  durationMs: number | null;
  createdAt: string;
  completedAt: string | null;
  steps: RunStep[];
  progress?: number;
  currentStep?: number;
  done?: boolean;
}

/* ─── Helpers ─── */

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const STEP_STATUS = {
  pending:  { icon: Clock,        color: "text-neutral-500",  bg: "bg-neutral-500/10" },
  running:  { icon: Loader2,      color: "text-blue-400",     bg: "bg-blue-400/10"    },
  done:     { icon: CheckCircle2, color: "text-emerald-400",  bg: "bg-emerald-400/10" },
  failed:   { icon: XCircle,      color: "text-rose-400",     bg: "bg-rose-400/10"    },
  skipped:  { icon: Clock,        color: "text-neutral-600",  bg: "bg-neutral-600/10" },
} as const;

const RUN_STATUS = {
  running: { color: "text-blue-400",    bg: "bg-blue-400/10",    label: "Running"  },
  done:    { color: "text-emerald-400", bg: "bg-emerald-400/10", label: "Done"     },
  failed:  { color: "text-rose-400",    bg: "bg-rose-400/10",    label: "Failed"   },
} as const;

/* ─── Step Row ─── */

function StepRow({ step }: { step: RunStep }) {
  const [open, setOpen] = useState(false);
  const cfg = STEP_STATUS[step.status];
  const Icon = cfg.icon;

  return (
    <div className="rounded-lg border border-white/5 bg-white/2">
      <button
        onClick={() => step.result || step.error ? setOpen(v => !v) : undefined}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${cfg.bg}`}>
          <Icon
            size={11}
            className={`${cfg.color} ${step.status === "running" ? "animate-spin" : ""}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-neutral-300">{step.agentName}</p>
          {step.reason && (
            <p className="truncate text-[11px] text-neutral-600">{step.reason}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {step.durationMs && (
            <span className="text-[11px] text-neutral-600">{formatDuration(step.durationMs)}</span>
          )}
          {(step.result || step.error) && (
            open ? <ChevronUp size={11} className="text-neutral-600" /> : <ChevronDown size={11} className="text-neutral-600" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {open && (step.result || step.error) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="border-t border-white/5 px-3 pb-3 pt-2">
              {step.error ? (
                <p className="font-mono text-[11px] text-rose-400">{step.error}</p>
              ) : (
                <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-neutral-400">
                  {step.result}
                </pre>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Run Card ─── */

function RunCard({ run: initialRun }: { run: PlaybookRun }) {
  const [run, setRun] = useState(initialRun);
  const [expanded, setExpanded] = useState(initialRun.status === "running");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll this specific run while it's running
  useEffect(() => {
    if (run.status !== "running") return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/playbooks/runs/${run.id}`);
        if (res.ok) {
          const data = await res.json();
          setRun(data);
          if (data.done) {
            clearInterval(pollRef.current!);
            pollRef.current = null;
          }
        }
      } catch { /* silent */ }
    };

    pollRef.current = setInterval(poll, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [run.id, run.status]);

  const cfg = RUN_STATUS[run.status];
  const completedSteps = run.steps.filter(s => s.status === "done").length;
  const progress = run.stepCount > 0
    ? Math.round((completedSteps / run.stepCount) * 100)
    : (run.progress ?? 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/8 bg-white/3 overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
          {run.status === "running" ? (
            <Loader2 size={13} className={`${cfg.color} animate-spin`} />
          ) : run.status === "done" ? (
            <CheckCircle2 size={13} className={cfg.color} />
          ) : (
            <XCircle size={13} className={cfg.color} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-100">{run.playbookName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
            <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
            <span>{timeAgo(run.createdAt)}</span>
            {run.durationMs && <span>{formatDuration(run.durationMs)}</span>}
            <span>{run.stepsSucceeded}/{run.stepCount} steps</span>
          </div>

          {run.status === "running" && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
              <motion.div
                className="h-full rounded-full bg-blue-400"
                animate={{ width: `${Math.max(progress, 5)}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          )}
        </div>

        <div className="shrink-0 text-neutral-600">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </div>
      </button>

      {/* Steps */}
      <AnimatePresence>
        {expanded && run.steps.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t border-white/6 px-4 pb-4 pt-3 space-y-1.5">
              {run.steps.map(step => (
                <StepRow key={step.id} step={step} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Main Page ─── */

export default function AutopilotPage() {
  const [runs, setRuns] = useState<PlaybookRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "running" | "done" | "failed">("all");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRuns = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/playbooks/runs");
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch { /* silent */ }
    if (!silent) setLoading(false);
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Background list refresh (less frequent — individual cards do fast polling)
  useEffect(() => {
    const hasLive = runs.some(r => r.status === "running");
    if (hasLive && !pollRef.current) {
      pollRef.current = setInterval(() => fetchRuns(true), 10_000);
    } else if (!hasLive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [runs, fetchRuns]);

  const counts = {
    running: runs.filter(r => r.status === "running").length,
    done:    runs.filter(r => r.status === "done").length,
    failed:  runs.filter(r => r.status === "failed").length,
  };

  return (
    <div className="min-h-screen bg-[#030303] px-4 py-8 text-neutral-200">
      <div className="mx-auto max-w-3xl space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/10">
              <Bot size={18} className="text-violet-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-neutral-100">Autopilot</h1>
              <p className="text-xs text-neutral-500">Agentic playbooks running your business 24/7</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/playbooks"
              className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/4 px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-white/8"
            >
              <Play size={11} />
              Run Playbook
            </Link>
            <button
              onClick={() => fetchRuns()}
              className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/4 px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-white/8"
            >
              <RefreshCw size={11} />
              Refresh
            </button>
          </div>
        </div>

        {/* Live indicator */}
        {counts.running > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 rounded-xl border border-blue-400/20 bg-blue-400/5 px-4 py-3"
          >
            <div className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
            </div>
            <p className="text-sm text-blue-300">
              {counts.running} playbook{counts.running > 1 ? "s" : ""} running now
            </p>
            <Activity size={14} className="ml-auto text-blue-400/60" />
          </motion.div>
        )}

        {/* Stats + Filter */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "All",      value: runs.length,    color: "text-neutral-300", filter: "all" as const },
            { label: "Running",  value: counts.running, color: "text-blue-400",    filter: "running" as const },
            { label: "Done",     value: counts.done,    color: "text-emerald-400", filter: "done" as const },
            { label: "Failed",   value: counts.failed,  color: "text-rose-400",    filter: "failed" as const },
          ].map(s => (
            <button
              key={s.label}
              onClick={() => setStatusFilter(s.filter)}
              className={`rounded-xl border p-4 text-center transition-all ${
                statusFilter === s.filter
                  ? "border-white/15 bg-white/5 ring-1 ring-white/10"
                  : "border-white/6 bg-white/3 hover:border-white/10"
              }`}
            >
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{s.label}</p>
            </button>
          ))}
        </div>

        {/* Run list */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-neutral-500">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading runs…</span>
          </div>
        ) : runs.length === 0 ? (
          <div className="py-16 text-center">
            <BarChart3 size={32} className="mx-auto mb-3 text-neutral-700" />
            <p className="mb-1 text-sm text-neutral-500">No playbook runs yet.</p>
            <p className="text-xs text-neutral-600">
              Go to{" "}
              <Link href="/dashboard/playbooks" className="text-violet-400 hover:underline">
                Playbooks
              </Link>{" "}
              to run your first one.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {runs
                .filter(r => statusFilter === "all" || r.status === statusFilter)
                .map(run => (
                  <RunCard key={run.id} run={run} />
                ))}
            </AnimatePresence>
            {statusFilter !== "all" && runs.filter(r => r.status === statusFilter).length === 0 && (
              <p className="py-8 text-center text-sm text-neutral-600">
                No {statusFilter} runs
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
