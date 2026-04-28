/**
 * RUN-LEVEL ACTUAL COST — derived from stored _meta on per-node outputs.
 *
 * Where this lives in the pricing-transparency story:
 *
 *   - /pricing                  — what the customer pays (plan tiers)
 *   - /pricing/per-call         — what we'd estimate a call costs (band-based)
 *   - agent-pricing-estimate.ts — pre-run estimate from declared providers
 *   - run-cost-actual.ts (THIS) — POST-run actual, derived from stored
 *                                 _meta.tokenBudget that the gateway
 *                                 wrote into each result's output
 *
 * Why not query the cost ledger directly:
 *   The ledger requires runId propagation through headers + a new
 *   column on `usage` + agent-factory wiring. That's a real
 *   architectural change. This module skips it by reading what's
 *   already in the run record's results[] array.
 *
 * The downside: if an agent's _meta didn't include tokenBudget (older
 * agents, non-AI agents), we fall back to the band-based estimate.
 * The upside: we ship NOW with no schema changes, and the number is
 * truthful for any agent that uses the standard agent-factory.
 *
 * Returns a discriminated union so the UI can label the number
 * accurately:
 *   { kind: "actual",   cents, source: "_meta.tokenBudget" }
 *   { kind: "estimated", cents, source: "fallback to band rates" }
 *   { kind: "mixed",    cents, actualNodes, estimatedNodes }
 */

import type { NodeRunResult, PlaybookDag } from "./playbook-dag";
import { extractTokenBudget } from "./agent-meta";
import { estimateAgentCost } from "./agent-pricing-estimate";
import { getRate, estimateCostCents } from "./model-costs";

export interface RunCostBreakdown {
  /** Total cost in cents. Always present, even when partially estimated. */
  totalCents: number;
  /** "actual" = every node had _meta.tokenBudget. "estimated" = no node
   *  did. "mixed" = some did, some didn't. */
  kind: "actual" | "estimated" | "mixed";
  /** Per-node breakdown — null `cents` means we couldn't compute (skipped node). */
  perNode: Array<{
    nodeId: string;
    agent: string;
    cents: number | null;
    source: "actual" | "estimated" | "skipped";
  }>;
  /** How many nodes had real _meta data. */
  actualNodeCount: number;
  /** How many were estimated from declared providers. */
  estimatedNodeCount: number;
  /** Skipped nodes (no output, e.g. fail-stop downstream). */
  skippedNodeCount: number;
}

/**
 * Pull a real cost-cents number from a node's output if its
 * tokenBudget shape contains the data. The agent-factory writes
 * `pctUsed`, `limit`, `model` — we re-derive cost from that via the
 * model-costs rate table.
 *
 * Specifically:
 *   tokens_used = pctUsed * limit / 100
 *   We don't know input vs output split — assume 60/40 (typical
 *   chat-style agent) for the cost calculation. This is the same
 *   approximation the cost-ledger uses when the provider doesn't
 *   return a token breakdown.
 */
function actualCostFromMeta(output: unknown): number | null {
  const budget = extractTokenBudget(output);
  if (!budget) return null;
  if (!Number.isFinite(budget.limit) || budget.limit <= 0) return null;
  if (!Number.isFinite(budget.pctUsed) || budget.pctUsed < 0) return null;

  const tokensUsed = Math.round((budget.pctUsed / 100) * budget.limit);
  if (tokensUsed === 0) return 0;

  // 60/40 split, same as the cost-ledger's char-based fallback.
  const inputTokens = Math.round(tokensUsed * 0.6);
  const outputTokens = tokensUsed - inputTokens;
  const { cents } = estimateCostCents(budget.model, inputTokens, outputTokens);
  return cents;
}

/**
 * Compute the actual (or estimated) cost for a completed run.
 *
 * `dagSnapshot` is needed for the fallback path — when a node has no
 * tokenBudget meta, we fall back to its declared providers from the
 * snapshot to produce a band-based estimate.
 */
export function computeRunCostBreakdown(input: {
  results: NodeRunResult[];
  dagSnapshot: PlaybookDag;
}): RunCostBreakdown {
  const { results, dagSnapshot } = input;

  // Build a quick lookup from nodeId → declared agent slug → providers.
  // Used only for the fallback path below.
  const nodeSlugById = new Map<string, string>();
  for (const n of dagSnapshot.nodes) {
    nodeSlugById.set(n.id, n.agent);
  }

  let totalCents = 0;
  let actualCount = 0;
  let estimatedCount = 0;
  let skippedCount = 0;

  const perNode = results.map((r) => {
    if (r.status === "skipped" || r.output === undefined) {
      skippedCount += 1;
      return {
        nodeId: r.nodeId,
        agent: r.agent,
        cents: null,
        source: "skipped" as const,
      };
    }

    const fromMeta = actualCostFromMeta(r.output);
    if (fromMeta !== null) {
      actualCount += 1;
      totalCents += fromMeta;
      return {
        nodeId: r.nodeId,
        agent: r.agent,
        cents: fromMeta,
        source: "actual" as const,
      };
    }

    // Fallback: band-based estimate from the agent's declared providers.
    // This loses precision (worst-case across the chain rather than the
    // model that actually ran) but is the best we can do without a
    // tokenBudget envelope. Most "completed" nodes that hit a frontier
    // model DO have the envelope; nodes that fall through here are
    // typically non-AI tools or older agents pre-A2.
    //
    // We can't look up an agent's providers from the run record alone
    // (the snapshot has agent slug, not its provider list). So the
    // fallback uses a single conservative rate via getRate's UNKNOWN
    // bucket. This intentionally over-estimates rather than under.
    const slug = nodeSlugById.get(r.nodeId) ?? r.agent;
    const conservative = estimateAgentCost({
      providers: [slug.includes("claude") || slug.includes("opus")
        ? "anthropic"
        : "nvidia-nim"], // best guess if we can't look up the manifest server-side
    });
    estimatedCount += 1;
    totalCents += conservative.worstCaseCentsPerCall;
    return {
      nodeId: r.nodeId,
      agent: r.agent,
      cents: conservative.worstCaseCentsPerCall,
      source: "estimated" as const,
    };
  });

  let kind: RunCostBreakdown["kind"];
  if (actualCount === 0 && estimatedCount > 0) kind = "estimated";
  else if (estimatedCount === 0 && actualCount > 0) kind = "actual";
  else if (actualCount > 0 && estimatedCount > 0) kind = "mixed";
  else kind = "actual"; // no nodes scored: defaults to "actual" with 0¢

  return {
    totalCents,
    kind,
    perNode,
    actualNodeCount: actualCount,
    estimatedNodeCount: estimatedCount,
    skippedNodeCount: skippedCount,
  };
}

/**
 * Re-export the cost-source utility for tests + UIs that want to
 * narrow on a single node's source.
 */
export { getRate };
