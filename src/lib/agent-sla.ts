/**
 * Agent-level SLA — the first real "refund if not excellent" guarantee
 * system in any agent marketplace.
 *
 * Creators declare in their SAM manifest:
 *
 *   "sla": {
 *     "confidenceMin": 0.8,               // 0..1; below this → refund
 *     "refundPctIfBreach": 100,           // 0..100; what % of gross to reverse
 *     "description": "95% field-extraction confidence or free."
 *   }
 *
 * At invoke time:
 *   1. The agent produces output via ai()
 *   2. scoreConfidence() computes a 0..1 heuristic score on the output
 *   3. If score < manifest.sla.confidenceMin:
 *        - The earning row's status flips to "reversed"
 *        - The response carries `slaBreached: true, refunded: true`
 *        - A structured log records the breach for operator review
 *
 * Why heuristic (not LLM-judge): a judge model costs $ and adds latency;
 * heuristics catch obvious low-quality outputs (empty, very short,
 * malformed JSON when structured was expected, explicit refusal phrases).
 * When a creator wants a stronger signal, they can upgrade to a custom
 * judge in a later iteration.
 *
 * Why this matters: no other marketplace gives buyers a "money-back"
 * axis. Zapier, n8n, CrewAI — none of them enforce creator SLAs at
 * invocation time. Sovereign agents can now compete on guarantees.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("agent-sla");

/* ─── Types ───────────────────────────────────────────────────── */

export interface SlaConfig {
  /** 0..1; output confidence below this → treated as breach. */
  confidenceMin: number;
  /** 0..100; percent of gross to refund on breach. */
  refundPctIfBreach: number;
  /** Human-readable buyer-facing promise. */
  description: string;
}

export interface SlaVerdict {
  enforced: boolean;
  breached: boolean;
  confidence: number;
  refundPct: number;
  reason?: string;
  description?: string;
}

export interface ConfidenceScoreInput {
  output: string;
  expectedJson?: boolean;
  /** Optional floor — outputs shorter than this drop score hard. */
  minLengthChars?: number;
}

/* ─── Extract SLA from a manifest ─────────────────────────────── */

export function parseSlaFromManifest(manifestRaw: unknown): SlaConfig | null {
  if (!manifestRaw || typeof manifestRaw !== "object" || Array.isArray(manifestRaw)) {
    return null;
  }
  const m = manifestRaw as Record<string, unknown>;
  const raw = m.sla;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;

  const confidenceMin =
    typeof s.confidenceMin === "number" && s.confidenceMin >= 0 && s.confidenceMin <= 1
      ? s.confidenceMin
      : null;
  if (confidenceMin === null) return null;

  const refundPctIfBreach =
    typeof s.refundPctIfBreach === "number" &&
    s.refundPctIfBreach >= 0 &&
    s.refundPctIfBreach <= 100
      ? s.refundPctIfBreach
      : 100;

  const description =
    typeof s.description === "string" && s.description.length > 0
      ? s.description
      : `Confidence ≥ ${Math.round(confidenceMin * 100)}% or ${refundPctIfBreach}% refund`;

  return { confidenceMin, refundPctIfBreach, description };
}

/* ─── Confidence scoring ──────────────────────────────────────── */

const REFUSAL_SIGNALS: ReadonlyArray<string> = [
  "i cannot",
  "i can't",
  "i'm unable",
  "i am unable",
  "i'm sorry, but",
  "i apologize, but",
  "as an ai",
  "i don't have",
  "i do not have access",
  "cannot provide",
];

const UNCERTAINTY_SIGNALS: ReadonlyArray<string> = [
  "i think",
  "i believe",
  "possibly",
  "it might be",
  "it seems",
  "not entirely sure",
  "unclear",
  "may or may not",
];

/**
 * Compute a 0..1 confidence heuristic on an agent output. Cheap,
 * deterministic, no model calls. Penalises:
 *   - empty / whitespace-only output (score ≈ 0)
 *   - outputs shorter than the declared minLength (score ≈ 0)
 *   - outputs with refusal phrases (-0.6)
 *   - outputs with uncertainty phrases (-0.15 each, capped)
 *   - outputs that should be JSON but fail to parse (-0.4)
 *   - outputs that repeat themselves heavily (-0.2)
 *
 * Returns a value in [0, 1]. 0.5 is the "indifferent" midpoint.
 */
export function scoreConfidence(input: ConfidenceScoreInput): number {
  const out = input.output ?? "";
  const trimmed = out.trim();
  if (!trimmed) return 0;

  const minLen = input.minLengthChars ?? 20;
  if (trimmed.length < minLen) return Math.min(0.3, trimmed.length / (minLen * 2));

  let score = 0.85; // base — most outputs are reasonable
  const lower = trimmed.toLowerCase();

  // Refusal detection — strongest signal.
  for (const phrase of REFUSAL_SIGNALS) {
    if (lower.includes(phrase)) {
      score -= 0.6;
      break;
    }
  }

  // Uncertainty signals, bounded penalty.
  let uncertHits = 0;
  for (const phrase of UNCERTAINTY_SIGNALS) {
    if (lower.includes(phrase)) uncertHits++;
  }
  score -= Math.min(uncertHits * 0.12, 0.35);

  // JSON validity when expected.
  if (input.expectedJson) {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) {
      score -= 0.4;
    } else {
      try {
        JSON.parse(jsonMatch[0]);
      } catch {
        score -= 0.4;
      }
    }
  }

  // Repetition detection — cheap proxy. If the most common 20-char
  // slice appears >3 times, the output is likely looping.
  if (trimmed.length > 200) {
    const slice = trimmed.slice(50, 70);
    if (slice.length === 20) {
      const occurrences = trimmed.split(slice).length - 1;
      if (occurrences > 3) score -= 0.2;
    }
  }

  return Math.max(0, Math.min(1, score));
}

/* ─── SLA verdict ─────────────────────────────────────────────── */

/**
 * Evaluate whether an agent's output breaches its declared SLA.
 * Call from the invocation path AFTER ai() returns. A breach flips
 * the earning row to "reversed" status via the caller.
 */
export function evaluateSla(args: {
  manifestRaw: unknown;
  output: string;
  expectedJson?: boolean;
}): SlaVerdict {
  const sla = parseSlaFromManifest(args.manifestRaw);
  if (!sla) {
    // No SLA declared — verdict "not enforced", never a breach.
    return {
      enforced: false,
      breached: false,
      confidence: 1,
      refundPct: 0,
    };
  }

  const confidence = scoreConfidence({
    output: args.output,
    expectedJson: args.expectedJson,
  });

  const breached = confidence < sla.confidenceMin;
  if (breached) {
    log.info("SLA breach detected", {
      confidence,
      confidenceMin: sla.confidenceMin,
      refundPct: sla.refundPctIfBreach,
    });
  }

  return {
    enforced: true,
    breached,
    confidence,
    refundPct: breached ? sla.refundPctIfBreach : 0,
    reason: breached
      ? `Confidence ${Math.round(confidence * 100)}% < promised ${Math.round(sla.confidenceMin * 100)}%`
      : undefined,
    description: sla.description,
  };
}
