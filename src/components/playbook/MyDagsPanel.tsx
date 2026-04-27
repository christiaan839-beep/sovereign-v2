"use client";

/**
 * <MyDagsPanel> — sidebar in the visual editor showing the user's
 * other saved DAGs.
 *
 * Lets the user switch between playbooks without going back to the
 * playbooks index page. Highlights the currently-loaded DAG. Shows a
 * status pill (last run state) so the user can see at a glance which
 * playbooks are healthy and which are failing.
 *
 * Renders nothing (returns null) when the list is empty AND the user
 * hasn't saved the current playbook yet — first-run experience stays
 * clean.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

interface DagSummary {
  id: string;
  name: string;
  status: "draft" | "published" | "archived";
  nodeCount: number;
  edgeCount: number;
  lastRunAt: string | null;
  lastRunStatus: "completed" | "failed" | null;
  updatedAt: string;
}

interface MyDagsPanelProps {
  /** The DAG currently open in the editor (highlight target). null on a
      fresh "new" page that hasn't been saved yet. */
  currentDagId: string | null;
}

export function MyDagsPanel({ currentDagId }: MyDagsPanelProps) {
  const [dags, setDags] = useState<DagSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/playbooks/dag")
      .then(async (r) => {
        if (!alive) return;
        if (!r.ok) {
          setError(r.status === 401 ? "Sign in to see saved playbooks" : "Could not load");
          setDags([]);
          return;
        }
        const body = (await r.json()) as { dags: DagSummary[] };
        setDags(body.dags ?? []);
      })
      .catch(() => {
        if (!alive) return;
        setError("Network error");
        setDags([]);
      });
    return () => {
      alive = false;
    };
    // The currentDagId in deps lets the panel refresh when a fresh
    // save creates a new id (the editor's router.replace triggers a
    // remount of the param-driven page, which propagates here).
  }, [currentDagId]);

  // First-run UX: until the user has saved at least one DAG, the
  // panel takes up no space. Shows up after the first save lands and
  // there's actually content to show.
  if (dags !== null && dags.length === 0 && currentDagId === null && !error) {
    return null;
  }

  return (
    <aside
      aria-label="My playbooks"
      className="w-[260px] shrink-0 self-start rounded-lg border border-white/10 bg-white/[0.02] p-3"
    >
      <header className="flex items-baseline justify-between border-b border-white/5 pb-2">
        <h2 className="text-xs uppercase tracking-wider text-neutral-500">
          My playbooks
        </h2>
        <Link
          href="/dashboard/playbooks/edit/new"
          className="text-xs text-emerald-400 hover:text-emerald-300"
          title="New playbook"
        >
          + new
        </Link>
      </header>

      {error && (
        <p className="mt-3 text-xs text-rose-400">{error}</p>
      )}

      {dags === null ? (
        <ul className="mt-3 space-y-2" aria-busy>
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="h-12 rounded bg-white/[0.03] animate-pulse"
              aria-hidden
            />
          ))}
        </ul>
      ) : (
        <ul className="mt-3 space-y-1 max-h-[480px] overflow-y-auto">
          {dags.map((d) => {
            const isActive = d.id === currentDagId;
            const statusColor =
              d.lastRunStatus === "completed"
                ? "bg-emerald-500"
                : d.lastRunStatus === "failed"
                  ? "bg-rose-500"
                  : "bg-neutral-600";
            return (
              <li key={d.id}>
                <Link
                  href={`/dashboard/playbooks/edit/${d.id}`}
                  className={`block rounded px-2 py-2 text-xs transition-colors ${
                    isActive
                      ? "bg-emerald-500/10 ring-1 ring-emerald-500/30 text-emerald-100"
                      : "text-neutral-300 hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${statusColor}`}
                      aria-hidden
                    />
                    <span className="flex-1 truncate font-medium">{d.name}</span>
                  </div>
                  <div className="mt-1 ml-3.5 flex items-baseline gap-2 text-[10px] text-neutral-500 font-mono">
                    <span>
                      {d.nodeCount}n / {d.edgeCount}e
                    </span>
                    {d.lastRunAt && (
                      <span>· last run {relativeTime(d.lastRunAt)}</span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

/**
 * Compact relative time. We avoid a full library here (date-fns is
 * already in the bundle but adding a tree-shake import is overkill
 * for one helper). The output is best-effort: "2m", "3h", "5d".
 */
function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 0) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}
