/**
 * AGENT CONFIDENCE SCORING — surface a 0..1 confidence per response.
 *
 * Closes OWASP LLM09 (Overreliance). Customers shouldn't have to guess
 * how reliable a given agent response is — the platform should TELL
 * them, with the math behind the score auditable.
 *
 * The score is a weighted combination of structural signals we can
 * compute cheaply without an extra LLM call:
 *
 *   - **schema match** (0.30): if the output validated against a Zod
 *     schema with no coercion warnings, +0.30. Coerced or lenient
 *     match → 0.15. Schema violation that we recovered from → 0.05.
 *
 *   - **model diversity** (0.20): if multiple models contributed
 *     (consensus engine fired) AND they agreed, +0.20. If consensus
 *     fired and DISAGREED (we picked one), 0.05. Single model = 0.10
 *     (no cross-check; not low confidence, just no signal).
 *
 *   - **safety pipeline** (0.15): all 5 layers passed → 0.15. Any
 *     layer flagged → 0.0 (already blocked but visible to caller).
 *
 *   - **structural-output ratio** (0.15): if the output is mostly
 *     quoted-input (token-overlap > 0.7), confidence drops because
 *     the agent is parroting. Output substantially novel → 0.15.
 *
 *   - **eval pass rate** (0.20): per-agent rolling 7d eval pass rate
 *     from the golden set. >95% → 0.20, 80-95% → 0.10, <80% → 0.05,
 *     no evals → 0.10 (neutral — no data either way).
 *
 * Total caps at 1.0. Recommended actions:
 *   - 0.85+: trust outright
 *   - 0.65-0.84: review headlines, trust details
 *   - 0.45-0.64: human-review-required for any decision
 *   - <0.45: treat as draft only; do not commit downstream
 *
 * NEVER throws. Designed to ride alongside every response without
 * adding latency. All inputs are already computed in the factory.
 */

export interface ConfidenceInputs {
  /** Did the output match the agent's Zod schema cleanly? */
  schemaMatch: "clean" | "coerced" | "violation" | "no-schema";
  /** How many models contributed (1 = single, 2+ = consensus fired). */
  modelsConsulted: number;
  /** Did consensus models AGREE? (only meaningful if modelsConsulted >= 2) */
  consensusAgreed: boolean | null;
  /** Did any safety layer flag the response? */
  safetyFlagged: boolean;
  /** Token-overlap ratio between input and output (0..1). >0.7 = parrot. */
  inputOutputOverlap: number;
  /** Per-agent 7-day eval pass rate, 0..1. null = no evals on file. */
  evalPassRate: number | null;
}

export interface ConfidenceResult {
  score: number; // 0..1
  band: "high" | "moderate" | "review" | "draft";
  recommendedAction: string;
  breakdown: Array<{ factor: string; weight: number; contribution: number }>;
}

const SCHEMA_WEIGHTS: Record<ConfidenceInputs["schemaMatch"], number> = {
  clean: 0.30,
  coerced: 0.15,
  violation: 0.05,
  "no-schema": 0.18, // neutral — most agents don't have a schema yet
};

export function scoreConfidence(inputs: ConfidenceInputs): ConfidenceResult {
  const breakdown: ConfidenceResult["breakdown"] = [];

  // 1. Schema match (0.30)
  const schemaContribution = SCHEMA_WEIGHTS[inputs.schemaMatch];
  breakdown.push({ factor: "schema_match", weight: 0.30, contribution: schemaContribution });

  // 2. Model diversity (0.20)
  let diversityContribution = 0.10; // single-model neutral
  if (inputs.modelsConsulted >= 2) {
    diversityContribution = inputs.consensusAgreed === true ? 0.20 : 0.05;
  }
  breakdown.push({ factor: "model_diversity", weight: 0.20, contribution: diversityContribution });

  // 3. Safety pipeline (0.15)
  const safetyContribution = inputs.safetyFlagged ? 0.0 : 0.15;
  breakdown.push({ factor: "safety_pipeline", weight: 0.15, contribution: safetyContribution });

  // 4. Output novelty (0.15) — penalize parrots
  let noveltyContribution = 0.15;
  if (inputs.inputOutputOverlap > 0.7) {
    noveltyContribution = 0.04; // mostly quoted input
  } else if (inputs.inputOutputOverlap > 0.4) {
    noveltyContribution = 0.10;
  }
  breakdown.push({ factor: "output_novelty", weight: 0.15, contribution: noveltyContribution });

  // 5. Eval pass rate (0.20)
  let evalContribution = 0.10; // neutral when no data
  if (inputs.evalPassRate !== null) {
    if (inputs.evalPassRate >= 0.95) evalContribution = 0.20;
    else if (inputs.evalPassRate >= 0.80) evalContribution = 0.10;
    else evalContribution = 0.05;
  }
  breakdown.push({ factor: "eval_pass_rate", weight: 0.20, contribution: evalContribution });

  const score = Math.min(
    1.0,
    Math.max(
      0.0,
      breakdown.reduce((acc, b) => acc + b.contribution, 0),
    ),
  );

  const { band, recommendedAction } = classifyBand(score);
  return { score: Math.round(score * 100) / 100, band, recommendedAction, breakdown };
}

function classifyBand(score: number): {
  band: ConfidenceResult["band"];
  recommendedAction: string;
} {
  if (score >= 0.85) {
    return {
      band: "high",
      recommendedAction:
        "Trust outright. Consensus, schema, and evals all aligned.",
    };
  }
  if (score >= 0.65) {
    return {
      band: "moderate",
      recommendedAction:
        "Trust headlines; spot-check details before committing downstream.",
    };
  }
  if (score >= 0.45) {
    return {
      band: "review",
      recommendedAction:
        "Human review required before any decision touches a customer or external system.",
    };
  }
  return {
    band: "draft",
    recommendedAction:
      "Treat as draft only. Do not commit downstream without re-running with stricter parameters.",
  };
}

/**
 * Cheap token-overlap calculator — returns the fraction of input tokens
 * that ALSO appear in the output. Pure-string Jaccard-like ratio so it
 * works without a tokenizer.
 */
export function computeInputOutputOverlap(
  input: string,
  output: string,
): number {
  if (!input || !output) return 0;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3);
  const inTokens = new Set(norm(input));
  const outTokens = new Set(norm(output));
  if (inTokens.size === 0 || outTokens.size === 0) return 0;
  let shared = 0;
  for (const t of outTokens) if (inTokens.has(t)) shared++;
  return shared / outTokens.size;
}
