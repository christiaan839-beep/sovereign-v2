/**
 * SOVEREIGN MATRIX — Eval harness (Wave 138).
 *
 * The keystone of closed-loop self-improvement. Without this, every
 * fine-tune, prompt-optimization, and adapter promotion is theatre —
 * you have no measurement, only hope.
 *
 * What it does (pure aggregator + thin DB wrapper):
 *   1. Pulls a sample of recent `agent_runs` rows per agent
 *   2. Re-scores each row's output against the input using either:
 *      - heuristic rubric (length-band + structural-keyword + no-PII)
 *      - LLM-as-judge (caller supplies the judge function)
 *   3. Aggregates per-agent quality scores into `EvalReport`
 *   4. Detects regressions vs the prior eval baseline stored in the
 *      `eval_baselines` table (created by migration 0027)
 *
 * Design rules:
 *   - Pure function `aggregateEvalScores(rows, opts)` is unit-testable
 *     without DB or LLM calls
 *   - `computeEvalReport()` is the DB-backed wrapper that pulls rows +
 *     calls the aggregator
 *   - LLM-as-judge is OPTIONAL — operators that don't want to spend
 *     judge tokens get the heuristic rubric
 *   - Regression detection is delta-based (current vs baseline > X%)
 *
 * Use cases:
 *   - Operator runs `node scripts/run-eval.mjs` weekly → diff vs prior
 *   - Cron job runs every 24h → write baseline → alert on regression
 *   - Pre-promotion check: new adapter must beat the live model on
 *     the eval set before traffic shifts
 */

import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { gt, eq, and, desc } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("eval-harness");

const MIN_OUTPUT_LEN = 50;
const MAX_OUTPUT_LEN = 12_000;
const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b\d{16}\b/, // credit card
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/, // email (any)
] as const;

export interface EvalSampleRow {
  id: string;
  agentName: string;
  modelUsed: string;
  inputJson: string;
  outputJson: string;
  trustDecision: string;
  durationMs: number;
  createdAt: Date;
}

export type Judge = (
  input: string,
  output: string,
  agentName: string,
) => Promise<number>;

export interface AgentEvalRow {
  agentName: string;
  samples: number;
  avgScore: number;
  /** Auto-approved share — 0..1. */
  autoApprovedRate: number;
  /** Run avg duration ms. */
  avgDurationMs: number;
  /** Quality issues found (heuristic — PII leak, too short, etc.). */
  flags: Array<{ id: string; kind: string }>;
}

export interface EvalReport {
  generatedAt: string;
  windowDays: number;
  totalRowsScored: number;
  perAgent: AgentEvalRow[];
  /** Global summary. */
  overall: {
    avgScore: number;
    autoApprovedRate: number;
  };
}

export interface EvalRegression {
  agentName: string;
  baselineScore: number;
  currentScore: number;
  delta: number;
  /** Percentage drop, positive number when regressed. */
  pctDrop: number;
}

/** Default heuristic scorer — no LLM cost. */
export function heuristicScore(input: string, output: string): number {
  if (!output || output.trim().length < MIN_OUTPUT_LEN) return 0.1;
  if (output.length > MAX_OUTPUT_LEN) return 0.4; // rambling

  let score = 0.5;

  // Penalise filler / generic phrases
  const fillerHits = [
    /i would be happy to/i,
    /certainly!/i,
    /great question/i,
    /as an ai/i,
  ].reduce((n, re) => (re.test(output) ? n + 1 : n), 0);
  score -= 0.05 * fillerHits;

  // Reward specificity — numbers, named entities, citations
  const numbers = (output.match(/\b\d+(?:\.\d+)?\b/g) ?? []).length;
  score += Math.min(0.2, numbers * 0.02);
  if (/https?:\/\//.test(output)) score += 0.05;
  if (/<source/i.test(output) || /\[\d+\]/.test(output)) score += 0.05;

  // Penalise repetition (cheap detector)
  const words = output.toLowerCase().match(/\b\w{5,}\b/g) ?? [];
  if (words.length > 20) {
    const unique = new Set(words);
    const ratio = unique.size / words.length;
    if (ratio < 0.3)
      score -= 0.2; // very repetitive
    else if (ratio < 0.5) score -= 0.1;
  }

  // Penalise PII leakage in output
  for (const re of PII_PATTERNS) {
    if (re.test(output)) {
      score -= 0.25;
      break;
    }
  }

  // Reward answering the question — keyword overlap with input
  const inputWords = new Set(
    (input.toLowerCase().match(/\b\w{4,}\b/g) ?? []).slice(0, 30),
  );
  const outputWords = new Set(
    (output.toLowerCase().match(/\b\w{4,}\b/g) ?? []).slice(0, 200),
  );
  let overlap = 0;
  for (const w of inputWords) {
    if (outputWords.has(w)) overlap++;
  }
  score += Math.min(0.15, overlap * 0.015);

  return Math.max(0, Math.min(1, score));
}

function extractInputText(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") return parsed;
    if (!parsed || typeof parsed !== "object") return "";
    const obj = parsed as Record<string, unknown>;
    for (const k of ["prompt", "text", "query", "message", "goal", "problem"]) {
      const v = obj[k];
      if (typeof v === "string" && v.length > 0) return v;
    }
    return JSON.stringify(obj).slice(0, 4_000);
  } catch {
    return "";
  }
}

function extractOutputText(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") return parsed;
    if (!parsed || typeof parsed !== "object") return "";
    const obj = parsed as Record<string, unknown>;
    for (const k of [
      "result",
      "output",
      "response",
      "text",
      "answer",
      "analysis",
      "summary",
      "final_answer",
      "agentResponse",
      "solution",
    ]) {
      const v = obj[k];
      if (typeof v === "string" && v.length > 0) return v;
    }
    return "";
  } catch {
    return "";
  }
}

/**
 * Pure aggregator — no I/O. Takes a row sample + an OPTIONAL judge
 * function and returns the EvalReport.
 *
 * If `judge` is omitted, uses the heuristic scorer (no LLM cost).
 */
export async function aggregateEvalScores(
  rows: EvalSampleRow[],
  opts: { windowDays?: number; judge?: Judge } = {},
): Promise<EvalReport> {
  const perAgent = new Map<
    string,
    {
      scores: number[];
      approvedCount: number;
      totalDuration: number;
      count: number;
      flags: Array<{ id: string; kind: string }>;
    }
  >();

  for (const r of rows) {
    const inputText = extractInputText(r.inputJson);
    const outputText = extractOutputText(r.outputJson);

    let score: number;
    if (opts.judge) {
      try {
        score = Math.max(
          0,
          Math.min(1, await opts.judge(inputText, outputText, r.agentName)),
        );
      } catch (err) {
        log.warn("judge threw — fallback heuristic", { error: String(err) });
        score = heuristicScore(inputText, outputText);
      }
    } else {
      score = heuristicScore(inputText, outputText);
    }

    const flags: Array<{ id: string; kind: string }> = [];
    if (outputText.length < MIN_OUTPUT_LEN)
      flags.push({ id: r.id, kind: "too-short" });
    if (PII_PATTERNS.some((re) => re.test(outputText)))
      flags.push({ id: r.id, kind: "pii-leak" });

    let bucket = perAgent.get(r.agentName);
    if (!bucket) {
      bucket = {
        scores: [],
        approvedCount: 0,
        totalDuration: 0,
        count: 0,
        flags: [],
      };
      perAgent.set(r.agentName, bucket);
    }
    bucket.scores.push(score);
    bucket.count++;
    bucket.totalDuration += r.durationMs;
    if (r.trustDecision === "auto-approved") bucket.approvedCount++;
    for (const f of flags) bucket.flags.push(f);
  }

  const agentRows: AgentEvalRow[] = [];
  let totalScoreSum = 0;
  let totalScoreN = 0;
  let totalApproved = 0;
  let totalSeen = 0;
  for (const [agentName, b] of perAgent.entries()) {
    const avgScore =
      b.scores.length === 0
        ? 0
        : b.scores.reduce((s, n) => s + n, 0) / b.scores.length;
    agentRows.push({
      agentName,
      samples: b.count,
      avgScore: Number(avgScore.toFixed(4)),
      autoApprovedRate:
        b.count === 0 ? 0 : Number((b.approvedCount / b.count).toFixed(4)),
      avgDurationMs: b.count === 0 ? 0 : Math.round(b.totalDuration / b.count),
      flags: b.flags.slice(0, 25),
    });
    totalScoreSum += avgScore * b.count;
    totalScoreN += b.count;
    totalApproved += b.approvedCount;
    totalSeen += b.count;
  }

  agentRows.sort((a, b) => a.avgScore - b.avgScore);

  return {
    generatedAt: new Date().toISOString(),
    windowDays: opts.windowDays ?? 7,
    totalRowsScored: rows.length,
    perAgent: agentRows,
    overall: {
      avgScore:
        totalScoreN === 0
          ? 0
          : Number((totalScoreSum / totalScoreN).toFixed(4)),
      autoApprovedRate:
        totalSeen === 0 ? 0 : Number((totalApproved / totalSeen).toFixed(4)),
    },
  };
}

/**
 * Pure regression detector — diff a current report against a prior
 * baseline. Returns the per-agent rows where the score dropped >
 * thresholdPct.
 */
export function detectRegressions(
  current: EvalReport,
  baseline: EvalReport,
  thresholdPct: number = 5,
): EvalRegression[] {
  const baseMap = new Map(
    baseline.perAgent.map((a) => [a.agentName, a.avgScore]),
  );
  const out: EvalRegression[] = [];
  for (const a of current.perAgent) {
    const base = baseMap.get(a.agentName);
    if (base == null || base === 0) continue;
    const delta = a.avgScore - base;
    const pctDrop = ((base - a.avgScore) / base) * 100;
    if (pctDrop >= thresholdPct) {
      out.push({
        agentName: a.agentName,
        baselineScore: base,
        currentScore: a.avgScore,
        delta: Number(delta.toFixed(4)),
        pctDrop: Number(pctDrop.toFixed(2)),
      });
    }
  }
  return out.sort((a, b) => b.pctDrop - a.pctDrop);
}

/**
 * Live query — pulls `samplesPerAgent` recent rows per agent, then
 * scores. Returns empty shape on missing-table.
 */
export async function computeEvalReport(
  opts: {
    windowDays?: number;
    samplesPerAgent?: number;
    judge?: Judge;
    agentFilter?: string;
  } = {},
): Promise<EvalReport> {
  const windowDays = opts.windowDays ?? 7;
  const samplesPerAgent = Math.max(
    1,
    Math.min(opts.samplesPerAgent ?? 20, 100),
  );
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  try {
    // Pull a bounded sample. Drizzle doesn't natively expose ROW_NUMBER
    // window functions, so we pull a flat batch and group in JS — fine
    // for the windowDays sizes we care about (1k-10k rows).
    const conds = [gt(agentRuns.createdAt, since)];
    if (opts.agentFilter) conds.push(eq(agentRuns.agentName, opts.agentFilter));

    const raw = await db
      .select({
        id: agentRuns.id,
        agentName: agentRuns.agentName,
        modelUsed: agentRuns.modelUsed,
        inputJson: agentRuns.inputJson,
        outputJson: agentRuns.outputJson,
        trustDecision: agentRuns.trustDecision,
        durationMs: agentRuns.durationMs,
        createdAt: agentRuns.createdAt,
      })
      .from(agentRuns)
      .where(and(...conds))
      .orderBy(desc(agentRuns.createdAt))
      .limit(50_000);

    // Cap per-agent to keep the eval bounded
    const perAgentSamples = new Map<string, EvalSampleRow[]>();
    for (const r of raw) {
      const bucket = perAgentSamples.get(r.agentName);
      if (!bucket) {
        perAgentSamples.set(r.agentName, [r as EvalSampleRow]);
      } else if (bucket.length < samplesPerAgent) {
        bucket.push(r as EvalSampleRow);
      }
    }
    const sampled = [...perAgentSamples.values()].flat();
    return aggregateEvalScores(sampled, { windowDays, judge: opts.judge });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      log.warn("agent_runs table missing — empty eval report");
      return {
        generatedAt: new Date().toISOString(),
        windowDays,
        totalRowsScored: 0,
        perAgent: [],
        overall: { avgScore: 0, autoApprovedRate: 0 },
      };
    }
    log.warn("computeEvalReport failed", { error: String(err) });
    throw err;
  }
}
