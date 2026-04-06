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
 * Get the best model for a task type based on historical performance.
 * Returns null if insufficient data (falls back to static routing).
 */
export function getBestModelFor(taskType: string): string | null {
  const taskScores = taskModelScores.get(taskType);
  if (!taskScores || taskScores.size < 3) return null; // Need at least 3 models with data

  let bestModel = "";
  let bestScore = -1;

  for (const [modelId, score] of taskScores) {
    // Also factor in recent performance
    const perf = getModelPerformance(modelId);
    if (!perf || perf.executions < 5) continue; // Need at least 5 executions

    // Combined: 60% task affinity + 40% overall performance
    const combined = score * 0.6 + perf.compositeScore * 0.4;
    if (combined > bestScore) {
      bestScore = combined;
      bestModel = modelId;
    }
  }

  if (!bestModel) return null;
  log.info(`Model selection for ${taskType}: ${bestModel} (score: ${bestScore.toFixed(2)})`);
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
