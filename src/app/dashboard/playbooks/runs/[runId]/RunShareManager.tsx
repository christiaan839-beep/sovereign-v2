"use client";

/**
 * <RunShareManager> — owner-facing share management on the run-detail page.
 *
 * Three behaviours:
 *   1. Create a fresh share (optional label, optional TTL up to 90d)
 *   2. List existing shares with copy-link + revoke + last-accessed
 *   3. Revoke an existing share
 *
 * Lives inside the server-rendered detail page as a client island.
 * Network calls are scoped to /api/playbooks/dag/runs/[runId]/share.
 */

import { useCallback, useEffect, useState } from "react";

interface ShareRow {
  id: string;
  label: string | null;
  expiresAt: string;
  revokedAt: string | null;
  lastAccessedAt: string | null;
  accessCount: number;
  createdAt: string;
  active: boolean;
  shareUrl: string | null;
}

interface RunShareManagerProps {
  runId: string;
}

export function RunShareManager({ runId }: RunShareManagerProps) {
  const [shares, setShares] = useState<ShareRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [ttlDays, setTtlDays] = useState(7);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/playbooks/dag/runs/${runId}/share`);
      if (!res.ok) {
        setError(res.status === 404 ? "Run not found" : "Could not load shares");
        setShares([]);
        return;
      }
      const body = (await res.json()) as { shares: ShareRow[] };
      setShares(body.shares);
      setError(null);
    } catch {
      setError("Network error");
      setShares([]);
    }
  }, [runId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setCreating(true);
      try {
        const res = await fetch(`/api/playbooks/dag/runs/${runId}/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim() || undefined,
            ttlDays,
          }),
        });
        if (!res.ok) {
          setError(
            res.status === 503
              ? "Share service is temporarily unavailable; please retry"
              : "Could not create share",
          );
          return;
        }
        setLabel("");
        setShowCreateForm(false);
        await refresh();
      } catch {
        setError("Network error");
      } finally {
        setCreating(false);
      }
    },
    [runId, label, ttlDays, refresh],
  );

  const handleRevoke = useCallback(
    async (shareId: string) => {
      if (!confirm("Revoke this share link? The URL will stop working immediately.")) {
        return;
      }
      try {
        await fetch(
          `/api/playbooks/dag/runs/${runId}/share/${shareId}`,
          { method: "DELETE" },
        );
        await refresh();
      } catch {
        setError("Could not revoke");
      }
    },
    [runId, refresh],
  );

  const handleCopy = useCallback(async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API not available — fall back silently
    }
  }, []);

  const activeShares = shares?.filter((s) => s.active) ?? [];
  const inactiveShares = shares?.filter((s) => !s.active) ?? [];

  return (
    <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.02] p-5">
      <header className="flex items-baseline justify-between border-b border-white/5 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-neutral-200">
            Share with auditors / lawyers / teammates
          </h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Public, read-only links with expiry. Revocable any time.
          </p>
        </div>
        {!showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-emerald-400"
          >
            + New share link
          </button>
        )}
      </header>

      {error && <p className="mt-3 text-xs text-rose-400">{error}</p>}

      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="mt-4 rounded border border-white/5 bg-white/[0.02] p-3 space-y-3"
        >
          <div className="grid grid-cols-3 gap-3">
            <label className="col-span-2 block">
              <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">
                Label (optional)
              </span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder='e.g. "Lawyer review", "Q3 audit"'
                className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-neutral-200 outline-none focus:border-emerald-500/50 placeholder:text-neutral-600"
                maxLength={120}
              />
            </label>
            <label className="block">
              <span className="block text-[10px] text-neutral-500 uppercase tracking-wider mb-1">
                Expires in
              </span>
              <select
                value={ttlDays}
                onChange={(e) => setTtlDays(Number(e.target.value))}
                className="w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-neutral-200 outline-none focus:border-emerald-500/50"
              >
                <option value={1}>1 day</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
              </select>
            </label>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={creating}
              className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-emerald-400 disabled:opacity-40"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setLabel("");
              }}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {shares === null ? (
        <p className="mt-4 text-xs text-neutral-500">Loading shares…</p>
      ) : shares.length === 0 && !showCreateForm ? (
        <p className="mt-4 text-xs text-neutral-500">
          No shares created yet for this run.
        </p>
      ) : (
        <>
          {activeShares.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">
                Active ({activeShares.length})
              </div>
              <ul className="space-y-2">
                {activeShares.map((s) => (
                  <li
                    key={s.id}
                    className="rounded border border-white/5 bg-white/[0.02] p-3"
                  >
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xs font-medium text-neutral-200">
                        {s.label || "Untitled share"}
                      </span>
                      <span className="text-[10px] text-neutral-500">
                        expires {new Date(s.expiresAt).toLocaleDateString()}
                      </span>
                      {s.accessCount > 0 ? (
                        <span className="text-[10px] text-emerald-400">
                          · {s.accessCount} view{s.accessCount === 1 ? "" : "s"}
                          {s.lastAccessedAt &&
                            ` · last ${formatRelative(s.lastAccessedAt)}`}
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-600">
                          · not yet accessed
                        </span>
                      )}
                      <button
                        onClick={() => handleRevoke(s.id)}
                        className="ml-auto text-[11px] text-rose-400 hover:text-rose-300"
                        title="Revoke share — link stops working immediately"
                      >
                        Revoke
                      </button>
                    </div>
                    {s.shareUrl && (
                      <div className="mt-2 flex items-center gap-2">
                        <code className="flex-1 truncate rounded bg-black/40 px-2 py-1 text-[11px] text-neutral-300">
                          {s.shareUrl}
                        </code>
                        <button
                          onClick={() => handleCopy(s.id, s.shareUrl!)}
                          className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-[11px] text-neutral-300 hover:bg-white/10"
                        >
                          {copiedId === s.id ? "✓ Copied" : "Copy"}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {inactiveShares.length > 0 && (
            <div className="mt-4">
              <details>
                <summary className="text-[10px] uppercase tracking-wider text-neutral-600 hover:text-neutral-400 cursor-pointer">
                  Revoked / expired ({inactiveShares.length})
                </summary>
                <ul className="mt-2 space-y-1">
                  {inactiveShares.map((s) => (
                    <li
                      key={s.id}
                      className="text-[11px] text-neutral-600 px-2 py-1"
                    >
                      <span>{s.label || "Untitled"}</span>
                      <span className="ml-2">
                        ·{" "}
                        {s.revokedAt
                          ? `revoked ${formatRelative(s.revokedAt)}`
                          : `expired ${formatRelative(s.expiresAt)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const diff = Date.now() - t;
  if (diff < 0) return "soon";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "moments ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
