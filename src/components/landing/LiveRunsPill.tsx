"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * LIVE RUNS PILL — hero "N playbooks running right now."
 *
 * Studying: vercel.com shows live deployment counts, stripe.com
 * shows payments-per-second. The move is NOT the number; it's the
 * subtle update — the number ticking up without animation tells
 * the visitor "this is alive."
 *
 * Design notes:
 *   - Fades in after hero (1.2s delay) so hero text lands first
 *   - Polls every 30s (matches the endpoint edge cache)
 *   - Pulse dot uses emerald (success/alive semantic)
 *   - When running=0, gracefully shows totalToday instead (zero
 *     state is never "dead")
 *   - Mobile: renders inline below CTA, not floating
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

  // Choose the live message based on state.
  // Prefer "N running" when we have active runs; fall back to
  // today's total when the queue is idle.
  const message =
    running > 0
      ? `${formatNumber(running)} playbook${running === 1 ? "" : "s"} running right now`
      : totalToday > 0
      ? `${formatNumber(totalToday)} playbook${totalToday === 1 ? "" : "s"} ran today`
      : `Platform ready · first run in 3 minutes`;

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
