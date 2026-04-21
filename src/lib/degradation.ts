/**
 * GRACEFUL DEGRADATION — platform-wide kill switch with severity levels.
 *
 * Every elite AI platform has a "minimal mode" button. When things go
 * sideways (a provider outage, a DB spike, an abusive traffic pattern),
 * you flip a flag and the product degrades into a simpler form that
 * still works — instead of erroring out.
 *
 * Three levels:
 *   normal   — full feature set (multi-model, memory, research grounding,
 *              rejection sampling, critique-revise)
 *   reduced  — skip expensive features (no rejection sampling, no critic
 *              pass, short max tokens, cached results preferred)
 *   minimal  — basic AI calls only (single fast model, no memory, no
 *              research, no verification — whatever keeps the app
 *              responding)
 *
 * Source of truth: DEGRADATION_MODE env var, falling back to process
 * memory. A flip survives process restarts only if the env var is set
 * (Vercel/Railway dashboard flip). Runtime flip via setDegradationMode()
 * is per-instance and resets on deploy.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("degradation");

export type DegradationMode = "normal" | "reduced" | "minimal";

let runtimeOverride: DegradationMode | null = null;

/**
 * Get the effective degradation mode. Priority:
 *   1. Runtime override (most recent setDegradationMode call)
 *   2. DEGRADATION_MODE env var
 *   3. Default: "normal"
 */
export function getDegradationMode(): DegradationMode {
  if (runtimeOverride) return runtimeOverride;
  const envMode = process.env.DEGRADATION_MODE?.toLowerCase() as DegradationMode | undefined;
  if (envMode === "normal" || envMode === "reduced" || envMode === "minimal") {
    return envMode;
  }
  return "normal";
}

/**
 * Flip the degradation mode at runtime. Affects only the current process
 * — use an env var flip via the hosting dashboard for platform-wide change.
 * Returns the previous mode for reversibility (undo in a later call).
 */
export function setDegradationMode(mode: DegradationMode): DegradationMode {
  const previous = getDegradationMode();
  runtimeOverride = mode === "normal" ? null : mode;
  log.warn("Degradation mode changed", { from: previous, to: mode });
  return previous;
}

/**
 * Feature gates — callers ask "is this feature on?" rather than branching
 * on the raw mode enum everywhere. Keeps the degradation policy in ONE
 * place (this file) so we can tune what each mode disables without
 * hunting through call sites.
 */
export const features = {
  /** Multi-model consensus (verifiedAi, 2-3 model agreement) */
  consensus(): boolean { return getDegradationMode() === "normal"; },

  /** Rejection sampling (generate N, pick best) */
  rejectionSampling(): boolean { return getDegradationMode() === "normal"; },

  /** Generate → critique → revise loop */
  critiqueRevise(): boolean { return getDegradationMode() === "normal"; },

  /** Tavily web research grounding */
  research(): boolean { return getDegradationMode() !== "minimal"; },

  /** Vector memory recall (Pinecone/Qdrant) */
  vectorMemory(): boolean { return getDegradationMode() !== "minimal"; },

  /** Computer-use agent (expensive, brittle) */
  computerUse(): boolean { return getDegradationMode() === "normal"; },

  /** Full playbook execution (vs single-agent fallback) */
  playbooks(): boolean { return getDegradationMode() !== "minimal"; },

  /** HITL approval checks (skip only in minimal — always prefer human gate) */
  hitl(): boolean { return true; },
} as const;

/**
 * Suggested max tokens for a given operation, adjusted for degradation mode.
 * Reduces output size as mode tightens — shorter responses = lower cost
 * and faster completion during an incident.
 */
export function maxTokensFor(task: "short" | "medium" | "long"): number {
  const mode = getDegradationMode();
  const budgets: Record<DegradationMode, Record<typeof task, number>> = {
    normal:  { short: 500, medium: 2000, long: 8000 },
    reduced: { short: 300, medium: 1000, long: 3000 },
    minimal: { short: 200, medium: 500,  long: 1500 },
  };
  return budgets[mode][task];
}

/**
 * Preferred model for this mode. In an incident we want the fastest
 * provider with the highest availability — not the smartest one.
 */
export function preferredModelFor(mode: DegradationMode = getDegradationMode()): "nim" | "cerebras" | "gemini" {
  if (mode === "minimal") return "cerebras"; // fastest, most available
  if (mode === "reduced") return "nim";      // default, free, reliable
  return "nim";                               // normal: let smart-router decide
}
