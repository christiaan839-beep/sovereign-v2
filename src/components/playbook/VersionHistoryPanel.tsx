"use client";

/**
 * <VersionHistoryPanel> — sidebar in the visual editor showing the
 * append-only version history of the current DAG.
 *
 * The "I broke something — give me yesterday's version back" UX. Every
 * save creates a numbered version (Round 24); this panel surfaces them
 * newest-first with a one-click restore.
 *
 * Restoration is an APPEND, not a mutation. Clicking restore on v3
 * doesn't roll the timeline back — it appends a new version (say v8)
 * whose payload is a copy of v3's, with `restoredFromVersion` pointing
 * back. The history stays honest.
 *
 * Renders nothing when:
 *   - dagId is null (fresh "new" page that hasn't been saved yet)
 *   - the DAG has 0 versions (DB has no version_count yet — pre-Round-24
 *     rows that haven't been re-saved)
 *
 * Auto-refreshes when `dagVersion` changes (the parent's save handler
 * sets it from the POST response, which is how this panel learns about
 * a fresh save without polling).
 */

import { useEffect, useState } from "react";

interface VersionSummary {
  id: string;
  version: number;
  note: string | null;
  restoredFromVersion: number | null;
  createdAt: string;
  nodeCount: number;
  edgeCount: number;
}

interface Props {
  /** The DAG currently open in the editor. null on "new" pages. */
  dagId: string | null;
  /** Latest version number after the most recent save — used as a
   *  refresh signal so the panel re-fetches without polling. The
   *  parent sets this from POST /api/playbooks/dag's response. */
  dagVersion: number | null;
  /** Called after a successful restore so the parent can re-hydrate
   *  the editor from the now-current shape. */
  onRestored: () => void;
}

export function VersionHistoryPanel({ dagId, dagVersion, onRestored }: Props) {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  const [versionCount, setVersionCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (!dagId) {
      setVersions(null);
      return;
    }

    let alive = true;
    setError(null);
    fetch(`/api/playbooks/dag/${dagId}/versions`)
      .then(async (r) => {
        if (!alive) return;
        if (!r.ok) {
          setError(r.status === 404 ? "Playbook not found" : "Could not load history");
          setVersions([]);
          return;
        }
        const body = (await r.json()) as {
          versions: VersionSummary[];
          versionCount: number;
        };
        setVersions(body.versions ?? []);
        setVersionCount(body.versionCount ?? 0);
      })
      .catch(() => {
        if (!alive) return;
        setError("Network error");
        setVersions([]);
      });

    return () => {
      alive = false;
    };
    // dagVersion as a dep makes this re-run after every save, picking
    // up the new version row without manual refresh. dagId is the
    // primary trigger when the user navigates between DAGs.
  }, [dagId, dagVersion]);

  const handleRestore = async (versionId: string, versionNumber: number) => {
    if (!dagId) return;
    // Native confirm — matches the existing Clone button's no-modal UX.
    // Restore is more destructive than clone (it changes the live
    // shape), so we prompt explicitly. The "appends a new version"
    // explanation is in the prompt so the user knows it's reversible.
    const ok = window.confirm(
      `Restore v${versionNumber}? This will append a new version with that shape — older versions stay in the history and you can restore back at any time.`,
    );
    if (!ok) return;

    setRestoringId(versionId);
    try {
      const res = await fetch(
        `/api/playbooks/dag/${dagId}/versions/${versionId}/restore`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      if (!res.ok) {
        setError(`Restore failed (${res.status})`);
        return;
      }
      // Tell the parent so the editor re-hydrates from the new
      // current shape. The parent re-fetches GET /api/playbooks/dag/[id]
      // and the canvas re-renders with the restored nodes/edges.
      onRestored();
    } catch {
      setError("Network error during restore");
    } finally {
      setRestoringId(null);
    }
  };

  // First-run UX: hide the panel entirely until there's something to
  // show. A fresh "new" page gets no history sidebar; a saved DAG
  // with no versions yet (pre-Round-24 row) also stays hidden so
  // users don't see an empty placeholder.
  if (!dagId) return null;
  if (versions !== null && versions.length === 0 && !error) return null;

  return (
    <aside
      aria-label="Version history"
      className="w-[260px] shrink-0 self-start rounded-lg border border-white/10 bg-white/[0.02] p-3"
    >
      <header className="flex items-baseline justify-between border-b border-white/5 pb-2">
        <h2 className="text-xs uppercase tracking-wider text-neutral-500">
          Version history
        </h2>
        {versionCount > 0 && (
          <span className="text-[10px] font-mono text-neutral-600">
            {versionCount} {versionCount === 1 ? "save" : "saves"}
          </span>
        )}
      </header>

      {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}

      {versions === null ? (
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
        <ol className="mt-3 space-y-1 max-h-[480px] overflow-y-auto">
          {versions.map((v, idx) => {
            // The first row in the list is the newest = current. We
            // disable restore on it (restoring "current" is a no-op
            // that just appends an identical version, which is noise).
            const isCurrent = idx === 0;
            const isRestoring = restoringId === v.id;
            return (
              <li
                key={v.id}
                className={`rounded px-2 py-2 text-xs ${
                  isCurrent
                    ? "bg-emerald-500/10 ring-1 ring-emerald-500/30"
                    : "hover:bg-white/[0.03]"
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className={`font-mono font-medium ${
                      isCurrent ? "text-emerald-200" : "text-neutral-300"
                    }`}
                  >
                    v{v.version}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] uppercase tracking-wider text-emerald-400">
                      current
                    </span>
                  )}
                  {v.restoredFromVersion !== null && (
                    <span
                      className="text-[10px] text-neutral-500"
                      title={`Restored from v${v.restoredFromVersion}`}
                    >
                      ← v{v.restoredFromVersion}
                    </span>
                  )}
                  <span className="ml-auto text-[10px] font-mono text-neutral-600">
                    {relativeTime(v.createdAt)}
                  </span>
                </div>
                {v.note && (
                  <p
                    className={`mt-1 text-[11px] leading-snug truncate ${
                      isCurrent ? "text-emerald-100/80" : "text-neutral-400"
                    }`}
                    title={v.note}
                  >
                    {v.note}
                  </p>
                )}
                <div className="mt-1 flex items-baseline gap-2 text-[10px] font-mono text-neutral-600">
                  <span>
                    {v.nodeCount}n / {v.edgeCount}e
                  </span>
                  {!isCurrent && (
                    <button
                      onClick={() => handleRestore(v.id, v.version)}
                      disabled={isRestoring || restoringId !== null}
                      className="ml-auto rounded border border-white/10 bg-white/[0.02] px-1.5 py-0.5 text-[10px] text-neutral-400 hover:bg-white/[0.05] hover:text-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Restore this version (appends a new save)"
                    >
                      {isRestoring ? "Restoring…" : "Restore"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
}

/**
 * Compact relative time. Mirrors MyDagsPanel's helper — keeping them
 * separate avoids a shared-utility import dance for one tiny function.
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
