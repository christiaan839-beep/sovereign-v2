/**
 * SOVEREIGN MATRIX — Confidence-weighted ensembling (Cook 98).
 *
 * When N agents disagree, weight their votes by historical accuracy
 * rather than equal vote. Beats unanimous-but-wrong + dilutes
 * confident outliers. Composes with Cook 32 confidence gates and
 * Cook 33 super-agent.
 *
 * Pure math — caller supplies historical accuracy scores. Production
 * reads them from the `agentPerformance` table.
 */

// ── Public types ──────────────────────────────────────────────────────────

export interface AgentVote<T = string> {
  agentSlug: string;
  /** The agent's choice. */
  choice: T;
  /** Agent's self-reported confidence in [0,1]. */
  confidence: number;
  /** Optional explanation — embedded in receipt, not used for voting. */
  rationale?: string;
}

export interface AgentAccuracy {
  agentSlug: string;
  /** Historical accuracy on this task class in [0,1]. */
  accuracy: number;
  /** Number of historical samples — used to dampen low-sample agents. */
  sampleCount: number;
}

export interface EnsembleOutcome<T = string> {
  /** Winning choice. */
  choice: T;
  /** Final weight on the winning choice (0..1, normalized over all choices). */
  margin: number;
  /** Per-choice weight breakdown for the receipt. */
  breakdown: Array<{ choice: T; weight: number; votes: number }>;
  /** True iff the second-place choice is within 0.1 of the winner. */
  contested: boolean;
}

const MIN_SAMPLES = 5;
const DAMPENING_FLOOR = 0.6; // low-sample agents get at most this much accuracy weight

/**
 * Combine agent votes with their historical accuracy. Returns the
 * winning choice + a receipt-friendly breakdown.
 *
 * Weight per vote = confidence × dampened(accuracy).
 *
 * Low-sample agents get their accuracy capped at DAMPENING_FLOOR so
 * a new agent that happens to be right once doesn't dominate a
 * battle-tested one.
 */
export function ensemble<T extends string | number>(
  votes: AgentVote<T>[],
  accuracies: AgentAccuracy[],
): EnsembleOutcome<T> {
  if (votes.length === 0) {
    throw new Error("ensemble: at least one vote required");
  }
  const accMap = new Map(accuracies.map((a) => [a.agentSlug, a]));
  const choiceWeight = new Map<T, number>();
  const choiceVotes = new Map<T, number>();

  for (const vote of votes) {
    const acc = accMap.get(vote.agentSlug);
    const rawAccuracy = acc?.accuracy ?? 0.5; // unknown → coin flip
    const samples = acc?.sampleCount ?? 0;
    const dampened =
      samples < MIN_SAMPLES
        ? Math.min(rawAccuracy, DAMPENING_FLOOR)
        : rawAccuracy;
    const w = clamp(vote.confidence) * clamp(dampened);
    choiceWeight.set(vote.choice, (choiceWeight.get(vote.choice) ?? 0) + w);
    choiceVotes.set(vote.choice, (choiceVotes.get(vote.choice) ?? 0) + 1);
  }

  const total = [...choiceWeight.values()].reduce((s, w) => s + w, 0);
  const breakdown = [...choiceWeight.entries()]
    .map(([choice, weight]) => ({
      choice,
      weight: total === 0 ? 0 : weight / total,
      votes: choiceVotes.get(choice) ?? 0,
    }))
    .sort((a, b) => b.weight - a.weight);

  const top = breakdown[0];
  const runnerUp = breakdown[1];
  const contested = !!runnerUp && top.weight - runnerUp.weight < 0.1;

  return {
    choice: top.choice,
    margin: top.weight,
    breakdown,
    contested,
  };
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
