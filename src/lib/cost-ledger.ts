/**
 * cost-ledger — Per-request AI cost accounting.
 *
 * `nvidia.ts` (and any future provider gateway) calls `recordLedgerEntry`
 * after every chat completion to log token counts and char counts. The
 * usage table (`src/db/schema.ts:202`) tracks the same data; this module
 * is the in-process side-channel that bridges raw provider responses
 * to the eventual DB write.
 *
 * Design rules (mirror model-attribution.ts):
 *   - Never throws. The AI call must never fail because the ledger failed.
 *   - Lazy-imported by callers via `await import("@/lib/cost-ledger")`.
 *   - No DB writes here. Telemetry / billing pipelines drain the ring buffer
 *     out-of-band.
 *
 * The ring buffer keeps the last N entries in memory, which is sufficient
 * for diagnostics and unit tests. Production billing should subscribe to
 * `onLedgerEntry` (e.g. from analytics.ts) to forward entries to the DB.
 */
export interface LedgerEntry {
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
  inputChars?: number;
  outputChars?: number;
  /** Filled in by `recordLedgerEntry` if the caller omits it. */
  timestamp?: number;
}

const RING_BUFFER_SIZE = 256;
const ringBuffer: LedgerEntry[] = [];
const subscribers: Array<(entry: LedgerEntry) => void> = [];

/**
 * Record a ledger entry for the current request. Always succeeds — any
 * subscriber error is caught and swallowed so a misbehaving listener can't
 * take down the AI call path.
 */
export function recordLedgerEntry(entry: LedgerEntry): void {
  if (!entry || typeof entry.modelId !== "string" || !entry.modelId) return;
  const stamped: LedgerEntry = {
    ...entry,
    timestamp: entry.timestamp ?? Date.now(),
  };

  ringBuffer.push(stamped);
  if (ringBuffer.length > RING_BUFFER_SIZE) {
    ringBuffer.splice(0, ringBuffer.length - RING_BUFFER_SIZE);
  }

  for (const fn of subscribers) {
    try {
      fn(stamped);
    } catch {
      // Subscribers must never break the producer.
    }
  }
}

/** Snapshot of the last N entries. Returns a copy so callers can't mutate state. */
export function getRecentLedgerEntries(): LedgerEntry[] {
  return ringBuffer.slice();
}

/** Subscribe to new ledger entries (e.g. for live billing or telemetry). */
export function onLedgerEntry(fn: (entry: LedgerEntry) => void): () => void {
  subscribers.push(fn);
  return () => {
    const idx = subscribers.indexOf(fn);
    if (idx >= 0) subscribers.splice(idx, 1);
  };
}

/** Clear all ledger state — primarily for tests. */
export function resetCostLedger(): void {
  ringBuffer.length = 0;
  subscribers.length = 0;
}
