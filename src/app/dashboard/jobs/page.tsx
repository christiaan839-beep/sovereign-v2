"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EmptyState } from "@/components/ui/EmptyState";
import { timeAgo, formatDuration } from "@/lib/format-time";
import {
  Zap, Clock, CheckCircle2, XCircle, Loader2,
  RefreshCw, ChevronDown, ChevronUp, Copy, Play,
  RotateCcw,
} from "lucide-react";

/* ─── Types ─── */

interface Job {
  id: string;
  goal: string;
  status: "pending" | "running" | "done" | "failed";
  progress: number | null;
  agents: string[];
  result: unknown;
  error: string | null;
  durationMs: number | null;
  createdAt: string;
  completedAt: string | null;
  done: boolean;
}

const STATUS_CONFIG = {
  pending:  { icon: Clock,        color: "text-amber-400",   bg: "bg-amber-400/10",   label: "Pending"  },
  running:  { icon: Loader2,      color: "text-blue-400",    bg: "bg-blue-400/10",    label: "Running"  },
  done:     { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10", label: "Done"     },
  failed:   { icon: XCircle,      color: "text-rose-400",    bg: "bg-rose-400/10",    label: "Failed"   },
} as const;

/* ─── Job Card ─── */

function JobCard({ job, onRerun }: { job: Job; onRerun: (goal: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const cfg = STATUS_CONFIG[job.status];
  const StatusIcon = cfg.icon;

  const resultText = job.result
    ? typeof job.result === "string"
      ? job.result
      : JSON.stringify(job.result, null, 2)
    : null;

  const handleCopy = async () => {
    if (!resultText) return;
    await navigator.clipboard.writeText(resultText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/8 bg-white/3 backdrop-blur-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
          <StatusIcon
            size={14}
            className={`${cfg.color} ${job.status === "running" ? "animate-spin" : ""}`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-100">{job.goal}</p>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
            <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
            <span>{timeAgo(job.createdAt)}</span>
            {job.durationMs && <span>{formatDuration(job.durationMs)}</span>}
            {job.agents.length > 0 && (
              <span className="text-neutral-600">
                {job.agents.join(" → ")}
              </span>
            )}
          </div>

          {/* Progress bar for running jobs */}
          {job.status === "running" && (
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/5">
              <motion.div
                className="h-full rounded-full bg-blue-400"
                initial={{ width: "10%" }}
                animate={{ width: `${job.progress ?? 30}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {job.status === "done" && resultText && (
            <button
              onClick={handleCopy}
              title="Copy result"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/8 hover:text-neutral-200"
            >
              {copied ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
            </button>
          )}
          <button
            onClick={() => onRerun(job.goal)}
            title="Re-run"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/8 hover:text-neutral-200"
          >
            <RotateCcw size={13} />
          </button>
          {(resultText || job.error) && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 transition hover:bg-white/8 hover:text-neutral-200"
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          )}
        </div>
      </div>

      {/* Expanded result */}
      <AnimatePresence>
        {expanded && (resultText || job.error) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="border-t border-white/6 px-4 pb-4 pt-3">
              {job.error ? (
                <p className="font-mono text-xs text-rose-400">{job.error}</p>
              ) : (
                <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-neutral-300">
                  {resultText}
                </pre>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ─── Main Page ─── */

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newGoal, setNewGoal] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch { /* silent */ }
    if (!silent) setLoading(false);
  }, []);

  // Auto-refresh every 3s when any job is running/pending
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const hasLive = jobs.some(j => j.status === "pending" || j.status === "running");
    if (hasLive && !pollRef.current) {
      pollRef.current = setInterval(() => fetchJobs(true), 3000);
    } else if (!hasLive && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobs, fetchJobs]);

  const submitJob = async (goal: string) => {
    if (!goal.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim() }),
      });
      if (res.ok) {
        setNewGoal("");
        await fetchJobs(true);
      }
    } catch { /* silent */ }
    setSubmitting(false);
  };

  const counts = {
    total: jobs.length,
    done: jobs.filter(j => j.status === "done").length,
    running: jobs.filter(j => j.status === "running" || j.status === "pending").length,
    failed: jobs.filter(j => j.status === "failed").length,
  };

  return (
    <div className="min-h-screen bg-[#030303] px-4 py-8 text-neutral-200">
      <div className="mx-auto max-w-3xl space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10">
              <Zap size={18} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-neutral-100">Background Jobs</h1>
              <p className="text-xs text-neutral-500">Fire-and-forget agent runs · results via Telegram</p>
            </div>
          </div>
          <button
            onClick={() => fetchJobs()}
            className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/4 px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-white/8"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Done", value: counts.done, color: "text-emerald-400" },
            { label: "Running", value: counts.running, color: "text-blue-400" },
            { label: "Failed", value: counts.failed, color: "text-rose-400" },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-white/6 bg-white/3 p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="mt-0.5 text-xs text-neutral-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* New job input */}
        <div className="rounded-xl border border-white/8 bg-white/3 p-4">
          <p className="mb-3 text-xs font-medium text-neutral-400">Queue a new background job</p>
          <div className="flex gap-2">
            <input
              value={newGoal}
              onChange={e => setNewGoal(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submitJob(newGoal)}
              placeholder="Find 20 dental clinics in Cape Town and draft cold emails…"
              className="flex-1 rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-emerald-400/40 focus:ring-1 focus:ring-emerald-400/20"
            />
            <button
              onClick={() => submitJob(newGoal)}
              disabled={submitting || !newGoal.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-emerald-400 disabled:opacity-40"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
              Run
            </button>
          </div>
        </div>

        {/* Job list */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-neutral-500">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Loading jobs…</span>
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            title="No jobs yet"
            description="Queue a long-running agent job above — useful for background tasks that take 30s+. Jobs land here and notify you via Telegram when done."
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {jobs.map(job => (
                <JobCard key={job.id} job={job} onRerun={goal => setNewGoal(goal)} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
