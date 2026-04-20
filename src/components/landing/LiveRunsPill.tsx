"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * LIVE RUNS PILL — "N playbooks running right now" hero badge.
 *
 * Polls /api/_misc/live-count every 30s (matches the endpoint's
 * edge cache). Fades in 1.2s after hero so the headline lands
 * first. If both running and totalToday are zero the pill still
 * renders a "platform ready" message — the zero state must never
 * read as dead.
 */

interface LiveCount {
  running: number;
  totalToday: number;
  lastUpdated: string;
}

export function LiveRunsPill() {
  const [data, setData] = useState<LiveCount | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    async function fetchCount() {
      try {
        const res = await fetch("/api/_misc/live-count", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as LiveCount;
        if (!cancelled) setData(json);
      } catch {
        // Silent — never break the hero
      }
    }

    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Show something even on first paint — prevents CLS.
  // Real data overrides after ~200ms on fast networks.
  const running = data?.running ?? 0;
  const totalToday = data?.totalToday ?? 0;
  const message = buildMessage(running, totalToday);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 1.2, ease: "easeOut" }}
      className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.015] px-3 py-1.5"
      aria-label={`Live platform activity: ${message}`}
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70 animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>

      <AnimatePresence mode="wait">
        <motion.span
          key={message}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="font-mono text-[11px] tracking-tight text-neutral-400"
        >
          {message}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

/** Prefer live runs. Fall back to today's total. Never read as dead. */
function buildMessage(running: number, totalToday: number): string {
  if (running > 0) {
    return `${formatNumber(running)} playbook${running === 1 ? "" : "s"} running right now`;
  }
  if (totalToday > 0) {
    return `${formatNumber(totalToday)} playbook${totalToday === 1 ? "" : "s"} ran today`;
  }
  return "Platform ready · first run in 3 minutes";
}
