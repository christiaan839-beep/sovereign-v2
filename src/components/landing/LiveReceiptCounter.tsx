"use client";

/**
 * LiveReceiptCounter — landing-page proof-of-aliveness.
 *
 * Fetches /api/stats/public on mount + every 30s and renders the
 * lifetime + last-24h signed-receipt counts inline. The static
 * SCALE_METRICS grid sells the "what we have" (137 agents, 5 verifier
 * layers, etc.); this widget sells "and it's running right now."
 *
 * Why the dual existence — and why this matters for audit-grade
 * positioning: compliance buyers distrust marketing pages. A live
 * counter that ticks up between page refreshes is a small but real
 * proof signal. Same psychological lever as Vercel's "deployed in
 * 0.4s" timestamp on the homepage.
 *
 * Graceful states:
 *   - Pre-fetch: shows "—" so the layout doesn't jump
 *   - Fetch fails: hides the dynamic line entirely (no broken UI)
 *   - Zero values: shows "0 lifetime · 0 in 24h" with a neutral dot
 *     instead of cyan (signals "platform exists but no recent runs")
 */

import { useEffect, useState } from "react";

interface PublicStats {
  totals: {
    signedReceipts: number;
    publicReceipts: number;
    last24h: number;
  };
}

export function LiveReceiptCounter() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/stats/public", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as PublicStats;
        if (!cancelled) {
          setStats(data);
          setErrored(false);
        }
      } catch {
        if (!cancelled) setErrored(true);
      }
    }

    void load();
    const id = setInterval(() => void load(), 30_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (errored) return null;

  const lifetime = stats?.totals.signedReceipts ?? null;
  const last24h = stats?.totals.last24h ?? null;
  const isFresh = (last24h ?? 0) > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2.5 text-[11px] font-mono tracking-wide text-neutral-500"
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-1.5 w-1.5 ${
          isFresh ? "" : "opacity-40"
        }`}
      >
        <span
          className={`absolute inset-0 rounded-full ${
            isFresh
              ? "bg-cyan-400 animate-ping motion-reduce:animate-none"
              : "bg-neutral-600"
          }`}
        />
        <span
          className={`relative h-1.5 w-1.5 rounded-full ${
            isFresh ? "bg-cyan-400" : "bg-neutral-600"
          }`}
        />
      </span>
      <span className="text-neutral-400">
        {lifetime === null ? "—" : lifetime.toLocaleString()}
      </span>
      <span className="text-neutral-600">signed lifetime ·</span>
      <span className="text-neutral-400">
        {last24h === null ? "—" : last24h.toLocaleString()}
      </span>
      <span className="text-neutral-600">in 24h</span>
    </div>
  );
}
