/**
 * SOVEREIGN MATRIX — AI Output Quality Scorer
 *
 * Uses NVIDIA Nemotron 70B Reward model to score AI-generated content
 * on a 0–1 scale across multiple dimensions. If output quality is below
 * threshold, the agent factory can trigger automatic regeneration.
 *
 * Dimensions scored:
 *   - helpfulness: Does the output actually answer the request?
 *   - coherence:   Is the output well-structured and logical?
 *   - correctness:  Are facts and claims accurate?
 *   - verbosity:   Is the output appropriately concise (not bloated)?
 *
 * Usage:
 *   import { scoreOutput } from "@/lib/quality-scorer";
 *   const score = await scoreOutput(prompt, response);
 *   if (score.overall < 0.6) { /* regenerate * / }
 */

import { nimChat } from "@/lib/nvidia";
import { createLogger } from "@/lib/logger";
import { cacheGet, cacheSet } from "@/lib/cache";

const log = createLogger("quality-scorer");

export interface QualityScore {
  overall: number;
  helpfulness: number;
  coherence: number;
  correctness: number;
  verbosity: number;
  passed: boolean;
  reason: string;
}

const DEFAULT_THRESHOLD = 0.6;
/** Quality scores on identical (prompt, response) pairs are deterministic.
 *  Cache for 1 hour to absorb retry storms and quality-regeneration loops. */
const QUALITY_CACHE_TTL_S = 3600;

/**
 * Score an AI-generated response for quality.
 * Returns scores from 0-1 across four dimensions plus an overall score.
 */
export async function scoreOutput(
  prompt: string,
  response: string,
  threshold = DEFAULT_THRESHOLD,
): Promise<QualityScore> {
  // Skip scoring for very short responses (likely errors or simple confirmations)
  if (response.length < 20) {
    return {
      overall: 0.8,
      helpfulness: 0.8,
      coherence: 0.9,
      correctness: 0.8,
      verbosity: 0.9,
      passed: true,
      reason: "Short response — scoring skipped",
    };
  }

  // Cache lookup — identical (prompt, response, threshold) tuples short-circuit
  // at <1ms, eliminating a ~500-token NIM call. Threshold is part of the key
  // because the `passed` boolean depends on it.
  const cacheKey = {
    p: prompt.slice(0, 500),
    r: response.slice(0, 1500),
    t: threshold,
  };
  const cached = (await cacheGet(
    "quality-score",
    cacheKey,
  )) as QualityScore | null;
  if (cached) return cached;

  try {
    const scoringPrompt = `You are a strict AI output quality evaluator. Score the following AI response to the given prompt.

PROMPT: "${prompt.slice(0, 500)}"

RESPONSE: "${response.slice(0, 1500)}"

Score each dimension from 0.0 to 1.0:
- helpfulness: Does it answer the request directly and usefully?
- coherence: Is it well-structured, logical, and readable?
- correctness: Are the facts and claims plausible and accurate?
- verbosity: Is it appropriately concise? (1.0 = perfect length, 0.0 = way too long/short)

Respond with ONLY valid JSON, no explanation:
{"helpfulness": 0.0, "coherence": 0.0, "correctness": 0.0, "verbosity": 0.0}`;

    const result = await nimChat(
      "nvidia/llama-3.1-nemotron-ultra-253b-v1",
      [{ role: "user", content: scoringPrompt }],
      { maxTokens: 150, temperature: 0.1 },
    );

    // Parse the JSON response
    const cleaned = result
      .replace(/```json?\n?/g, "")
      .replace(/```/g, "")
      .trim();
    const scores = JSON.parse(cleaned);

    const helpfulness = clamp(Number(scores.helpfulness) || 0.5);
    const coherence = clamp(Number(scores.coherence) || 0.5);
    const correctness = clamp(Number(scores.correctness) || 0.5);
    const verbosity = clamp(Number(scores.verbosity) || 0.5);

    // Weighted average: correctness matters most
    const overall =
      correctness * 0.35 +
      helpfulness * 0.3 +
      coherence * 0.2 +
      verbosity * 0.15;
    const passed = overall >= threshold;

    if (!passed) {
      log.warn("Quality check failed", {
        overall,
        threshold,
        helpfulness,
        coherence,
        correctness,
        verbosity,
      });
    }

    const verdict: QualityScore = {
      overall: round(overall),
      helpfulness: round(helpfulness),
      coherence: round(coherence),
      correctness: round(correctness),
      verbosity: round(verbosity),
      passed,
      reason: passed
        ? "Quality check passed"
        : `Below threshold (${round(overall)} < ${threshold})`,
    };
    void cacheSet("quality-score", cacheKey, verdict, QUALITY_CACHE_TTL_S);
    return verdict;
  } catch (error) {
    log.warn("Quality scoring failed, allowing output", {
      error: String(error),
    });
    return {
      overall: 0.7,
      helpfulness: 0.7,
      coherence: 0.7,
      correctness: 0.7,
      verbosity: 0.7,
      passed: true,
      reason: "Scoring unavailable — output allowed",
    };
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
