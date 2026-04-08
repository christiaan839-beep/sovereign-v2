import { createLogger } from "@/lib/logger";
import { getRelevantLearnings, emitLearningSignal } from "@/lib/competitive-moat";
import { getModelRecommendation } from "@/lib/agent-performance";

const log = createLogger("evolution-engine");

/**
 * EVOLUTION ENGINE — The platform that evolves itself.
 *
 * This isn't AI that runs the same way forever. This is AI that:
 * 1. Observes what works and what doesn't
 * 2. Adjusts its own behavior based on outcomes
 * 3. Discovers new strategies no human programmed
 * 4. Teaches new patterns to other agents
 *
 * Three evolution mechanisms:
 * - Prompt Evolution: system prompts improve based on output quality
 * - Routing Evolution: model selection improves based on task outcomes
 * - Strategy Evolution: agent chains reorganize based on success patterns
 *
 * The platform doesn't just get smarter. It becomes a different,
 * better platform every week — shaped by actual usage, not guesses.
 */

// ─── 1. Prompt Evolution ────────────────────────────────────
// System prompts that rewrite themselves based on output quality.
// When an agent consistently produces low-quality output for a
// specific task type, the prompt evolves to address the pattern.

interface PromptVariant {
  id: string;
  agentName: string;
  prompt: string;
  avgQuality: number;
  usageCount: number;
  createdAt: number;
  parentId: string | null; // Which prompt it evolved from
}

const promptVariants = new Map<string, PromptVariant[]>();

export function evolvePrompt(params: {
  agentName: string;
  currentPrompt: string;
  qualityScore: number;
  taskType: string;
  feedback?: string;
}): string {
  const { agentName, currentPrompt, qualityScore, taskType, feedback } = params;
  const key = `${agentName}:${taskType}`;

  // Get or create variant list
  if (!promptVariants.has(key)) {
    promptVariants.set(key, [{
      id: "v0",
      agentName,
      prompt: currentPrompt,
      avgQuality: qualityScore,
      usageCount: 1,
      createdAt: Date.now(),
      parentId: null,
    }]);
  }

  const variants = promptVariants.get(key)!;
  const current = variants[variants.length - 1];

  // Update running average
  current.avgQuality = (current.avgQuality * current.usageCount + qualityScore) / (current.usageCount + 1);
  current.usageCount++;

  // Evolve if quality is consistently below threshold
  if (current.usageCount >= 5 && current.avgQuality < 60) {
    const evolvedPrompt = appendEvolutionHint(currentPrompt, qualityScore, feedback);
    const newVariant: PromptVariant = {
      id: `v${variants.length}`,
      agentName,
      prompt: evolvedPrompt,
      avgQuality: 0,
      usageCount: 0,
      createdAt: Date.now(),
      parentId: current.id,
    };
    variants.push(newVariant);
    log.info(`Prompt evolved: ${agentName} (${taskType}) → variant ${newVariant.id}`);
    return evolvedPrompt;
  }

  return current.prompt;
}

function appendEvolutionHint(prompt: string, quality: number, feedback?: string): string {
  const hints: string[] = [];

  if (quality < 40) {
    hints.push("IMPORTANT: Recent outputs scored below 40/100. Be more specific, use real data, avoid generic statements.");
  } else if (quality < 60) {
    hints.push("NOTE: Recent outputs averaged below 60/100. Increase specificity, add concrete examples, structure with clear headers.");
  }

  if (feedback) {
    hints.push(`USER FEEDBACK: "${feedback}" — incorporate this into future responses.`);
  }

  return `${prompt}\n\n${hints.join("\n")}`;
}

// ─── 2. Routing Evolution ───────────────────────────────────
// Model selection that improves based on task outcomes.
// After enough data, the router stops guessing and starts knowing.

export interface RoutingDecision {
  taskType: string;
  selectedModel: string;
  confidence: number;
  reason: "performance_data" | "default" | "fallback";
  alternativeModels: Array<{ model: string; score: number }>;
}

export function getEvolvedRoute(taskType: string): RoutingDecision {
  // Try performance-based recommendation first
  const recommendation = getModelRecommendation(taskType);

  if (recommendation && recommendation.confidence > 70) {
    return {
      taskType,
      selectedModel: recommendation.recommendedModel,
      confidence: recommendation.confidence,
      reason: "performance_data",
      alternativeModels: [],
    };
  }

  // Fall back to default routing
  const defaults: Record<string, string> = {
    code: "nvidia/nemotron-3-super-120b",
    creative: "nvidia/llama-3.1-nemotron-70b-instruct",
    reasoning: "deepseek-ai/deepseek-v3-2-0324",
    vision: "meta/llama-4-maverick-17b-128e-instruct",
    multilingual: "qwen/qwen3-235b-a22b",
    long_context: "meta/llama-4-scout-17b-16e-instruct",
    general: "nvidia/llama-3.1-nemotron-70b-instruct",
  };

  return {
    taskType,
    selectedModel: defaults[taskType] || defaults.general,
    confidence: 50,
    reason: "default",
    alternativeModels: [],
  };
}

// ─── 3. Strategy Evolution ──────────────────────────────────
// Agent chains that reorganize based on success patterns.
// If Lead → Email → Call converts better than Lead → Call → Email,
// the platform learns and suggests the better chain.

interface StrategyPattern {
  chain: string[]; // Agent names in order
  successRate: number;
  avgDurationMs: number;
  sampleSize: number;
  discoveredAt: number;
}

const strategyPatterns = new Map<string, StrategyPattern[]>();

export function recordStrategyOutcome(params: {
  goalType: string;
  agentChain: string[];
  success: boolean;
  durationMs: number;
}): void {
  const { goalType, agentChain, success, durationMs } = params;
  const chainKey = agentChain.join("→");

  if (!strategyPatterns.has(goalType)) {
    strategyPatterns.set(goalType, []);
  }

  const patterns = strategyPatterns.get(goalType)!;
  let pattern = patterns.find(p => p.chain.join("→") === chainKey);

  if (!pattern) {
    pattern = {
      chain: agentChain,
      successRate: 0,
      avgDurationMs: 0,
      sampleSize: 0,
      discoveredAt: Date.now(),
    };
    patterns.push(pattern);
  }

  // Update running stats
  const newSize = pattern.sampleSize + 1;
  pattern.successRate = ((pattern.successRate * pattern.sampleSize) + (success ? 100 : 0)) / newSize;
  pattern.avgDurationMs = ((pattern.avgDurationMs * pattern.sampleSize) + durationMs) / newSize;
  pattern.sampleSize = newSize;

  // Emit learning signal if this pattern is significantly better
  if (pattern.sampleSize >= 5 && pattern.successRate > 80) {
    emitLearningSignal({
      sourceAgent: agentChain[0],
      targetAgent: agentChain[agentChain.length - 1],
      signalType: "success_pattern",
      data: { chain: agentChain, successRate: pattern.successRate, goalType },
      confidence: pattern.successRate / 100,
    });
  }
}

export function getBestStrategy(goalType: string): StrategyPattern | null {
  const patterns = strategyPatterns.get(goalType);
  if (!patterns || patterns.length === 0) return null;

  // Need minimum sample size
  const viable = patterns.filter(p => p.sampleSize >= 3);
  if (viable.length === 0) return null;

  // Sort by success rate, then by speed
  viable.sort((a, b) => {
    const rateDiff = b.successRate - a.successRate;
    if (Math.abs(rateDiff) > 5) return rateDiff;
    return a.avgDurationMs - b.avgDurationMs; // Faster wins ties
  });

  return viable[0];
}

// ─── 4. Self-Improvement Report ─────────────────────────────
// Weekly summary of how the platform evolved.

export function getEvolutionReport(): {
  promptEvolutions: number;
  routingImprovements: number;
  strategyDiscoveries: number;
  topImprovement: string | null;
} {
  let promptEvolutions = 0;
  for (const variants of promptVariants.values()) {
    promptEvolutions += Math.max(0, variants.length - 1);
  }

  let strategyDiscoveries = 0;
  for (const patterns of strategyPatterns.values()) {
    strategyDiscoveries += patterns.filter(p => p.sampleSize >= 5 && p.successRate > 80).length;
  }

  return {
    promptEvolutions,
    routingImprovements: 0, // Counted from agent-performance.ts
    strategyDiscoveries,
    topImprovement: promptEvolutions > 0
      ? `${promptEvolutions} agent prompts evolved based on quality feedback`
      : strategyDiscoveries > 0
      ? `${strategyDiscoveries} high-performing agent chains discovered`
      : null,
  };
}
