"use client";

/**
 * <RecentDagRuns> — dashboard widget showing recent visual-editor
 * playbook executions.
 *
 * Surfaces the playbook_dag_runs table that the run-dag endpoint
 * writes to. The dashboard home gets a "feed" of execution activity
 * — status pill, duration, time, link to the parent DAG.
 *
 * Renders nothing when the user has no runs (clean empty state for
 * first-time visitors). Otherwise shows up to 10 recent runs with a
 * link to "all runs" if we exceed that.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

interface RunSummary {
  id: string;
  dagId: string | null;
  status: "running" | "completed" | "failed";
  nodeCount: number;
  edgeCount: number;
  totalDurationMs: number;
  failedAt: string | null;
  createdAt: string;
}

export function RecentDagRuns() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/playbooks/dag/runs?limit=10")
      .then(async (r) => {
        if (!alive) return;
        if (!r.ok) {
          // 401 from a logged-out user is normal — the widget is
          // rendered inside an authed shell but the fetch boundary is
          // the same edge. Quietly empty in that case.
          setError(r.status === 401 ? null : "Could not load run history");
          setRuns([]);
          return;
        }
        const body = (await r.json()) as { runs: RunSummary[] };
        setRuns(body.runs ?? []);
      })
      .catch(() => {
        if (!alive) return;
        setError("Network error");
        setRuns([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Don't render anything for users with no run history. Keeps the
  // dashboard clean for new accounts; the widget only appears once
  // the user has actually done something.
  if (runs !== null && runs.length === 0 && !error) {
    return null;
  }

  return (
    <section
      aria-label="Recent visual-playbook runs"
      className="rounded-lg border border-white/10 bg-white/[0.02] p-5"
    >
      <header className="flex items-baseline justify-between border-b border-white/5 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-200">
            Recent playbook runs
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Visual-editor executions, newest first
          </p>
        </div>
        <Link
          href="/dashboard/playbooks"
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          View all →
        </Link>
      </header>

      {error && <p className="mt-4 text-xs text-rose-400">{error}</p>}

      {runs === null ? (
        <ul className="mt-4 space-y-2" aria-busy>
          {[0, 1, 2, 3, 4].map((i) => (
            <li
              key={i}
              className="h-10 rounded bg-white/[0.03] animate-pulse"
              aria-hidden
            />
          ))}
        </ul>
      ) : (
        <ul className="mt-4 space-y-1.5">
          {runs.map((r) => {
            const inFlight = r.status === "running";
            const ok = r.status === "completed";
            const glyph = inFlight ? "⟳" : ok ? "✓" : "✗";
            const glyphColor = inFlight
              ? "text-amber-400"
              : ok
                ? "text-emerald-400"
                : "text-rose-400";
            return (
              <li key={r.id}>
                <Link
                  href={`/dashboard/playbooks/runs/${r.id}`}
                  className="flex items-baseline gap-3 rounded px-2 py-1.5 hover:bg-white/[0.04] transition-colors"
                  title="View run detail"
                >
                  <span
                    className={`shrink-0 text-xs font-mono ${glyphColor} ${inFlight ? "animate-pulse" : ""}`}
                    aria-label={r.status}
                  >
                    {glyph}
                  </span>
                  <span className="text-xs text-neutral-300 flex-1 truncate">
                    {r.dagId ? (
                      <span>Playbook · {r.nodeCount}n / {r.edgeCount}e</span>
                    ) : (
                      <span className="text-neutral-500 italic">Anonymous run · {r.nodeCount}n</span>
                    )}
                  </span>
                  {!ok && r.failedAt && (
                    <span className="text-[10px] text-rose-400 font-mono">
                      failed: {r.failedAt}
                    </span>
                  )}
                  <span className="text-[10px] text-neutral-600 font-mono shrink-0">
                    {formatDuration(r.totalDurationMs)}
                  </span>
                  <time
                    dateTime={r.createdAt}
                    className="text-[10px] text-neutral-600 font-mono shrink-0 w-12 text-right"
                    title={new Date(r.createdAt).toLocaleString()}
                  >
                    {relativeTime(r.createdAt)}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
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

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 0) return "now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
