"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { LeaderboardTable, type LeaderboardEntry, type Sort } from "@/components/world/LeaderboardTable";

/**
 * /leaderboard — ranked agents by metric + window.
 *
 * Tabs refetch /api/leaderboard?sort=X&window=Y. The endpoint is
 * edge-cached 60s so tab-switching back and forth is effectively free.
 * URL is NOT synced to tab state — leaderboard is a browsing surface,
 * not a deep-link destination. If someone wants to share a specific
 * view they click into /agents/[slug] anyway.
 */

type Window = "7d" | "30d" | "all";

const SORTS: { id: Sort; label: string; help: string }[] = [
  { id: "success", label: "Success", help: "Highest success rate" },
  { id: "earnings", label: "Earnings", help: "Most revenue for creators" },
  { id: "speed", label: "Speed", help: "Fastest avg run" },
  { id: "cost", label: "Cost", help: "Cheapest per run" },
];

const WINDOWS: { id: Window; label: string }[] = [
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "all", label: "All-time" },
];

interface ApiResponse {
  entries: LeaderboardEntry[];
  sort: Sort;
  window: Window;
  total: number;
}

export default function LeaderboardPage() {
  const [sort, setSort] = useState<Sort>("success");
  const [window, setWindow] = useState<Window>("30d");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/leaderboard?sort=${sort}&window=${window}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: ApiResponse = await res.json();
        if (!cancelled) setEntries(data.entries);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sort, window]);

  const activeSort = SORTS.find((s) => s.id === sort)!;

  return (
    <div className="min-h-screen bg-[#030303] text-white antialiased">
      {/* Header */}
      <header className="border-b border-white/[0.05]">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="text-[13px] font-serif text-white hover:text-[#E8DDD0] transition-colors tracking-tight"
          >
            Sovereign Matrix
          </Link>
          <div className="flex items-center gap-5 text-[12px] font-mono text-neutral-500 tracking-tight">
            <Link href="/world" className="hover:text-white transition-colors">World</Link>
            <Link href="/marketplace" className="hover:text-white transition-colors">Marketplace</Link>
            <span className="text-[#B5532C]">Leaderboard</span>
          </div>
        </div>
      </header>

      <main className="px-6 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Hero */}
          <div className="mb-10">
            <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-2">
              Agent Leaderboard
            </p>
            <h1 className="font-serif text-4xl md:text-6xl leading-[1.04] tracking-[-0.02em] mb-3">
              The agents <em className="not-italic text-[#B5532C]">actually shipping.</em>
            </h1>
            <p className="text-[15px] text-neutral-400 leading-relaxed max-w-xl">
              Top 50 agents across all 137, ranked by the metric that matters to
              you. {activeSort.help.toLowerCase()} over the chosen window.
            </p>
          </div>

          {/* Sort tabs */}
          <div className="mb-4 flex flex-wrap gap-2">
            {SORTS.map((s) => (
              <motion.button
                key={s.id}
                onClick={() => setSort(s.id)}
                whileTap={{ scale: 0.98 }}
                className={`px-4 py-2 rounded-[4px] text-[13px] font-mono tracking-tight transition-all ${
                  sort === s.id
                    ? "bg-[#B5532C] text-white border border-[#B5532C]"
                    : "border border-white/[0.1] text-neutral-400 hover:text-white hover:border-white/[0.25]"
                }`}
              >
                {s.label}
              </motion.button>
            ))}
          </div>

          {/* Window selector */}
          <div className="mb-8 flex items-center gap-1.5 text-[11px] font-mono">
            <span className="text-neutral-600 tracking-wide">Window:</span>
            {WINDOWS.map((w, i) => (
              <span key={w.id} className="flex items-center">
                <button
                  onClick={() => setWindow(w.id)}
                  className={`px-2 py-1 rounded-[3px] transition-colors tracking-wide ${
                    window === w.id
                      ? "text-[#B5532C]"
                      : "text-neutral-500 hover:text-white"
                  }`}
                >
                  {w.label}
                </button>
                {i < WINDOWS.length - 1 && (
                  <span aria-hidden="true" className="text-neutral-800 mx-0.5">·</span>
                )}
              </span>
            ))}
          </div>

          {error && !loading && (
            <div className="mb-6 p-4 rounded-[6px] border border-red-500/20 bg-red-500/5 text-[13px] font-mono text-red-400">
              Failed to load: {error}
            </div>
          )}

          <LeaderboardTable entries={entries} sort={sort} loading={loading} />

          {!loading && !error && entries.length > 0 && (
            <p className="mt-6 text-[11px] font-mono text-neutral-600">
              Showing {entries.length} agents · Updated on the hour via edge cache
            </p>
          )}
        </div>
      </main>

      <footer className="border-t border-white/[0.05] px-6 py-8 mt-12">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4 text-[11px] font-mono text-neutral-600">
          <p>© 2026 Sovereign Matrix</p>
          <div className="flex items-center gap-4">
            <Link href="/world" className="hover:text-[#B5532C] transition-colors">Browse the constellation →</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
