"use client";

/**
 * <DagStatsPanel> — per-DAG analytics card on the editor page.
 *
 * Shows aggregate reliability + performance for the playbook the
 * user is editing. Procurement's "what's your success rate per
 * playbook?" question gets a real answer from real data.
 *
 * Renders nothing (returns null) until the DAG has at least one
 * recorded run — the first-run experience stays clean.
 *
 * Refreshes when `dagId` changes (user switches between playbooks).
 */

import { useEffect, useState } from "react";
import Link from "next/link";

interface DagStats {
  totalRuns: number;
  completedRuns: number;
  failedRuns: number;
  runningRuns: number;
  successRate: number;
  p50DurationMs: number | null;
  p95DurationMs: number | null;
  lastRunAt: string | null;
  lastRunStatus: "running" | "completed" | "failed" | null;
  lastRunDurationMs: number | null;
}

interface DagStatsPanelProps {
  dagId: string | null;
}

export function DagStatsPanel({ dagId }: DagStatsPanelProps) {
  const [stats, setStats] = useState<DagStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dagId) {
      setStats(null);
      return;
    }
    let alive = true;
    fetch(`/api/playbooks/dag/${dagId}/stats`)
      .then(async (r) => {
        if (!alive) return;
        if (!r.ok) {
          // 404 / 401 / 500 — keep the panel hidden rather than
          // showing an error stripe. The user is editing a playbook;
          // a missing-stats panel isn't worth a banner.
          setStats(null);
          setError(null);
          return;
        }
        const body = (await r.json()) as { stats: DagStats };
        setStats(body.stats);
      })
      .catch(() => {
        if (!alive) return;
        setError("Network error");
        setStats(null);
      });
    return () => {
      alive = false;
    };
  }, [dagId]);

  if (!dagId || !stats || stats.totalRuns === 0) {
    return null;
  }

  const successPct = Math.round(stats.successRate * 100);
  const successColor =
    successPct >= 90
      ? "text-emerald-300"
      : successPct >= 70
        ? "text-amber-300"
        : "text-rose-300";

  return (
    <section
      aria-label="Playbook reliability"
      className="rounded-lg border border-white/10 bg-white/[0.02] p-5"
    >
      <header className="flex items-baseline justify-between border-b border-white/5 pb-3">
        <div>
          <h2 className="text-xs uppercase tracking-wider text-neutral-500">
            Reliability ({stats.totalRuns} run
            {stats.totalRuns === 1 ? "" : "s"})
          </h2>
        </div>
        {error && <span className="text-[10px] text-rose-400">{error}</span>}
      </header>

      <dl className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat
          label="Success rate"
          value={`${successPct}%`}
          tone={successColor}
          sublabel={`${stats.completedRuns}✓ ${stats.failedRuns}✗${stats.runningRuns > 0 ? ` ${stats.runningRuns}⟳` : ""}`}
        />
        <Stat
          label="p50 duration"
          value={
            stats.p50DurationMs !== null
              ? formatDuration(stats.p50DurationMs)
              : "—"
          }
          tone="text-neutral-200"
          sublabel={
            stats.p50DurationMs === null
              ? "needs ≥5 runs"
              : "median"
          }
        />
        <Stat
          label="p95 duration"
          value={
            stats.p95DurationMs !== null
              ? formatDuration(stats.p95DurationMs)
              : "—"
          }
          tone="text-neutral-200"
          sublabel={
            stats.p95DurationMs === null
              ? "needs ≥5 runs"
              : "tail latency"
          }
        />
        <Stat
          label="Last run"
          value={
            stats.lastRunStatus === "completed"
              ? "✓"
              : stats.lastRunStatus === "failed"
                ? "✗"
                : stats.lastRunStatus === "running"
                  ? "⟳"
                  : "—"
          }
          tone={
            stats.lastRunStatus === "completed"
              ? "text-emerald-300"
              : stats.lastRunStatus === "failed"
                ? "text-rose-300"
                : stats.lastRunStatus === "running"
                  ? "text-amber-300"
                  : "text-neutral-500"
          }
          sublabel={
            stats.lastRunAt
              ? formatRelative(stats.lastRunAt)
              : "no runs yet"
          }
        />
      </dl>

      <footer className="mt-3 text-[10px] text-neutral-500">
        <Link
          href={`/dashboard/playbooks/runs?dagId=${dagId}`}
          className="hover:text-neutral-300 underline-offset-4 hover:underline"
        >
          View all runs →
        </Link>
      </footer>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
  sublabel,
}: {
  label: string;
  value: string;
  tone: string;
  sublabel: string;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-neutral-500">
        {label}
      </dt>
      <dd className={`mt-1 text-xl font-bold ${tone}`}>{value}</dd>
      <dd className="text-[10px] text-neutral-600 font-mono">{sublabel}</dd>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m${seconds.toString().padStart(2, "0")}s`;
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 0) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
