/**
 * SOVEREIGN MATRIX — Extended performance metrics (Wave 116 M8).
 *
 * Why this exists:
 *   `status-metrics.ts` (wave 15) gives p50/p95/p99 + success-rate at the
 *   global level. BACKLOG M8 wanted measurable per-agent + per-model
 *   breakdowns + trust-decision distribution to replace "trust us"
 *   marketing claims with reproducible numbers.
 *
 * This module reads the same `agent_runs` table the status-metrics
 * module uses — every signed agent execution lands there — and computes:
 *
 *   1. Per-agent top-N (by volume, by p95 latency).
 *   2. Per-model distribution (% of runs by model_used) + avg latency.
 *   3. Trust-decision distribution (auto-approved / needs-approval / blocked).
 *   4. Estimated cost savings vs an all-Claude-Sonnet baseline.
 *
 * Pure-read; no instrumentation needed because every wave-1 onwards
 * agent execution already writes the receipt. 30-second cache.
 */

import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { gt } from "drizzle-orm";

export type Window = "24h" | "7d" | "30d";

const WINDOW_MS: Record<Window, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

// Approximate per-million-token costs for the rough savings estimate.
// These are USD per 1M tokens INPUT (output cost varies; we use the
// input price as a single-figure approximation since average output
// length is bounded by maxTokens).
const APPROX_COST_PER_M_TOKENS: Record<string, number> = {
  "claude-opus": 15.0,
  "claude-sonnet": 3.0,
  "gemini-pro": 1.25,
  "gemini-flash": 0.075,
  cerebras: 0.1,
  "mistral-large": 2.0,
  "ollama-local": 0.0,
  "nvidia-nim-default": 0.0,
  "nvidia-nim-fallback": 0.0,
  "groq-llama": 0.59,
  "groq-mixtral": 0.27,
};
const BASELINE_COST = APPROX_COST_PER_M_TOKENS["claude-sonnet"] ?? 3.0;
const TOKENS_PER_AVG_RUN = 4000; // rough average — input + output

export interface AgentRowMetric {
  agentName: string;
  count: number;
  p50Ms: number | null;
  p95Ms: number | null;
  successRate: number;
}

export interface ModelDistribution {
  model: string;
  count: number;
  share: number;
  avgLatencyMs: number;
  /** Estimated USD cost for the runs attributed to this model in the window. */
  estimatedCostUsd: number;
}

export interface TrustDecisionDistribution {
  decision: string;
  count: number;
  share: number;
}

export interface ExtendedMetrics {
  window: Window;
  generatedAt: string;
  totalRuns: number;
  /** Sorted by p95 desc — the agents most likely to be a perf complaint. */
  slowestAgents: AgentRowMetric[];
  /** Sorted by count desc — the agents driving the most volume. */
  busiestAgents: AgentRowMetric[];
  models: ModelDistribution[];
  trustDecisions: TrustDecisionDistribution[];
  /** Per-window cost savings estimate vs the always-Claude-Sonnet baseline. */
  costSavings: {
    actualUsd: number;
    baselineUsd: number;
    savedUsd: number;
    savedPct: number;
  };
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];
  const idx = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length),
  );
  return sorted[idx];
}

interface RunRow {
  agentName: string;
  modelUsed: string;
  durationMs: number;
  trustDecision: string;
}

export function aggregateExtended(
  rows: RunRow[],
  window: Window,
): ExtendedMetrics {
  // ─── Per-agent breakdown ──────────────────────────────────────────────
  const perAgent = new Map<
    string,
    { count: number; latencies: number[]; successes: number }
  >();
  for (const r of rows) {
    let bucket = perAgent.get(r.agentName);
    if (!bucket) {
      bucket = { count: 0, latencies: [], successes: 0 };
      perAgent.set(r.agentName, bucket);
    }
    bucket.count++;
    bucket.latencies.push(r.durationMs);
    if (r.trustDecision !== "blocked") bucket.successes++;
  }
  const agentRows: AgentRowMetric[] = [...perAgent.entries()].map(
    ([agentName, b]) => {
      const sorted = b.latencies.slice().sort((a, c) => a - c);
      return {
        agentName,
        count: b.count,
        p50Ms: percentile(sorted, 50),
        p95Ms: percentile(sorted, 95),
        successRate: b.count === 0 ? 1 : b.successes / b.count,
      };
    },
  );

  // ─── Per-model distribution + cost ────────────────────────────────────
  const perModel = new Map<string, { count: number; totalLatency: number }>();
  for (const r of rows) {
    let bucket = perModel.get(r.modelUsed);
    if (!bucket) {
      bucket = { count: 0, totalLatency: 0 };
      perModel.set(r.modelUsed, bucket);
    }
    bucket.count++;
    bucket.totalLatency += r.durationMs;
  }
  const total = rows.length;
  const models: ModelDistribution[] = [...perModel.entries()]
    .map(([model, b]) => {
      const costPerM = APPROX_COST_PER_M_TOKENS[model] ?? BASELINE_COST;
      const tokens = (b.count * TOKENS_PER_AVG_RUN) / 1_000_000;
      return {
        model,
        count: b.count,
        share: total === 0 ? 0 : b.count / total,
        avgLatencyMs: b.count === 0 ? 0 : Math.round(b.totalLatency / b.count),
        estimatedCostUsd: Number((tokens * costPerM).toFixed(4)),
      };
    })
    .sort((a, b) => b.count - a.count);

  // ─── Trust-decision distribution ──────────────────────────────────────
  const perDecision = new Map<string, number>();
  for (const r of rows) {
    perDecision.set(
      r.trustDecision,
      (perDecision.get(r.trustDecision) ?? 0) + 1,
    );
  }
  const trustDecisions: TrustDecisionDistribution[] = [...perDecision.entries()]
    .map(([decision, count]) => ({
      decision,
      count,
      share: total === 0 ? 0 : count / total,
    }))
    .sort((a, b) => b.count - a.count);

  // ─── Cost-savings estimate ────────────────────────────────────────────
  const actualUsd = models.reduce((sum, m) => sum + m.estimatedCostUsd, 0);
  const baselineUsd = Number(
    ((total * TOKENS_PER_AVG_RUN * BASELINE_COST) / 1_000_000).toFixed(4),
  );
  const savedUsd = Math.max(0, Number((baselineUsd - actualUsd).toFixed(4)));
  const savedPct = baselineUsd === 0 ? 0 : savedUsd / baselineUsd;

  return {
    window,
    generatedAt: new Date().toISOString(),
    totalRuns: total,
    slowestAgents: agentRows
      .slice()
      .sort((a, b) => (b.p95Ms ?? 0) - (a.p95Ms ?? 0))
      .slice(0, 10),
    busiestAgents: agentRows
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    models,
    trustDecisions,
    costSavings: {
      actualUsd,
      baselineUsd,
      savedUsd,
      savedPct: Number(savedPct.toFixed(4)),
    },
  };
}

/**
 * Live query. Returns a degraded (count=0) report when the agent_runs
 * table doesn't exist yet (fresh deploy without migrations applied).
 */
export async function computeExtendedMetrics(
  window: Window = "24h",
): Promise<ExtendedMetrics> {
  const since = new Date(Date.now() - WINDOW_MS[window]);
  try {
    const rows = await db
      .select({
        agentName: agentRuns.agentName,
        modelUsed: agentRuns.modelUsed,
        durationMs: agentRuns.durationMs,
        trustDecision: agentRuns.trustDecision,
      })
      .from(agentRuns)
      .where(gt(agentRuns.createdAt, since));
    return aggregateExtended(rows, window);
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || /does not exist/.test(msg)) {
      // Table absent — return an empty-but-valid shape.
      return aggregateExtended([], window);
    }
    throw err;
  }
}
