/**
 * AGENT META EXTRACTORS
 *
 * Every agent response from /api/agents/<slug> carries a `_meta`
 * envelope (agent-factory.ts builds it). This file is the single
 * place that knows how to extract specific fields from that envelope
 * defensively, so every UI surface (visual editor, chat, /agents/[slug])
 * can use a one-liner to render trust signals.
 *
 * The shape is duck-typed because the envelope evolves and we don't
 * want every consumer to break when we add a field. Each extractor
 * narrows from `unknown` → typed-or-undefined and never throws.
 *
 * Why a separate util instead of inlining: there are at least four
 * surfaces that need to render confidence + tokenBudget — visual
 * editor results, chat message metadata, /agents/[slug] sample run,
 * dashboard recent-runs feed. One extractor file means renaming a
 * field in the envelope is a one-place fix.
 */

import type { ConfidenceMeta } from "@/components/agent/ConfidenceBadge";
import type { TokenBudgetMeta } from "@/components/agent/TokenBudgetMeter";

/**
 * Pull `_meta.confidence` out of an agent response envelope. Returns
 * undefined when:
 *   - output isn't an object
 *   - output has no _meta
 *   - _meta has no confidence
 *   - confidence is structurally wrong (missing score / band / action)
 *
 * NEVER throws. Surfaces that show confidence-aware UI render nothing
 * when this returns undefined — they don't crash.
 */
export function extractConfidence(output: unknown): ConfidenceMeta | undefined {
  if (!output || typeof output !== "object") return undefined;
  const meta = (output as { _meta?: unknown })._meta;
  if (!meta || typeof meta !== "object") return undefined;
  const c = (meta as { confidence?: unknown }).confidence;
  if (!c || typeof c !== "object") return undefined;
  const obj = c as Partial<ConfidenceMeta>;
  if (
    typeof obj.score !== "number" ||
    typeof obj.band !== "string" ||
    typeof obj.recommendedAction !== "string"
  ) {
    return undefined;
  }
  // Validate the band is one of the known values — protects the UI
  // component from rendering an unknown style.
  if (!["high", "moderate", "review", "draft"].includes(obj.band)) {
    return undefined;
  }
  return {
    score: obj.score,
    band: obj.band as ConfidenceMeta["band"],
    recommendedAction: obj.recommendedAction,
  };
}

/**
 * Pull `_meta.tokenBudget` out of an agent response envelope. Same
 * defensive pattern as extractConfidence. Returns undefined when the
 * shape doesn't match.
 *
 * The runtime surfaces a `pctUsed` field as 0..100 (integer); we
 * normalize 0..1 inputs (in case some agent returns it as a fraction)
 * to the 0..100 contract the UI expects.
 */
export function extractTokenBudget(output: unknown): TokenBudgetMeta | undefined {
  if (!output || typeof output !== "object") return undefined;
  const meta = (output as { _meta?: unknown })._meta;
  if (!meta || typeof meta !== "object") return undefined;
  const tb = (meta as { tokenBudget?: unknown }).tokenBudget;
  if (!tb || typeof tb !== "object") return undefined;
  const obj = tb as Partial<TokenBudgetMeta>;
  if (
    typeof obj.pctUsed !== "number" ||
    typeof obj.limit !== "number" ||
    typeof obj.model !== "string" ||
    typeof obj.plan !== "string"
  ) {
    return undefined;
  }
  // Normalize fractional inputs (0..1) to the percentage contract.
  // Some upstream code paths may use the fraction; the meter expects
  // a percentage. Guard the boundary explicitly.
  const pctUsed = obj.pctUsed > 0 && obj.pctUsed <= 1 ? obj.pctUsed * 100 : obj.pctUsed;
  return {
    pctUsed,
    softWarning: Boolean(obj.softWarning),
    limit: obj.limit,
    model: obj.model,
    plan: obj.plan,
  };
}
