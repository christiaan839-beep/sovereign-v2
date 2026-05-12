/**
 * Confidence Gate — abstain-when-unsure policy layer for agent outputs.
 *
 * The fifth super-agent primitive from the expansion playbook. Every
 * elite agent should either:
 *   (a) return a high-confidence answer with a signed receipt, or
 *   (b) abstain explicitly with a clear "needs human" signal.
 *
 * What it does NOT do: pretend to be confident when it isn't. The
 * single most damaging failure mode in production AI is the
 * authoritative wrong answer. This gate forces the agent to admit
 * uncertainty rather than fabricate certainty.
 *
 * Architecture: thin wrapper around `confidentAi` from consensus.ts.
 * Adds:
 *   - Three-state outcome (commit | escalate | abstain) instead of
 *     binary verified/unverified
 *   - Policy-driven threshold per agent slot (legal/medical need 0.85+,
 *     marketing copy can ship at 0.6)
 *   - Structured `reasonForAbstention` so downstream code can render
 *     a useful "we don't know" message to humans
 *   - Receipt-friendly serialization (every field JSON-safe; no Date
 *     objects, no functions, no undefined)
 *
 * Usage:
 *
 *   const gated = await confidenceGate("Diagnose this rash", {
 *     system: PHARMA_SYSTEM_PROMPT,
 *     threshold: 0.85,             // medical = high bar
 *     abstainOnNetworkError: true, // 5xx → abstain, never fabricate
 *   });
 *
 *   if (gated.action === "abstain") {
 *     return needsHumanReview(gated.reason);
 *   }
 *
 *   return commitReceipt(gated.answer);
 */

import { confidentAi } from "./consensus";
import { createLogger } from "./logger";

const log = createLogger("confidence-gate");

/**
 * Per-agent-slot policy. Different domains tolerate different floors.
 *
 * The constants here are minimums; callers should pass an explicit
 * `threshold` for any sensitive use case rather than relying on the
 * default. The default sits at 0.7 because below that, even high-
 * temperature creative output starts going off-rails.
 */
export const CONFIDENCE_THRESHOLDS = {
  /** Marketing copy, brainstorming, ideation. Wrong is recoverable. */
  permissive: 0.6,
  /** Default for most agents. Balanced. */
  standard: 0.7,
  /** Legal, financial, HR. Wrong is expensive. */
  strict: 0.85,
  /** Medical, safety-of-life. Wrong is irreversible. */
  critical: 0.95,
} as const;

export type ConfidenceTier = keyof typeof CONFIDENCE_THRESHOLDS;

interface ConfidenceGateOptions {
  /** System prompt to scope the model's behavior. */
  system?: string;
  /** Maximum tokens for generation. Default 2000. */
  maxTokens?: number;
  /**
   * Minimum confidence to commit. Numeric (0-1) or a named tier
   * from CONFIDENCE_THRESHOLDS. Default: "standard" (0.7).
   */
  threshold?: number | ConfidenceTier;
  /**
   * If the underlying AI call throws (network error, rate limit,
   * provider 5xx), should the gate abstain rather than propagate?
   * Default true — production agents should NEVER fabricate when
   * upstream signal is missing.
   */
  abstainOnNetworkError?: boolean;
  /**
   * Allow the gate to escalate to a stronger model on borderline
   * confidence (between 0.5 and threshold). Default true.
   * Set false for cost-capped or latency-critical paths.
   */
  allowEscalation?: boolean;
}

export type GateAction = "commit" | "escalate" | "abstain";

export interface ConfidenceGateResult {
  /** What the agent decided to do with the output. */
  action: GateAction;
  /**
   * The model's answer. ALWAYS present, even on abstention — the
   * abstaining draft is still useful as a "what the model attempted"
   * artifact for human reviewers. Just don't ship it to users.
   */
  answer: string;
  /** Self-reported confidence in the answer (0-1). */
  confidence: number;
  /** Threshold the gate was evaluated against (0-1). */
  threshold: number;
  /**
   * Whether the gate escalated from the fast model to verified AI
   * (multi-model consensus). True implies the answer was revised.
   */
  escalated: boolean;
  /**
   * Human-readable explanation for `abstain` outcomes. Empty string
   * when the action is `commit` or `escalate`.
   */
  reason: string;
}

/**
 * Resolve a threshold input (number or tier name) to a numeric
 * threshold in [0, 1]. Clamps out-of-range inputs.
 */
export function resolveThreshold(
  input: number | ConfidenceTier | undefined,
): number {
  if (input === undefined) return CONFIDENCE_THRESHOLDS.standard;
  if (typeof input === "string") return CONFIDENCE_THRESHOLDS[input];
  // Numeric: clamp to [0, 1] so a caller passing 1.5 doesn't get
  // an impossible threshold that abstains forever.
  return Math.max(0, Math.min(1, input));
}

/**
 * Decide what the gate should do given a model's reported confidence.
 *
 * Pure function — exported so callers can unit-test the policy
 * boundary without mocking the entire AI router. Same logic the
 * production gate uses internally.
 */
export function classifyConfidence(
  confidence: number,
  threshold: number,
  allowEscalation: boolean,
): { action: GateAction; reason: string } {
  if (confidence >= threshold) {
    return { action: "commit", reason: "" };
  }

  // Below threshold but above the abstain floor — escalate if the
  // caller allows. 0.5 is the "model thinks it might be right but
  // not confidently" zone where multi-model consensus pays off.
  if (allowEscalation && confidence >= 0.5) {
    return { action: "escalate", reason: "" };
  }

  // Otherwise abstain. Build a useful reason for the human reviewer.
  const pct = (confidence * 100).toFixed(0);
  const thresholdPct = (threshold * 100).toFixed(0);
  return {
    action: "abstain",
    reason: `Model self-reported ${pct}% confidence; this surface requires ${thresholdPct}%. Routing to human review.`,
  };
}

/**
 * Run a prompt through the confidence gate.
 *
 * Always returns a structured result — never throws. Network failures
 * and provider errors are converted to abstain outcomes (when
 * `abstainOnNetworkError` is true) so the caller's happy path is the
 * same regardless of upstream reliability.
 */
export async function confidenceGate(
  prompt: string,
  options: ConfidenceGateOptions = {},
): Promise<ConfidenceGateResult> {
  const {
    system,
    maxTokens = 2000,
    abstainOnNetworkError = true,
    allowEscalation = true,
  } = options;
  const threshold = resolveThreshold(options.threshold);

  try {
    const result = await confidentAi(prompt, {
      system,
      maxTokens,
      threshold,
    });

    const decision = classifyConfidence(
      result.confidence,
      threshold,
      allowEscalation,
    );

    // If confidentAi already escalated and the result meets threshold,
    // honor that as a commit (the gate's escalation already happened
    // inside confidentAi via its internal verifiedAi call).
    if (result.escalated && result.confidence >= threshold) {
      return {
        action: "commit",
        answer: result.answer,
        confidence: result.confidence,
        threshold,
        escalated: true,
        reason: "",
      };
    }

    return {
      action: decision.action,
      answer: result.answer,
      confidence: result.confidence,
      threshold,
      escalated: result.escalated,
      reason: decision.reason,
    };
  } catch (err) {
    log.warn("confidenceGate upstream failure", {
      error: err instanceof Error ? err.message : String(err),
      abstainOnNetworkError,
    });

    if (abstainOnNetworkError) {
      return {
        action: "abstain",
        answer: "",
        confidence: 0,
        threshold,
        escalated: false,
        reason:
          "Upstream model unavailable. Sovereign refuses to fabricate; the request is queued for human review.",
      };
    }

    // The caller has opted into "throw rather than abstain" — usually
    // this means a test harness or a callsite with its own retry layer.
    throw err;
  }
}
