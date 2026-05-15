"use client";

/**
 * LiveActivityTicker — fixed bottom-right "X verifications in 60s"
 * widget.
 *
 * Polls /api/agent-runs/recent-public every 15s and counts the
 * receipts created in the last 60 seconds. Bumps a count when new
 * ones arrive. Like Vercel's deploy counter or Stripe's "X businesses
 * just started selling" — proof the platform is alive, not a museum.
 *
 * Visual:
 *   - Fixed bottom-right, 12px from edges
 *   - Cyan accent (audit/infra surface per the dual-accent rule)
 *   - Soft pulse on the indicator dot
 *   - Compact: about 200px wide × 36px tall — doesn't crowd content
 *   - Dismissible (× button) — closed state persists in
 *     sessionStorage so it doesn't pop back on every nav
 *   - Hidden on /dashboard/* (too aggressive on an authenticated
 *     surface) and on /r/[id] (the receipt page has its own live
 *     verify state)
 *
 * SSR-safe: mount + first fetch happen in useEffect, server renders
 * nothing. No CLS — the widget is fixed-position out of the document
 * flow.
 *
 * Graceful degradation: any fetch error or zero-count state hides
 * the widget entirely (no zero-or-error noise on screen).
 */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, X } from "lucide-react";

const POLL_INTERVAL_MS = 15_000;
const SIXTY_SECONDS_MS = 60_000;
const DISMISS_KEY = "sovereign_ticker_dismissed";

interface FeedResponse {
  receipts?: Array<{ id: string; createdAt: string }>;
}

export function LiveActivityTicker() {
  const pathname = usePathname();
  const [count, setCount] = useState<number | null>(null);
  // Lazy initializer reads sessionStorage at first render on the
  // client; SSR-safe via the typeof-window guard. Avoids the React
  // Compiler ESLint warning about setState-in-effect.
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  });
  // `hydrated` flips false → true once on mount via a single setState
  // call — the standard SSR hydration pattern. The set-state-in-effect
  // rule's general warning doesn't apply here because there's no
  // cascade; this is a one-shot.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot SSR hydration flag, no cascade
    setHydrated(true);
  }, []);

  // Poll the public feed. Count receipts whose createdAt is within
  // the last 60 seconds. The endpoint is edge-cached for 15s — same
  // cadence as our polling, so this is friendly to Neon.
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch("/api/agent-runs/recent-public?limit=50", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as FeedResponse;
        if (cancelled) return;
        const now = Date.now();
        const within = (json.receipts ?? []).filter((r) => {
          const t = Date.parse(r.createdAt);
          return Number.isFinite(t) && now - t < SIXTY_SECONDS_MS;
        }).length;
        setCount(within);
      } catch {
        if (cancelled) return;
        // Treat error as "hide the widget" — same as zero. The
        // landing page should never display a broken ticker.
        setCount(null);
      }
    }
    tick();
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Hide on authenticated dashboard + receipt-detail surfaces. The
  // ticker is for marketing surfaces.
  if (
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/r/") ||
    pathname === "/signup" ||
    pathname === "/login"
  ) {
    return null;
  }

  if (!hydrated || dismissed || count === null || count === 0) {
    return null;
  }

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-3 right-3 z-40 hidden sm:block"
        role="status"
        aria-live="polite"
        aria-label={`${count} agent receipts signed in the last 60 seconds`}
      >
        <div className="flex items-center gap-2 rounded-full border border-cyan-500/30 bg-[#030303]/85 px-3 py-1.5 backdrop-blur-xl shadow-[0_8px_24px_-12px_rgba(0,183,255,0.35)]">
          <span className="relative inline-flex h-1.5 w-1.5" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-70 animate-ping motion-reduce:animate-none" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
          </span>
          <Link
            href="/explorer"
            className="font-mono text-[11px] uppercase tracking-wider text-cyan-200 transition hover:text-cyan-100"
          >
            <span className="font-semibold tabular-nums text-cyan-100">
              {count}
            </span>{" "}
            verified · last 60s
          </Link>
          <button
            onClick={dismiss}
            aria-label="Dismiss live activity widget"
            className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full text-neutral-500 transition hover:bg-white/[0.06] hover:text-cyan-200"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Keep the Activity icon importable so future enhancements (e.g.,
// a sparkline mode) can swap it in. Suppresses unused-import lint.
void Activity;
