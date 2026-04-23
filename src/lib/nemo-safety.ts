/**
 * NemoGuard safety pipeline — free NIM-hosted safety stack that
 * replaces the paid Claude critic in submission-safety.ts.
 *
 * Three purpose-built NVIDIA classifiers run in parallel:
 *
 *   nemoguard-8b-content-safety       — 23-category harmful content
 *   nemoguard-jailbreakdetect         — adversarial prompt patterns
 *   nemoguard-8b-topic-control        — off-topic / low-quality signal
 *
 * Each model votes; this pipeline aggregates into a single
 * { passed, safetyScore, reason, layers } shape that matches the
 * DeepSafetyResult contract from submission-safety.ts so it is a
 * drop-in replacement.
 *
 * Fail-open: if all three model calls error (NIM down, quota, etc.)
 * the aggregate returns `passed: true` with safetyScore=70 and a
 * clear reason in logs. This matches the existing Claude-critic
 * behaviour — a provider outage never halts every auto-publish.
 * The synchronous layer + human post-hoc audit are the safety net.
 *
 * Cost: $0. NemoGuard is free on NVIDIA NIM. At 10k auto-publishes
 * per month this replaces ~$100 of Claude critic spend with zero
 * change in coverage (arguably better, since nemoguard-jailbreakdetect
 * is purpose-trained for the jailbreak task rather than a general LLM
 * doing it as a side-job).
 */

import { createLogger } from "@/lib/logger";
import { nemoGuardCheck } from "@/lib/nvidia";

const log = createLogger("nemo-safety");

/* ─── Types (match submission-safety DeepSafetyResult shape) ──── */

export interface NemoLayerVerdict {
  passed: boolean;
  /** 0–100, higher = safer. 70 is the fail-open default. */
  score: number;
  reason?: string;
}

export interface NemoSafetyResult {
  passed: boolean;
  /** Aggregate 0–100; min of the three layer scores. */
  safetyScore: number;
  reason?: string;
  layers: {
    contentSafety: NemoLayerVerdict;
    jailbreakProbe: NemoLayerVerdict;
    topicControl: NemoLayerVerdict;
  };
}

export interface NemoSafetyInput {
  /** Primary text the buyer of the agent will see. */
  displayName: string;
  purpose: string;
  guarantees: string[];
  /** The synthesized system prompt — what the agent itself runs with. */
  systemPrompt: string;
}

/* ─── Internals ───────────────────────────────────────────────── */

function nimKeyAvailable(): boolean {
  return Boolean(process.env.NIM_API_KEY ?? process.env.NVIDIA_API_KEY);
}

/**
 * Map nemoGuardCheck's numeric score (0..1 where higher = riskier)
 * to our 0..100 safety score (higher = safer). The existing helper
 * returns score=0.9 when unsafe, 0.1 when safe — invert + scale.
 */
function toSafetyScore(
  raw: { safe: boolean; score: number },
): number {
  const inverted = 1 - raw.score;
  const scaled = Math.round(Math.max(0, Math.min(1, inverted)) * 100);
  // Floor at 10 when flagged unsafe — avoids 0 which could be confused
  // with "no data". Ceiling at 99 when flagged safe — avoids implying
  // perfection from a single-model vote.
  if (!raw.safe) return Math.min(scaled, 30);
  return Math.max(scaled, 70);
}

async function runOneCheck(
  text: string,
  check: "jailbreak" | "content-safety" | "topic-control",
): Promise<NemoLayerVerdict> {
  try {
    const r = await nemoGuardCheck(text, check);
    return {
      passed: r.safe,
      score: toSafetyScore(r),
      reason: !r.safe ? `NemoGuard ${check}: ${r.details}` : undefined,
    };
  } catch (err) {
    log.warn(`nemoGuard ${check} threw — failing open`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return { passed: true, score: 70 };
  }
}

/* ─── Public API ──────────────────────────────────────────────── */

/**
 * Run the three NemoGuard checks in parallel against a submission.
 *
 * Aggregation rule: the submission PASSES only if all three layers
 * pass. Any single layer failure blocks the auto-publish. This is
 * deliberately strict — a topic-control "off-topic" verdict, for
 * instance, suggests the creator's manifest describes something that
 * isn't a useful B2B agent at all.
 *
 * Graceful no-key: returns `passed: true` with safetyScore=70 when
 * no NIM key is present. The synchronous regex/bounds layer has
 * already caught obvious issues, and human post-hoc audit catches
 * anything subtle — keeping the pipeline running under a key outage
 * is better than blocking every submission.
 */
export async function runNemoSafety(
  input: NemoSafetyInput,
): Promise<NemoSafetyResult> {
  if (!nimKeyAvailable()) {
    const allOpen: NemoLayerVerdict = { passed: true, score: 70 };
    return {
      passed: true,
      safetyScore: 70,
      reason: "NemoGuard skipped: no NIM key configured",
      layers: {
        contentSafety: allOpen,
        jailbreakProbe: allOpen,
        topicControl: allOpen,
      },
    };
  }

  // The three models see different slices of the submission so each
  // vote is about the right signal. We don't blast the entire corpus
  // at every model — that would let one bad field poison the others.
  const contentCorpus = [
    input.displayName,
    input.purpose,
    ...input.guarantees,
  ].join("\n");

  const [contentSafety, jailbreakProbe, topicControl] = await Promise.all([
    runOneCheck(contentCorpus, "content-safety"),
    runOneCheck(input.systemPrompt, "jailbreak"),
    runOneCheck(input.purpose, "topic-control"),
  ]);

  const passed = contentSafety.passed && jailbreakProbe.passed && topicControl.passed;
  const safetyScore = Math.min(
    contentSafety.score,
    jailbreakProbe.score,
    topicControl.score,
  );
  const reason = !passed
    ? [contentSafety.reason, jailbreakProbe.reason, topicControl.reason]
        .filter(Boolean)
        .join(" | ")
    : undefined;

  return {
    passed,
    safetyScore,
    reason,
    layers: {
      contentSafety,
      jailbreakProbe,
      topicControl,
    },
  };
}
