import { createLogger } from "@/lib/logger";


/**
 * AGENT PERFORMANCE TRACKER — Learn which agents and models perform best.
 *
 * Every execution is scored on: speed, quality, user satisfaction.
 * Over time, this data feeds back into the smart router to make
 * better model selection decisions.
 *
 * This is the "compound intelligence" moat — the more the platform
 * is used, the better it gets at routing tasks to the right model.
 */

export interface PerformanceRecord {
  agentName: string;
  modelUsed: string;
  taskType: string;
  executionTimeMs: number;
  qualityScore: number; // 0-100 from output-verifier
  userFeedback?: "positive" | "negative" | null;
  tokenCount: number;
  timestamp: number;
  success: boolean;
}

// In-memory store (production: write to DB)
const performanceLog: PerformanceRecord[] = [];
const MAX_RECORDS = 10000;

export function recordPerformance(record: PerformanceRecord): void {
  performanceLog.push(record);
  if (performanceLog.length > MAX_RECORDS) {
    performanceLog.splice(0, performanceLog.length - MAX_RECORDS);
  }
}

// ─── Analytics ──────────────────────────────────────────────

export interface AgentStats {
  agentName: string;
  totalExecutions: number;
  avgExecutionTimeMs: number;
  avgQualityScore: number;
  successRate: number;
  positiveRate: number;
  mostUsedModel: string;
  bestModel: string; // Highest quality score
  fastestModel: string;
}

export function getAgentStats(agentName: string): AgentStats | null {
  const records = performanceLog.filter(r => r.agentName === agentName);
  if (records.length === 0) return null;

  const successful = records.filter(r => r.success);
  const withFeedback = records.filter(r => r.userFeedback);
  const positive = withFeedback.filter(r => r.userFeedback === "positive");

  // Find best model by quality
  const modelScores = new Map<string, { totalQuality: number; count: number; totalTime: number }>();
  for (const r of records) {
    const existing = modelScores.get(r.modelUsed) || { totalQuality: 0, count: 0, totalTime: 0 };
    existing.totalQuality += r.qualityScore;
    existing.totalTime += r.executionTimeMs;
    existing.count++;
    modelScores.set(r.modelUsed, existing);
  }

  let bestModel = "";
  let bestQuality = 0;
  let fastestModel = "";
  let fastestTime = Infinity;
  let mostUsedModel = "";
  let mostUsedCount = 0;

  for (const [model, stats] of modelScores) {
    const avgQuality = stats.totalQuality / stats.count;
    const avgTime = stats.totalTime / stats.count;

    if (avgQuality > bestQuality) { bestQuality = avgQuality; bestModel = model; }
    if (avgTime < fastestTime) { fastestTime = avgTime; fastestModel = model; }
    if (stats.count > mostUsedCount) { mostUsedCount = stats.count; mostUsedModel = model; }
  }

  return {
    agentName,
    totalExecutions: records.length,
    avgExecutionTimeMs: Math.round(records.reduce((s, r) => s + r.executionTimeMs, 0) / records.length),
    avgQualityScore: Math.round(records.reduce((s, r) => s + r.qualityScore, 0) / records.length * 10) / 10,
    successRate: Math.round((successful.length / records.length) * 1000) / 10,
    positiveRate: withFeedback.length > 0 ? Math.round((positive.length / withFeedback.length) * 1000) / 10 : 0,
    mostUsedModel,
    bestModel,
    fastestModel,
  };
}

// ─── Model Recommendations ──────────────────────────────────

export interface ModelRecommendation {
  taskType: string;
  recommendedModel: string;
  confidence: number;
  reason: string;
  basedOnExecutions: number;
}

export function getModelRecommendation(taskType: string): ModelRecommendation | null {
  const records = performanceLog.filter(r => r.taskType === taskType && r.success);
  if (records.length < 5) return null; // Need minimum data

  const modelScores = new Map<string, { quality: number; speed: number; count: number }>();
  for (const r of records) {
    const existing = modelScores.get(r.modelUsed) || { quality: 0, speed: 0, count: 0 };
    existing.quality += r.qualityScore;
    existing.speed += r.executionTimeMs;
    existing.count++;
    modelScores.set(r.modelUsed, existing);
  }

  let bestModel = "";
  let bestScore = 0;

  for (const [model, stats] of modelScores) {
    if (stats.count < 3) continue; // Need minimum samples per model
    const avgQuality = stats.quality / stats.count;
    const avgSpeed = stats.speed / stats.count;
    // Composite score: 70% quality + 30% speed (normalized)
    const speedScore = Math.max(0, 100 - avgSpeed / 50); // <5s = 0 penalty
    const composite = avgQuality * 0.7 + speedScore * 0.3;

    if (composite > bestScore) {
      bestScore = composite;
      bestModel = model;
    }
  }

  if (!bestModel) return null;

  const modelStats = modelScores.get(bestModel)!;
  return {
    taskType,
    recommendedModel: bestModel,
    confidence: Math.min(100, Math.round(bestScore)),
    reason: `Best quality/speed ratio across ${modelStats.count} executions (avg quality: ${Math.round(modelStats.quality / modelStats.count)})`,
    basedOnExecutions: records.length,
  };
}

// ─── Platform-Wide Stats ────────────────────────────────────

export function getPlatformStats() {
  const total = performanceLog.length;
  if (total === 0) {
    return { total: 0, avgQuality: 0, avgSpeed: 0, successRate: 0, topAgents: [], topModels: [] };
  }

  const successful = performanceLog.filter(r => r.success);

  // Top agents by execution count
  const agentCounts = new Map<string, number>();
  for (const r of performanceLog) {
    agentCounts.set(r.agentName, (agentCounts.get(r.agentName) || 0) + 1);
  }
  const topAgents = Array.from(agentCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Top models by usage
  const modelCounts = new Map<string, number>();
  for (const r of performanceLog) {
    modelCounts.set(r.modelUsed, (modelCounts.get(r.modelUsed) || 0) + 1);
  }
  const topModels = Array.from(modelCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    total,
    avgQuality: Math.round(performanceLog.reduce((s, r) => s + r.qualityScore, 0) / total * 10) / 10,
    avgSpeed: Math.round(performanceLog.reduce((s, r) => s + r.executionTimeMs, 0) / total),
    successRate: Math.round((successful.length / total) * 1000) / 10,
    topAgents,
    topModels,
  };
}
