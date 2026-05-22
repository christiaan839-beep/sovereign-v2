"use client";

/**
 * SOVEREIGN MATRIX — useReceiptPulse (Wave 122 → Wave 124 split).
 *
 * Thin React hook over the React-free singleton in `pulse-store.ts`.
 * Every consumer subscribes to the SAME store; the first subscriber
 * starts polling, the last unsubscriber stops it.
 *
 * The store does all the work:
 *   - 15s poll cadence (matches upstream edge cache)
 *   - Page Visibility API auto-suspend on hidden tabs
 *   - prefers-reduced-motion guard (never starts polling)
 *   - first-load deduplication so the orb doesn't fake a "new!"
 *     pulse for whatever was already at head when the user arrived
 *
 * If you need to test the polling/store logic, import from
 * `pulse-store` directly — it has a __test_only__ surface for that.
 */

import { useSyncExternalStore } from "react";
import {
  subscribePulse,
  getPulseSnapshot,
  getServerPulseSnapshot,
  setPulseInterval,
  type PulseSnapshot,
} from "@/lib/pulse-store";

interface UseReceiptPulseOptions {
  /** Polling cadence in ms. Only honored when there are NO subscribers yet. */
  intervalMs?: number;
  /** Force-disable for THIS subscriber (does not stop the singleton poll). */
  paused?: boolean;
}

const EMPTY: PulseSnapshot = {
  pulseToken: 0,
  latestId: null,
  latestAgent: null,
  latestAt: null,
};

const noopSubscribe = (_cb: () => void) => () => {};

export function useReceiptPulse(
  opts: UseReceiptPulseOptions = {},
): PulseSnapshot {
  const { intervalMs, paused = false } = opts;

  if (intervalMs !== undefined) {
    // Honored only when refCount === 0 — the store enforces this.
    setPulseInterval(intervalMs);
  }

  const current = useSyncExternalStore(
    paused ? noopSubscribe : subscribePulse,
    getPulseSnapshot,
    getServerPulseSnapshot,
  );
  return paused ? EMPTY : current;
}
