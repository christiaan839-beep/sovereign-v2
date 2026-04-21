"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/**
 * /dashboard/admin/agents — submission moderation queue.
 *
 * Shows unlisted agents (pending review) with their creator info,
 * pricing, description, and buttons to Approve (→ public + verified)
 * or Reject (→ private). Optimistic UI: clicking removes the card
 * immediately; a failing fetch restores it.
 *
 * Admin-gated server-side; non-admins hit the 404 bounce from
 * /api/admin/agents/pending and see the "No queue" state.
 */

interface PendingAgent {
  slug: string;
  displayName: string;
  tagline: string | null;
  description: string | null;
  category: string;
  pricingCents: number;
  creatorUserId: string | null;
  creatorHandle: string | null;
  verified: boolean;
  createdAt: string;
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<PendingAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/agents/pending");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAgents(data.agents ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (slug: string, action: "approve" | "reject") => {
      setBusySlug(slug);
      const snapshot = agents;
      // Optimistic remove
      setAgents((a) => a.filter((x) => x.slug !== slug));
      try {
        const res = await fetch(`/api/admin/agents/${slug}/${action}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: action === "approve" ? JSON.stringify({ verified: true }) : "{}",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        // Rollback on failure
        setAgents(snapshot);
        setError(err instanceof Error ? err.message : `${action} failed`);
      } finally {
        setBusySlug(null);
      }
    },
    [agents],
  );

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#030303] text-white">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-2">
          Admin · Moderation
        </p>
        <h1 className="font-serif text-3xl md:text-4xl leading-tight tracking-[-0.02em] mb-3">
          Pending submissions
        </h1>
        <p className="text-[13px] text-neutral-400 leading-relaxed mb-8 max-w-xl">
          Approve promotes to <code className="text-neutral-300">visibility=public</code> and
          marks <code className="text-neutral-300">verified=true</code>. Reject sets
          <code className="text-neutral-300"> visibility=private</code> — the row is kept
          for audit, not deleted.
        </p>

        {error && (
          <div className="mb-6 p-3 rounded-[4px] border border-red-500/30 bg-red-500/10 text-[12px] font-mono text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-32 rounded-[6px] border border-white/[0.05] bg-white/[0.02] animate-pulse"
              />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-mono text-[13px] text-neutral-600">
              Queue is empty — no pending submissions.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((a) => (
              <article
                key={a.slug}
                className="p-5 rounded-[6px] border border-white/[0.08] bg-white/[0.02]"
              >
                <header className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-neutral-500 tracking-[0.15em] uppercase capitalize">
                        {a.category}
                      </span>
                      <span aria-hidden="true" className="text-neutral-700">·</span>
                      <span className="text-[10px] font-mono text-neutral-600">
                        {a.pricingCents === 0 ? "Free" : `$${(a.pricingCents / 100).toFixed(2)}/run`}
                      </span>
                    </div>
                    <h2 className="font-serif text-xl text-white tracking-tight mb-1">
                      <Link
                        href={`/agents/${a.slug}`}
                        className="hover:text-[#B5532C] transition-colors"
                        target="_blank"
                      >
                        {a.displayName} →
                      </Link>
                    </h2>
                    {a.tagline && (
                      <p className="text-[13px] text-neutral-400 leading-snug">{a.tagline}</p>
                    )}
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <p className="text-[10px] font-mono text-neutral-600">
                      by {a.creatorHandle ?? "—"}
                    </p>
                    <p className="text-[10px] font-mono text-neutral-700">
                      {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </header>

                {a.description && (
                  <p className="mb-4 text-[13px] text-neutral-300 leading-[1.65]">
                    {a.description}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void act(a.slug, "reject")}
                    disabled={busySlug === a.slug}
                    className="px-4 py-1.5 border border-white/[0.1] text-[12px] font-mono text-neutral-400 rounded-[3px] hover:border-red-500/40 hover:text-white disabled:opacity-50 transition-colors tracking-wide"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => void act(a.slug, "approve")}
                    disabled={busySlug === a.slug}
                    className="px-4 py-1.5 bg-[#B5532C] text-white text-[12px] font-medium rounded-[3px] hover:bg-[#C96234] disabled:opacity-60 transition-colors"
                  >
                    {busySlug === a.slug ? "…" : "Approve"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
