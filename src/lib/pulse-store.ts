/**
 * SOVEREIGN MATRIX — Pulse Store (Wave 124).
 *
 * Pure, React-free, module-scoped store for receipt-fabric pulses.
 * Implements the subscribe / getSnapshot / setSnapshot pattern that
 * React's `useSyncExternalStore` expects, but with zero React surface
 * so the store is testable as a pure module.
 *
 * The React hook lives in `use-receipt-pulse.ts` and is a thin
 * `useSyncExternalStore` wrapper over the exports below.
 *
 * Lifecycle (refcount-managed):
 *   subscribe() → +1 → if first, startPolling()
 *   unsubscribe() → -1 → if last, stopPolling()
 *
 * Failure-mode discipline:
 *   - fetch error → swallowed; subscribers see no change
 *   - SSR → polling never starts (window/document undefined)
 *   - prefers-reduced-motion → polling never starts even on client
 *   - document.hidden → poll re-schedules without making a request
 *
 * Test surface:
 *   The store exports `__test_only__` for direct manipulation in unit
 *   tests (set snapshot, run poll once, etc). The hook layer never
 *   touches these — they're prefixed to make grep-misuse obvious.
 */

export interface PulseSnapshot {
  /** Increments each time a new receipt ID arrives at the head of the feed. */
  pulseToken: number;
  /** ID of the latest receipt, or null when feed is empty/unavailable. */
  latestId: string | null;
  /** Agent name of the latest receipt — useful for "from X" captions. */
  latestAgent: string | null;
  /** ISO timestamp of the latest receipt. */
  latestAt: string | null;
}

interface RecentRow {
  id: string;
  agentName?: string;
  createdAt?: string;
}

interface RecentResponse {
  count?: number;
  receipts?: RecentRow[];
}

const POLL_MS_DEFAULT = 15_000;

const EMPTY: PulseSnapshot = Object.freeze({
  pulseToken: 0,
  latestId: null,
  latestAgent: null,
  latestAt: null,
});

let snapshot: PulseSnapshot = EMPTY;
const listeners = new Set<() => void>();
let refCount = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let lastSeenId: string | null = null;
let visibilityListenerAttached = false;
let activeIntervalMs = POLL_MS_DEFAULT;

function emit() {
  for (const cb of listeners) cb();
}

function reduceMotionEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

async function poll(): Promise<void> {
  // Page-Visibility API guard — re-schedule on next visibility tick
  // rather than burning a poll cycle on a hidden tab.
  if (typeof document !== "undefined" && document.hidden) {
    timer = setTimeout(poll, activeIntervalMs);
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
        const isFirstLoad = lastSeenId === null;
        lastSeenId = head.id;
        snapshot = {
          latestId: head.id,
          latestAgent: head.agentName ?? null,
          latestAt: head.createdAt ?? null,
          // First-load skip: arrived AT the page → don't pretend the
          // ALREADY-AT-HEAD receipt is brand new.
          pulseToken: isFirstLoad
            ? snapshot.pulseToken
            : snapshot.pulseToken + 1,
        };
        emit();
      }
    }
  } catch {
    // Swallow — receipt fabric unreachable is a degraded but non-fatal
    // state. Subscribers see no change, polling continues next tick.
  }
  timer = setTimeout(poll, activeIntervalMs);
}

function onVisibility() {
  if (typeof document === "undefined") return;
  if (!document.hidden) {
    // Visible again → poll immediately so subscribers don't wait
    // a full interval to catch up.
    if (timer !== undefined) clearTimeout(timer);
    void poll();
  }
}

function startPolling(intervalMs: number) {
  if (timer !== undefined) return; // already running
  if (typeof window === "undefined") return; // SSR no-op
  if (reduceMotionEnabled()) return; // honor user motion preference
  activeIntervalMs = intervalMs;
  if (!visibilityListenerAttached) {
    document.addEventListener("visibilitychange", onVisibility);
    visibilityListenerAttached = true;
  }
  void poll();
}

function stopPolling() {
  if (timer !== undefined) {
    clearTimeout(timer);
    timer = undefined;
  }
  if (visibilityListenerAttached && typeof document !== "undefined") {
    document.removeEventListener("visibilitychange", onVisibility);
    visibilityListenerAttached = false;
  }
  // Wave 124 polish — do NOT reset lastSeenId here. Resetting would
  // make a return-to-page subscriber treat the existing head receipt
  // as "first load" and skip the pulse — which makes the orb silent
  // even though the receipt fabric IS active. Keep the cursor; the
  // next subscribe → poll → diff naturally fires only on receipts
  // that landed WHILE the user was away. Reset only via
  // __test_only__.reset (which clears module state for tests).
}

/**
 * Subscribe to snapshot changes. Returns an unsubscribe function.
 * The first subscriber starts the singleton poll; the last
 * unsubscriber stops it.
 */
export function subscribePulse(cb: () => void): () => void {
  listeners.add(cb);
  refCount++;
  if (refCount === 1) {
    startPolling(activeIntervalMs);
  }
  return () => {
    listeners.delete(cb);
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0) {
      stopPolling();
    }
  };
}

/** Reference-stable snapshot accessor — safe for useSyncExternalStore. */
export function getPulseSnapshot(): PulseSnapshot {
  return snapshot;
}

/** SSR snapshot — identical to client initial state so hydration matches. */
export function getServerPulseSnapshot(): PulseSnapshot {
  return EMPTY;
}

/**
 * Override the default polling cadence — only honored when refCount is
 * 0 (before the first subscribe). Subsequent subscribers with a
 * different intervalMs don't restart polling.
 */
export function setPulseInterval(intervalMs: number): void {
  if (refCount === 0) {
    activeIntervalMs = intervalMs;
  }
}

/**
 * Test-only direct-manipulation surface. NEVER call from production
 * code — the prefix is the convention enforcer.
 */
export const __test_only__ = {
  reset(): void {
    snapshot = EMPTY;
    listeners.clear();
    refCount = 0;
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    lastSeenId = null;
    visibilityListenerAttached = false;
    activeIntervalMs = POLL_MS_DEFAULT;
  },
  getRefCount(): number {
    return refCount;
  },
  getActiveIntervalMs(): number {
    return activeIntervalMs;
  },
  setSnapshot(s: PulseSnapshot): void {
    snapshot = s;
    emit();
  },
  /** Invoke the internal poll function once, as if a tick just fired. */
  async pollOnce(): Promise<void> {
    // Clear the auto-schedule so the test caller controls cadence
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    await poll();
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  },
};
