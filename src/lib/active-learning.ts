/**
 * SOVEREIGN MATRIX — Active-learning feedback loop (Cook 109).
 *
 * Every Cook 32 confidence-gate `escalate` decision becomes a
 * labeled training pair for the critic. Same for explicit human
 * overrides on Cook 98 ensembled outcomes. The store is a buffered
 * append-only log keyed by agent slug; production rotates it into
 * the existing tenantMemories table on a cron.
 *
 * Pure module — no I/O. Caller appends events; reader exports the
 * batch for offline training.
 */

// ── Public types ──────────────────────────────────────────────────────────

export type FeedbackKind =
  | "confidence-escalate" // model output flagged → human reviewed
  | "ensemble-override" // human overrode the ensembled vote
  | "user-flag" // user clicked "wrong"
  | "auto-pass"; // model output committed without human in the loop

export interface FeedbackEvent {
  id: string;
  agentSlug: string;
  tenantId: string;
  kind: FeedbackKind;
  /** Model output that was evaluated. */
  output: string;
  /** Human-corrected output when the human intervened; null on auto-pass. */
  correction?: string;
  /** Confidence score the agent self-reported. */
  agentConfidence: number;
  /** Human label: "correct" | "wrong" | "partial" | "unsure". */
  humanLabel?: "correct" | "wrong" | "partial" | "unsure";
  /** Free-form rationale a reviewer left for the agent owner. */
  rationale?: string;
  /** Unix ms. */
  occurredAt: number;
}

export interface FeedbackBatch {
  agentSlug: string;
  count: number;
  events: FeedbackEvent[];
  /** Convenience: per-kind counts so callers can spot drift. */
  byKind: Record<FeedbackKind, number>;
  /** Wrong / total when human label is present (-1 when none labelled). */
  errorRate: number;
}

// ── Store ─────────────────────────────────────────────────────────────────

const MAX_BUFFER_PER_AGENT = 5000;

const BY_AGENT = new Map<string, FeedbackEvent[]>();

export function _resetForTests(): void {
  BY_AGENT.clear();
}

// ── Public API ────────────────────────────────────────────────────────────

/** Append a feedback event. Drops the oldest if buffer is full. */
export function record(event: FeedbackEvent): void {
  if (!event.agentSlug) {
    throw new Error("record: agentSlug is required");
  }
  if (!event.id) {
    throw new Error("record: id is required");
  }
  const list = BY_AGENT.get(event.agentSlug) ?? [];
  // Dedupe by id (idempotent if caller retries).
  if (list.some((e) => e.id === event.id)) return;
  list.push(event);
  if (list.length > MAX_BUFFER_PER_AGENT) {
    list.shift();
  }
  BY_AGENT.set(event.agentSlug, list);
}

/** Get a single agent's feedback batch + aggregate metrics. */
export function batchFor(agentSlug: string): FeedbackBatch {
  const events = BY_AGENT.get(agentSlug) ?? [];
  const byKind: Record<FeedbackKind, number> = {
    "confidence-escalate": 0,
    "ensemble-override": 0,
    "user-flag": 0,
    "auto-pass": 0,
  };
  let labelled = 0;
  let wrong = 0;
  for (const e of events) {
    byKind[e.kind]++;
    if (e.humanLabel) {
      labelled++;
      if (e.humanLabel === "wrong") wrong++;
    }
  }
  return {
    agentSlug,
    count: events.length,
    events: [...events],
    byKind,
    errorRate: labelled === 0 ? -1 : wrong / labelled,
  };
}

/** Export every agent's recent feedback for offline training. */
export function exportAll(): FeedbackBatch[] {
  return [...BY_AGENT.keys()].map((slug) => batchFor(slug));
}

export const ACTIVE_LEARNING_CONSTANTS = {
  MAX_BUFFER_PER_AGENT,
};
