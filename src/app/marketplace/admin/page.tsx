"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, AlertTriangle } from "lucide-react";

/**
 * /marketplace/admin — Admin approval queue (Cook 70).
 *
 * Lists every listing in submitted/approved/rejected state and lets
 * an admin transition them through the Cook 62 state machine.
 *
 * Server-side guard is in /api/marketplace/listings/[slug] PATCH;
 * this UI surfaces a 404 to non-admins via the API response.
 */

type Status =
  | "draft"
  | "submitted"
  | "approved"
  | "published"
  | "rejected"
  | "unpublished";

interface Listing {
  id: string;
  slug: string;
  displayName: string;
  description: string;
  pricePerRunCents: number;
  status: Status;
  safetyLayers: string[];
  developerId: string;
}

const NEXT_ACTIONS: Record<Status, Status[]> = {
  draft: ["submitted"],
  submitted: ["approved", "rejected"],
  approved: ["published", "rejected"],
  published: ["unpublished"],
  rejected: ["draft"],
  unpublished: ["published", "draft"],
};

export default function MarketplaceAdminPage() {
  const [items, setItems] = useState<Listing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function reload() {
    try {
      const res = await fetch("/api/marketplace/listings", {
        cache: "no-store",
      });
      if (!res.ok) {
        setError(`HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as { items: Listing[] };
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function transition(id: string, target: Status) {
    setPending(id);
    try {
      const res = await fetch(`/api/marketplace/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      await reload();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 text-xs text-neutral-400 hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Marketplace
          </Link>
          <span className="inline-flex items-center gap-2 text-xs text-neutral-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Admin
          </span>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-16">
        <p className="text-[10px] uppercase tracking-[0.4em] text-emerald-400 mb-4">
          Approval Queue
        </p>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mb-8">
          Review submitted agents.
        </h1>

        {error && (
          <div className="mb-6 flex items-center gap-2 text-xs text-rose-300 p-3 rounded-xl border border-rose-500/40 bg-rose-500/10">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        {items.length === 0 ? (
          <p className="text-xs text-neutral-500">No listings yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((l) => (
              <div
                key={l.id}
                className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      {l.displayName}{" "}
                      <span className="text-neutral-500 font-mono text-xs">
                        /{l.slug}
                      </span>
                    </h2>
                    <p className="text-[11px] text-neutral-500">
                      developer:{" "}
                      <code className="text-neutral-400">{l.developerId}</code>
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-neutral-300">
                    {l.status}
                  </span>
                </div>
                {l.description && (
                  <p className="text-xs text-neutral-400 mb-3">
                    {l.description}
                  </p>
                )}
                <p className="text-[11px] text-neutral-500 mb-3">
                  Price: ${(l.pricePerRunCents / 100).toFixed(2)} · Safety:{" "}
                  {l.safetyLayers.join(", ")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {NEXT_ACTIONS[l.status].map((target) => (
                    <button
                      key={target}
                      onClick={() => transition(l.id, target)}
                      disabled={pending === l.id}
                      className="text-[11px] px-3 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-neutral-300 hover:bg-white/[0.08] hover:text-white disabled:opacity-40 transition-colors"
                    >
                      → {target}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
