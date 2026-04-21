/**
 * CONFIDENCE GATE — route low-confidence agent outputs to HITL review.
 *
 * Pattern:
 *   1. Agent returns { result, confidence: 0.0-1.0 }
 *   2. Gate reads the threshold (per-agent or platform-wide default)
 *   3. If confidence < threshold → create HITL approval request,
 *      return "pending" to the caller
 *   4. If confidence >= threshold → pass through as "auto-approved"
 *
 * Threshold tuning:
 *   - 0.80 default — conservative, catches most iffy outputs
 *   - 0.65 for classification / scoring (lower stakes)
 *   - 0.90 for anything that sends an email, spends money, or changes
 *     a user's public-facing content
 *
 * The gate trusts the model's self-reported confidence. We validate
 * it's a number in [0,1] and clamp out-of-range values.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("confidence-gate");

export interface GateInput<T = unknown> {
  /** The agent's output */
  result: T;
  /** Self-reported confidence from the model (0.0–1.0) */
  confidence: number;
  /** Which agent produced this, for telemetry + HITL queue */
  agent: string;
  /** Clerk user ID — required to route the HITL approval to the right queue */
  userId: string;
  /** Short description of what the agent wants to do (shown in HITL UI) */
  action?: string;
  /** Optional: list of key assumptions the model made */
  assumptions?: string[];
  /** Free-form metadata attached to the HITL review */
  metadata?: Record<string, unknown>;
}

export type GateDecision =
  | { approved: true; result: unknown; confidence: number; via: "auto" }
  | { approved: false; reason: string; confidence: number; approvalId?: string };

/** Per-agent thresholds. Anything not listed uses DEFAULT_THRESHOLD. */
const AGENT_THRESHOLDS: Record<string, number> = {
  // High-stakes — almost always human-verify
  "cold-email-sender": 0.92,
  "stripe-refund": 0.95,
  "content-publisher": 0.90,
  "deploy-agent": 0.95,

  // Medium — sanity check on borderline
  "lead-scorer": 0.70,
  "competitor-analyzer": 0.75,
  "meeting-scheduler": 0.80,

  // Low-stakes — classification and research can ride 0.60+
  "task-classifier": 0.60,
  "sentiment-analyzer": 0.60,
  "research-summary": 0.65,
};

const DEFAULT_THRESHOLD = 0.80;

/** Clamp a confidence value to [0,1] and coerce NaN to 0. */
export function normalizeConfidence(raw: unknown): number {
  if (typeof raw !== "number" || Number.isNaN(raw)) return 0;
  return Math.max(0, Math.min(1, raw));
}

/** Threshold for a given agent, falling back to the default. */
export function thresholdFor(agent: string): number {
  return AGENT_THRESHOLDS[agent] ?? DEFAULT_THRESHOLD;
}

/**
 * Apply the confidence gate. Returns a decision that the caller can
 * branch on:
 *   - approved=true    → proceed with side effects
 *   - approved=false   → show HITL queue link + wait for human
 *
 * Callers are responsible for NOT executing side effects when
 * approved=false — this function only decides, it doesn't enforce.
 */
export async function checkConfidenceGate<T>(
  input: GateInput<T>,
): Promise<GateDecision> {
  const confidence = normalizeConfidence(input.confidence);
  const threshold = thresholdFor(input.agent);

  if (confidence >= threshold) {
    return {
      approved: true,
      result: input.result,
      confidence,
      via: "auto",
    };
  }

  // Below threshold → create a HITL approval. Dynamic import keeps
  // the HITL module out of hot paths that never need it.
  try {
    const { requestApproval } = await import("@/lib/hitl-approval");
    const approvalId = await requestApproval({
      userId: input.userId,
      agentName: input.agent,
      action: input.action ?? "low-confidence output",
      description: `Agent "${input.agent}" produced output with confidence ${confidence.toFixed(2)} (threshold: ${threshold.toFixed(2)}). ${
        input.assumptions?.length
          ? `Top assumptions: ${input.assumptions.slice(0, 3).join("; ")}.`
          : ""
      }`,
      metadata: {
        confidence,
        threshold,
        assumptions: input.assumptions ?? [],
        result: input.result,
        ...(input.metadata ?? {}),
      },
    });
    return {
      approved: false,
      reason: `Confidence ${confidence.toFixed(2)} below threshold ${threshold}. Awaiting human review.`,
      confidence,
      approvalId,
    };
  } catch (err) {
    // HITL infrastructure unavailable → be safe, block the action
    log.warn("HITL queue unavailable, blocking by default", {
      agent: input.agent,
      error: (err as Error).message,
    });
    return {
      approved: false,
      reason: "HITL queue unavailable — blocked as safety fallback.",
      confidence,
    };
  }
}

/**
 * Companion helper: take a raw LLM JSON output that MIGHT include a
 * confidence field, validate, and split into (result, confidence).
 * If the model didn't self-report, confidence defaults to 0.5 (middle)
 * so the gate treats it as uncertain rather than either extreme.
 */
export function extractConfidence<T extends object>(
  output: T,
): { result: Omit<T, "confidence" | "assumptions">; confidence: number; assumptions?: string[] } {
  const raw = output as Record<string, unknown>;
  const confidence = normalizeConfidence(raw.confidence ?? 0.5);
  const assumptions = Array.isArray(raw.assumptions) ? raw.assumptions.map(String) : undefined;

  const { confidence: _c, assumptions: _a, ...result } = raw;
  void _c; void _a; // explicit discard to satisfy lint
  return { result: result as Omit<T, "confidence" | "assumptions">, confidence, assumptions };
}
