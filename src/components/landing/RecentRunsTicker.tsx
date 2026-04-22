"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * RecentRunsTicker — rolling landing-page proof line.
 *
 * Shows the most recent successful playbook completions from
 * /api/public/recent-runs. Rotates through up to 5 entries every 4s.
 * Hides completely when the endpoint returns no runs — the landing
 * page stays clean on a fresh deploy rather than showing fake activity.
 *
 * Design: a single 40-52px row below LiveProofStrip. Copper pulse dot
 * + monospace meta. Matches existing hero typography scale.
 */

interface TickerRun {
  playbookId: string;
  playbookName: string;
  stepCount: number;
  stepsSucceeded: number;
  stepsFailed: number;
  durationMs: number | null;
  completedAt: string;
}

const ROTATION_MS = 4000;

export function RecentRunsTicker() {
  const [runs, setRuns] = useState<TickerRun[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/public/recent-runs", { cache: "no-store" });
        if (!res.ok) return;
        const data: { runs: TickerRun[] } = await res.json();
        if (!cancelled) setRuns(data.runs ?? []);
      } catch {
        /* silent — hide the ticker on any error */
      }
    };

    void load();
    // Refresh the list every 60s so new runs surface. Edge cache means
    // this is a cheap call most of the time.
    const refresh = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(refresh);
    };
  }, []);

  // Rotate through the loaded runs.
  useEffect(() => {
    if (runs.length <= 1) return;
    const rotate = setInterval(() => {
      setIdx((i) => (i + 1) % runs.length);
    }, ROTATION_MS);
    return () => clearInterval(rotate);
  }, [runs.length]);

  // Integrity check: no runs, no ticker. No skeleton, no "recently ran"
  // placeholder copy. Empty feed = invisible component.
  if (runs.length === 0) return null;

  const current = runs[idx % runs.length];

  return (
    <div className="px-6 border-t border-white/[0.04] bg-[#030303]">
      <div className="max-w-6xl mx-auto py-3 flex items-center gap-3">
        <span className="relative inline-flex h-1.5 w-1.5 flex-shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        <span className="font-mono text-[10px] text-neutral-600 tracking-[0.18em] uppercase flex-shrink-0">
          Live
        </span>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${current.playbookId}-${current.completedAt}-${idx}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="font-mono text-[11px] text-neutral-400 tracking-tight truncate"
          >
            <span className="text-neutral-500">{formatAgo(current.completedAt)}</span>
            <span aria-hidden="true" className="text-neutral-700 mx-2">·</span>
            <span className="text-[#E8DDD0]">{current.playbookName}</span>
            <span aria-hidden="true" className="text-neutral-700 mx-2">·</span>
            <span className="text-neutral-500">
              {current.stepsSucceeded}/{current.stepCount} steps
              {current.durationMs != null && <> · {formatDuration(current.durationMs)}</>}
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function formatAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return "just now";
  const secondsAgo = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secondsAgo < 60) return "just now";
  const min = Math.floor(secondsAgo / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}
