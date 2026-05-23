/**
 * SOVEREIGN MATRIX — DSPy-style prompt optimizer (Wave 133).
 *
 * Compiles a system prompt against an eval set rather than hand-tuning.
 * DSPy is Python-only; this is a TS port of the core "candidate
 * generation + scoring + selection" loop that makes DSPy's
 * `BootstrapFewShot` and `MIPRO` valuable.
 *
 * Algorithm (one pass):
 *   1. Pull eval-set examples from agent_runs (graded by trust-verifier)
 *   2. Generate K candidate system prompts from the seed prompt + few
 *      example pairs (LLM as a meta-prompt engineer)
 *   3. Score each candidate by running the eval set through it and
 *      averaging the result quality
 *   4. Return the best-scoring candidate + score deltas
 *
 * Wire-protocol:
 *   - Candidate generation uses `smartOssChat` when self-host is up,
 *     else falls back to `nimChat` on a fast model
 *   - Scoring uses an LLM-as-judge call (Claude Opus when available)
 *
 * Pure-function core:
 *   `selectBestCandidate(scoredCandidates)` is exposed for tests.
 *   The wrapper handles the LLM calls + the eval loop.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("prompt-optimizer");

export interface EvalExample {
  /** What the user said. */
  input: string;
  /** Optional reference output. Not required — quality judge can use a rubric. */
  reference?: string;
}

export interface ScoredCandidate {
  prompt: string;
  /** 0-1 average score across the eval set. Higher is better. */
  score: number;
  /** Per-example scores for debugging. */
  exampleScores: number[];
  /** Optional rationale from the judge. */
  notes?: string;
}

export interface OptimizeOptions {
  /** How many candidate prompts to generate + score. Default 5. */
  numCandidates?: number;
  /** Maximum eval examples to score against per candidate. Default 10. */
  evalSize?: number;
  /** Seed system prompt — the baseline to beat. */
  seedPrompt: string;
  /** Eval examples — input + optional reference. */
  evalSet: EvalExample[];
  /**
   * Async runner that takes (systemPrompt, userInput) and returns the
   * model's answer. Caller supplies this so the optimizer is
   * agnostic to the underlying inference path.
   */
  runner: (systemPrompt: string, userInput: string) => Promise<string>;
  /**
   * Async scorer that takes the runner output + (optional) reference
   * and returns 0-1. Caller supplies this so the optimizer is
   * agnostic to the judge model.
   */
  scorer: (
    output: string,
    example: EvalExample,
    systemPrompt: string,
  ) => Promise<number>;
  /**
   * Async candidate generator that returns N alternative prompts.
   * Default implementation provided below uses heuristic rewrites.
   */
  candidateGenerator?: (
    seed: string,
    examples: EvalExample[],
    n: number,
  ) => Promise<string[]>;
}

/**
 * Heuristic-only default candidate generator. Doesn't require an LLM
 * call. Produces N variant prompts by:
 *   - prepending stylistic directives (concise / structured / step-by-step)
 *   - inserting "Be specific. Cite evidence." style suffixes
 *   - varying the assertiveness ("You are..." vs "You must always...")
 *
 * Operators that want LLM-generated variants pass their own generator.
 */
export async function defaultHeuristicGenerator(
  seed: string,
  _examples: EvalExample[],
  n: number,
): Promise<string[]> {
  const directives = [
    "Be concise — never exceed 3 sentences unless asked.",
    "Structure your answer with clear sections and bullet points where helpful.",
    "Think step by step before answering.",
    "Cite specific evidence from the input. Avoid generic statements.",
    "Be specific and avoid filler phrases like 'I would be happy to'.",
    "Prioritize accuracy over thoroughness — say 'I don't know' when uncertain.",
  ];
  const prefixes = ["You are an expert. ", "Your task: ", "Important — ", ""];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const prefix = prefixes[i % prefixes.length];
    const directive = directives[i % directives.length];
    out.push(`${prefix}${seed}\n\n${directive}`);
  }
  return out;
}

/**
 * Pure-function selector — takes a list of scored candidates and
 * returns the best one. Tie-breaks on shorter prompt (Occam).
 * Returns null on empty input.
 */
export function selectBestCandidate(
  candidates: ScoredCandidate[],
): ScoredCandidate | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.prompt.length - b.prompt.length;
  });
  return sorted[0];
}

/**
 * High-level compile loop. Returns the best candidate + delta vs seed.
 * If every candidate scores ≤ the seed, returns the seed unchanged
 * with `improved: false`.
 */
export async function compilePrompt(opts: OptimizeOptions): Promise<{
  best: ScoredCandidate;
  seedScore: number;
  delta: number;
  improved: boolean;
  allCandidates: ScoredCandidate[];
}> {
  const n = Math.max(2, opts.numCandidates ?? 5);
  const evalSize = Math.max(2, opts.evalSize ?? 10);
  const evalSet = opts.evalSet.slice(0, evalSize);

  if (evalSet.length === 0) {
    throw new Error("Cannot compile prompt with empty eval set");
  }

  const generator = opts.candidateGenerator ?? defaultHeuristicGenerator;

  // Step 1: score the seed
  const seedScored = await scoreCandidate(opts.seedPrompt, opts, evalSet);

  // Step 2: generate candidates (always includes seed as candidate 0)
  const candidates = [opts.seedPrompt];
  try {
    const generated = await generator(opts.seedPrompt, evalSet, n - 1);
    for (const c of generated) {
      if (!candidates.includes(c)) candidates.push(c);
    }
  } catch (err) {
    log.warn("candidate generator failed; using seed only", {
      error: String(err),
    });
  }

  // Step 3: score everything
  const scored: ScoredCandidate[] = [];
  for (const cand of candidates) {
    if (cand === opts.seedPrompt) {
      scored.push(seedScored);
      continue;
    }
    const result = await scoreCandidate(cand, opts, evalSet);
    scored.push(result);
  }

  const best = selectBestCandidate(scored) ?? seedScored;
  const delta = best.score - seedScored.score;
  return {
    best,
    seedScore: seedScored.score,
    delta,
    improved: delta > 0.01, // 1% threshold to call it a win
    allCandidates: scored,
  };
}

async function scoreCandidate(
  candidate: string,
  opts: OptimizeOptions,
  evalSet: EvalExample[],
): Promise<ScoredCandidate> {
  const exampleScores: number[] = [];
  for (const ex of evalSet) {
    try {
      const output = await opts.runner(candidate, ex.input);
      const score = await opts.scorer(output, ex, candidate);
      exampleScores.push(Math.max(0, Math.min(1, score)));
    } catch (err) {
      log.warn("eval example failed", { error: String(err) });
      exampleScores.push(0);
    }
  }
  const score =
    exampleScores.length === 0
      ? 0
      : exampleScores.reduce((s, n) => s + n, 0) / exampleScores.length;
  return { prompt: candidate, score, exampleScores };
}
