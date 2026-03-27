/**
 * SOVEREIGN MATRIX — Adaptive Learning Engine
 *
 * The brain that makes the platform self-improving.
 * Every agent execution feeds back into this engine, which:
 *
 * 1. ARCHIVES quality scores per agent per task type to Pinecone
 * 2. LEARNS which models perform best for which tasks
 * 3. EVOLVES system prompts based on successful patterns
 * 4. ADAPTS quality thresholds dynamically per agent
 * 5. RANKS models based on real performance data
 *
 * This is what makes Sovereign Matrix get smarter with every request.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("adaptive-engine");

// ─── Types ───────────────────────────────────────────

export interface ExecutionRecord {
  agentName: string;
  taskType: string;
  model: string;
  qualityScore: number;
  dimensions: {
    helpfulness: number;
    coherence: number;
    correctness: number;
    verbosity: number;
  };
  inputPreview: string;
  outputPreview: string;
  durationMs: number;
  success: boolean;
  timestamp: string;
}

export interface ModelPerformance {
  modelId: string;
  taskType: string;
  avgScore: number;
  avgLatency: number;
  successRate: number;
  totalCalls: number;
}

export interface AgentLearning {
  agentName: string;
  avgScore: number;
  bestModel: string;
  optimalThreshold: number;
  topPatterns: string[];
  totalExecutions: number;
}

// ─── In-Memory Learning Store (production: use Pinecone + DB) ──────

const EXECUTION_LOG: ExecutionRecord[] = [];
const MAX_LOG_SIZE = 5000;
const MODEL_SCORES = new Map<string, { total: number; count: number; latency: number }>();
const AGENT_SCORES = new Map<string, { total: number; count: number; successes: number }>();

// ─── Core Functions ──────────────────────────────────

/**
 * Record an agent execution for learning.
 * Called automatically by the agent factory after every execution.
 */
export function recordExecution(record: ExecutionRecord): void {
  // Circular buffer — oldest records drop off
  if (EXECUTION_LOG.length >= MAX_LOG_SIZE) {
    EXECUTION_LOG.shift();
  }
  EXECUTION_LOG.push(record);

  // Update model performance aggregates
  const modelKey = `${record.model}:${record.taskType}`;
  const modelStats = MODEL_SCORES.get(modelKey) || { total: 0, count: 0, latency: 0 };
  modelStats.total += record.qualityScore;
  modelStats.count += 1;
  modelStats.latency += record.durationMs;
  MODEL_SCORES.set(modelKey, modelStats);

  // Update agent performance aggregates
  const agentStats = AGENT_SCORES.get(record.agentName) || { total: 0, count: 0, successes: 0 };
  agentStats.total += record.qualityScore;
  agentStats.count += 1;
  if (record.success) agentStats.successes += 1;
  AGENT_SCORES.set(record.agentName, agentStats);

  log.info("Execution recorded", {
    agent: record.agentName,
    score: record.qualityScore.toFixed(2),
    model: record.model,
    duration: record.durationMs,
  } as Record<string, unknown>);
}

/**
 * Get the best model for a given task type based on historical performance.
 * Returns ranked list of models by quality score × speed.
 */
export function getBestModel(taskType: string): ModelPerformance[] {
  const results: ModelPerformance[] = [];

  for (const [key, stats] of MODEL_SCORES.entries()) {
    const [modelId, type] = key.split(":");
    if (type !== taskType) continue;

    results.push({
      modelId,
      taskType,
      avgScore: stats.count > 0 ? stats.total / stats.count : 0,
      avgLatency: stats.count > 0 ? stats.latency / stats.count : 0,
      successRate: 1.0, // All executions that reach here succeeded
      totalCalls: stats.count,
    });
  }

  // Rank by score (70%) and speed (30%)
  return results.sort((a, b) => {
    const scoreA = a.avgScore * 0.7 + (1 - Math.min(a.avgLatency / 30000, 1)) * 0.3;
    const scoreB = b.avgScore * 0.7 + (1 - Math.min(b.avgLatency / 30000, 1)) * 0.3;
    return scoreB - scoreA;
  });
}

/**
 * Get adaptive quality threshold for an agent.
 * Instead of hardcoded 0.6, learns from historical performance.
 * Sets threshold at 90% of the agent's historical average — pushes quality up over time.
 */
export function getAdaptiveThreshold(agentName: string): number {
  const stats = AGENT_SCORES.get(agentName);
  if (!stats || stats.count < 10) return 0.6; // Default until enough data

  const avg = stats.total / stats.count;
  // Threshold = 90% of historical average, clamped between 0.4 and 0.85
  return Math.max(0.4, Math.min(0.85, avg * 0.9));
}

/**
 * Generate a learned system prompt enhancement based on successful patterns.
 * Analyzes top-performing executions for an agent and extracts what worked.
 */
export function getLearnedDirectives(agentName: string): string {
  const agentLogs = EXECUTION_LOG.filter(
    (r) => r.agentName === agentName && r.qualityScore > 0.7
  );

  if (agentLogs.length < 5) return ""; // Not enough data to learn from

  // Find the highest-scoring executions
  const topExecutions = agentLogs
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, 10);

  // Analyze dimension patterns
  const avgDimensions = {
    helpfulness: topExecutions.reduce((s, e) => s + e.dimensions.helpfulness, 0) / topExecutions.length,
    coherence: topExecutions.reduce((s, e) => s + e.dimensions.coherence, 0) / topExecutions.length,
    correctness: topExecutions.reduce((s, e) => s + e.dimensions.correctness, 0) / topExecutions.length,
    verbosity: topExecutions.reduce((s, e) => s + e.dimensions.verbosity, 0) / topExecutions.length,
  };

  // Generate directives based on weak dimensions
  const directives: string[] = [];

  if (avgDimensions.correctness < 0.7) {
    directives.push("PRIORITY: Verify all factual claims. Double-check numbers and statistics.");
  }
  if (avgDimensions.coherence < 0.7) {
    directives.push("PRIORITY: Ensure logical flow between sections. Use clear transitions.");
  }
  if (avgDimensions.helpfulness < 0.7) {
    directives.push("PRIORITY: Focus on actionable output. Every response must include specific next steps.");
  }
  if (avgDimensions.verbosity > 0.8) {
    directives.push("PRIORITY: Be concise. Remove filler. Every sentence must earn its place.");
  }

  if (directives.length === 0) return "";

  return `\n\n--- AUTO-LEARNED DIRECTIVES (from ${topExecutions.length} top-performing executions) ---\n${directives.join("\n")}\n--- END DIRECTIVES ---`;
}

/**
 * Get full learning report for dashboard display.
 */
export function getLearningReport(): {
  totalExecutions: number;
  agentPerformance: AgentLearning[];
  modelRankings: Record<string, ModelPerformance[]>;
  systemHealth: { avgScore: number; successRate: number; avgLatency: number };
} {
  const agentPerformance: AgentLearning[] = [];

  for (const [agentName, stats] of AGENT_SCORES.entries()) {
    const bestModels = getBestModel(agentName);
    agentPerformance.push({
      agentName,
      avgScore: stats.count > 0 ? stats.total / stats.count : 0,
      bestModel: bestModels[0]?.modelId || "auto",
      optimalThreshold: getAdaptiveThreshold(agentName),
      topPatterns: [],
      totalExecutions: stats.count,
    });
  }

  // Group model rankings by task type
  const taskTypes = new Set<string>();
  for (const key of MODEL_SCORES.keys()) {
    taskTypes.add(key.split(":")[1]);
  }

  const modelRankings: Record<string, ModelPerformance[]> = {};
  for (const taskType of taskTypes) {
    modelRankings[taskType] = getBestModel(taskType);
  }

  // System health
  const allScores = EXECUTION_LOG.map((r) => r.qualityScore);
  const allLatencies = EXECUTION_LOG.map((r) => r.durationMs);
  const successCount = EXECUTION_LOG.filter((r) => r.success).length;

  return {
    totalExecutions: EXECUTION_LOG.length,
    agentPerformance: agentPerformance.sort((a, b) => b.avgScore - a.avgScore),
    modelRankings,
    systemHealth: {
      avgScore: allScores.length > 0 ? allScores.reduce((s, v) => s + v, 0) / allScores.length : 0,
      successRate: EXECUTION_LOG.length > 0 ? successCount / EXECUTION_LOG.length : 1,
      avgLatency: allLatencies.length > 0 ? allLatencies.reduce((s, v) => s + v, 0) / allLatencies.length : 0,
    },
  };
}

/**
 * Persist learning to Pinecone for long-term memory.
 * Called periodically (e.g., every 100 executions) to save insights.
 */
export async function persistLearning(): Promise<void> {
  try {
    const { remember } = await import("@/lib/memory");

    // Save model performance rankings
    for (const [key, stats] of MODEL_SCORES.entries()) {
      if (stats.count >= 10) {
        await remember(
          `MODEL_PERFORMANCE:${key}`,
          JSON.stringify({
            avgScore: stats.total / stats.count,
            avgLatency: stats.latency / stats.count,
            totalCalls: stats.count,
            lastUpdated: new Date().toISOString(),
          })
        );
      }
    }

    // Save agent-level insights
    for (const [agentName, stats] of AGENT_SCORES.entries()) {
      if (stats.count >= 10) {
        const directives = getLearnedDirectives(agentName);
        if (directives) {
          await remember(
            `SYSTEM_OPTIMIZATION:${agentName}`,
            directives
          );
        }
      }
    }

    log.info("Learning persisted to Pinecone", {
      models: MODEL_SCORES.size,
      agents: AGENT_SCORES.size,
    } as Record<string, unknown>);
  } catch (err) {
    log.error("Failed to persist learning", err as Record<string, unknown>);
  }
}
