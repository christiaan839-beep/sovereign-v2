/**
 * SOVEREIGN MATRIX — Model Performance Tracker
 *
 * Tracks per-model performance metrics (latency, success rate, quality scores)
 * to feed the smart router with data-driven model selection.
 *
 * Uses an in-memory rolling window (last 100 executions per model) for fast
 * reads. The underlying data also lives in agentActivity.metadata for
 * historical analysis.
 *
 * Usage:
 *   import { recordModelExecution, getModelPerformance, getBestModelFor } from "@/lib/model-tracker";
 *
 *   recordModelExecution("nvidia/nemotron-ultra-253b-v1", { latencyMs: 1200, success: true, quality: 0.85 });
 *   const best = getBestModelFor("content"); // returns model ID ranked by weighted score
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("model-tracker");

// ── Types ──

interface ModelExecution {
  latencyMs: number;
  success: boolean;
  quality: number | null; // 0-1 quality score, null if not scored
  timestamp: number;
}

interface ModelStats {
  executions: number;
  avgLatencyMs: number;
  successRate: number;
  avgQuality: number | null;
  /** Weighted composite score (0-1) — higher is better */
  compositeScore: number;
}

// ── Storage (in-memory rolling window) ──

const WINDOW_SIZE = 100; // Keep last 100 executions per model
const modelWindows = new Map<string, ModelExecution[]>();

// ── Task → Model affinity (learned from data) ──
const taskModelScores = new Map<string, Map<string, number>>(); // task → model → score

// ── Public API ──

/**
 * Record a model execution with performance data.
 * Call this from the AI router after every model call.
 */
export function recordModelExecution(
  modelId: string,
  data: { latencyMs: number; success: boolean; quality?: number | null; taskType?: string }
): void {
  const window = modelWindows.get(modelId) || [];
  window.push({
    latencyMs: data.latencyMs,
    success: data.success,
    quality: data.quality ?? null,
    timestamp: Date.now(),
  });

  // Trim to window size
  if (window.length > WINDOW_SIZE) {
    window.splice(0, window.length - WINDOW_SIZE);
  }
  modelWindows.set(modelId, window);

  // Update task affinity if task type provided
  if (data.taskType && data.success) {
    const taskScores = taskModelScores.get(data.taskType) || new Map();
    const current = taskScores.get(modelId) || 0;
    // Exponential moving average: 80% old score + 20% new score
    const newScore = data.quality ?? (data.success ? 0.7 : 0.3);
    taskScores.set(modelId, current * 0.8 + newScore * 0.2);
    taskModelScores.set(data.taskType, taskScores);
  }
}

/**
 * Get performance stats for a specific model.
 */
export function getModelPerformance(modelId: string): ModelStats | null {
  const window = modelWindows.get(modelId);
  if (!window || window.length === 0) return null;

  const totalLatency = window.reduce((sum, e) => sum + e.latencyMs, 0);
  const successes = window.filter((e) => e.success).length;
  const qualityScores = window.filter((e) => e.quality !== null).map((e) => e.quality!);
  const avgQuality = qualityScores.length > 0
    ? qualityScores.reduce((sum, q) => sum + q, 0) / qualityScores.length
    : null;

  const avgLatencyMs = Math.round(totalLatency / window.length);
  const successRate = successes / window.length;

  // Composite score: success 40% + quality 30% + speed 30%
  // Speed normalized: <1s = 1.0, >10s = 0.0
  const speedScore = Math.max(0, Math.min(1, 1 - (avgLatencyMs - 1000) / 9000));
  const qualityComponent = avgQuality ?? 0.5; // assume average if no data
  const compositeScore = successRate * 0.4 + qualityComponent * 0.3 + speedScore * 0.3;

  return {
    executions: window.length,
    avgLatencyMs,
    successRate: Math.round(successRate * 100) / 100,
    avgQuality: avgQuality !== null ? Math.round(avgQuality * 100) / 100 : null,
    compositeScore: Math.round(compositeScore * 100) / 100,
  };
}

/**
 * Thompson Sampling — RL-based model selection.
 *
 * Instead of always picking the "best" model (exploitation), Thompson Sampling
 * balances exploration vs exploitation by sampling from each model's Beta distribution.
 *
 * This means:
 * - Models with high success rates are picked more often (exploitation)
 * - Models with few executions get occasional chances (exploration)
 * - Over time, the system converges on the optimal model per task type
 *
 * This is how Google Ads and Netflix select content — proven at scale.
 */
function thompsonSample(successes: number, failures: number): number {
  // Beta distribution sampling approximation
  // Using the Jitter method: Beta(a, b) ≈ Gamma(a) / (Gamma(a) + Gamma(b))
  const a = successes + 1; // +1 prior (uniform)
  const b = failures + 1;

  // Box-Muller approximation for Gamma sampling
  function gammaSample(shape: number): number {
    if (shape < 1) return gammaSample(shape + 1) * Math.pow(Math.random(), 1 / shape);
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    let x: number, v: number;
    do {
      do {
        x = normalSample();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
    } while (Math.log(Math.random()) >= 0.5 * x * x + d - d * v + d * Math.log(v));
    return d * v;
  }

  function normalSample(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  const ga = gammaSample(a);
  const gb = gammaSample(b);
  return ga / (ga + gb);
}

/**
 * Get the best model for a task type using Thompson Sampling (RL).
 * Balances exploration (trying new models) and exploitation (using proven ones).
 * Returns null if insufficient data (falls back to static routing).
 */
export function getBestModelFor(taskType: string): string | null {
  const taskScores = taskModelScores.get(taskType);
  if (!taskScores || taskScores.size < 3) return null;

  let bestModel = "";
  let bestSample = -1;

  for (const [modelId] of taskScores) {
    const perf = getModelPerformance(modelId);
    if (!perf) continue;

    // Thompson Sampling: sample from Beta(successes+1, failures+1)
    const successes = Math.round(perf.successRate * perf.executions);
    const failures = perf.executions - successes;
    const sample = thompsonSample(successes, failures);

    // Boost by quality if available
    const qualityBoost = perf.avgQuality !== null ? perf.avgQuality * 0.3 : 0;
    const finalSample = sample * 0.7 + qualityBoost;

    if (finalSample > bestSample) {
      bestSample = finalSample;
      bestModel = modelId;
    }
  }

  if (!bestModel) return null;
  log.info(`Thompson sampling for ${taskType}: ${bestModel} (sample: ${bestSample.toFixed(3)})`);
  return bestModel;
}

/**
 * Get performance summary for all tracked models (for insights dashboard).
 */
export function getAllModelPerformance(): Array<{ modelId: string } & ModelStats> {
  const results: Array<{ modelId: string } & ModelStats> = [];
  for (const modelId of modelWindows.keys()) {
    const stats = getModelPerformance(modelId);
    if (stats) results.push({ modelId, ...stats });
  }
  return results.sort((a, b) => b.compositeScore - a.compositeScore);
}
