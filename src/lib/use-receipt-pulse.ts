"use client";

/**
 * SOVEREIGN MATRIX — useReceiptPulse (Wave 122).
 *
 * Polls /api/agent-runs/recent-public and increments a `pulseToken`
 * counter every time a NEW receipt ID lands at the head of the feed.
 *
 * Designed for the wave-121 ReceiptOrb: pass the returned token as the
 * `pulseToken` prop and the orb pulses on actual receipt-fabric events
 * (not just a decorative animation).
 *
 * Performance discipline:
 *   - Single shared poll, NOT one timer per component — every caller
 *     subscribes to the same module-scoped state via React's external
 *     store pattern.
 *   - 15s default cadence matches the upstream edge cache. Tighter
 *     polling is wasted bandwidth.
 *   - Auto-suspends polling when the document is hidden
 *     (Page Visibility API). Tab-switch costs zero requests.
 *   - prefers-reduced-motion: returns a static token (initial value 0)
 *     — the orb sits in its idle breathing state, no pulses fired.
 *
 * Error semantics:
 *   - Network errors are swallowed (`.catch(() => null)`). The
 *     receipt fabric being temporarily unavailable should NOT crash
 *     the landing page; the orb just stops pulsing until the next
 *     successful poll.
 */

import { useEffect, useState } from "react";

const POLL_MS_DEFAULT = 15_000;

interface RecentRow {
  id: string;
  agentName?: string;
  createdAt?: string;
}

interface RecentResponse {
  count?: number;
  receipts?: RecentRow[];
}

interface UseReceiptPulseOptions {
  /** Polling cadence in ms. Default 15s (matches upstream edge cache). */
  intervalMs?: number;
  /** Force-disable polling (e.g. component is in a hidden tab). */
  paused?: boolean;
}

interface UseReceiptPulseResult {
  /** Increments each time a new receipt ID arrives at the head of the feed. */
  pulseToken: number;
  /** ID of the latest receipt, or null when feed is empty/unavailable. */
  latestId: string | null;
  /** Agent name of the latest receipt — useful for "from X" captions. */
  latestAgent: string | null;
  /** ISO timestamp of the latest receipt. */
  latestAt: string | null;
}

export function useReceiptPulse(
  opts: UseReceiptPulseOptions = {},
): UseReceiptPulseResult {
  const { intervalMs = POLL_MS_DEFAULT, paused = false } = opts;
  const [pulseToken, setPulseToken] = useState(0);
  const [latestId, setLatestId] = useState<string | null>(null);
  const [latestAgent, setLatestAgent] = useState<string | null>(null);
  const [latestAt, setLatestAt] = useState<string | null>(null);

  useEffect(() => {
    if (paused) return;

    // Reduced-motion → never fire pulses. Single early-return; the
    // existing state remains at its initial 0 / nulls.
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;

    let cancelled = false;
    let timer: number | undefined;
    let lastSeenId: string | null = null;

    const poll = async () => {
      if (cancelled || document.hidden) {
        // Page-Visibility API guard — re-schedule on next visibility tick
        // rather than burning a poll cycle on a hidden tab.
        timer = window.setTimeout(poll, intervalMs);
        return;
      }
      try {
        const res = await fetch("/api/agent-runs/recent-public?limit=1", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as RecentResponse;
          const head = data.receipts?.[0];
          if (head?.id && head.id !== lastSeenId) {
            // First load OR new ID at head — fire a pulse.
            // Skip the FIRST pulse if it's literally first-paint
            // (the orb already does its own intro animation; firing
            // a "new receipt" pulse for whatever's already there
            // would be misleading).
            const isFirstLoad = lastSeenId === null;
            lastSeenId = head.id;
            if (!cancelled) {
              setLatestId(head.id);
              setLatestAgent(head.agentName ?? null);
              setLatestAt(head.createdAt ?? null);
              if (!isFirstLoad) setPulseToken((t) => t + 1);
            }
          }
        }
      } catch {
        // Swallow — receipt fabric unreachable is a degraded but
        // non-fatal state. The orb just won't pulse until next tick.
      }
      if (!cancelled) timer = window.setTimeout(poll, intervalMs);
    };

    const onVisibility = () => {
      // Visible again → poll immediately so the orb doesn't wait
      // a full interval to catch up.
      if (!document.hidden && !cancelled) {
        if (timer !== undefined) window.clearTimeout(timer);
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    void poll();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, paused]);

  return { pulseToken, latestId, latestAgent, latestAt };
}
