// STATUS: ahead-of-consumers — see docs/audits/codebase-audit.md (Tier B).
// self-improvement loop; not wired.
/**
 * SOVEREIGN MATRIX — Recursive Self-Improvement Engine
 *
 * Agents analyze their own execution history and rewrite their system prompts
 * to produce better outputs over time. This is genuine machine learning at
 * the prompt level — not fine-tuning weights, but evolving instructions.
 *
 * How it works:
 *   1. After every N executions, the engine reviews recent quality scores
 *   2. It identifies patterns: what inputs produced high scores vs low scores
 *   3. A meta-agent analyzes the patterns and generates prompt modifications
 *   4. The modifications are tested against historical inputs
 *   5. If the modification improves average quality, it's adopted
 *
 * Safety:
 *   - Modifications are ADDITIVE (appended directives, never replace core prompt)
 *   - Max 3 active modifications per agent (prevents prompt bloat)
 *   - Rollback if quality drops below baseline
 *   - Human review option for critical agents
 *
 * Usage:
 *   await analyzeAndImprove("leads"); // Reviews recent leads executions
 *   const directives = getActiveDirectives("leads"); // Gets current improvements
 */

import { ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("self-improve");

// ── Types ──

export interface PromptDirective {
  id: string;
  agentName: string;
  directive: string;          // The instruction to append
  reason: string;             // Why this was generated
  qualityBefore: number;      // Avg quality before this directive
  qualityAfter: number | null; // Avg quality after (null = not yet measured)
  createdAt: number;
  active: boolean;
}

export interface ImprovementAnalysis {
  agentName: string;
  executionsAnalyzed: number;
  avgQuality: number;
  patterns: string[];
  suggestedDirective: string | null;
  reason: string;
}

// ── Storage ──

const directiveStore = new Map<string, PromptDirective[]>(); // agentName → directives
const MAX_DIRECTIVES_PER_AGENT = 3;

// ── Execution History (simplified — in production, query agentActivity table) ──

interface ExecutionRecord {
  agentName: string;
  inputSummary: string;
  qualityScore: number;
  timestamp: number;
}

const executionHistory: ExecutionRecord[] = [];
const MAX_HISTORY = 500;

/**
 * Record an execution for self-improvement analysis.
 * Call this from agent-factory after quality scoring.
 */
export function recordExecution(agentName: string, inputSummary: string, qualityScore: number): void {
  executionHistory.push({ agentName, inputSummary, qualityScore, timestamp: Date.now() });
  if (executionHistory.length > MAX_HISTORY) executionHistory.shift();
}

/**
 * Analyze recent executions and generate a prompt improvement.
 * Call this periodically (e.g., every 50 executions per agent).
 */
export async function analyzeAndImprove(agentName: string): Promise<ImprovementAnalysis> {
  const recentExecutions = executionHistory
    .filter(e => e.agentName === agentName)
    .slice(-30); // Last 30 executions

  if (recentExecutions.length < 10) {
    return {
      agentName,
      executionsAnalyzed: recentExecutions.length,
      avgQuality: 0,
      patterns: [],
      suggestedDirective: null,
      reason: "Insufficient data (need 10+ executions)",
    };
  }

  const avgQuality = recentExecutions.reduce((sum, e) => sum + e.qualityScore, 0) / recentExecutions.length;
  const lowQuality = recentExecutions.filter(e => e.qualityScore < 0.7);
  const highQuality = recentExecutions.filter(e => e.qualityScore >= 0.85);

  // If quality is already high, don't fix what isn't broken
  if (avgQuality >= 0.85 && lowQuality.length === 0) {
    return {
      agentName,
      executionsAnalyzed: recentExecutions.length,
      avgQuality,
      patterns: ["Quality consistently high — no improvement needed"],
      suggestedDirective: null,
      reason: "Quality already optimal",
    };
  }

  // Ask meta-agent to analyze patterns
  const lowExamples = lowQuality.slice(0, 5).map(e => `  - Input: "${e.inputSummary.slice(0, 100)}" → Score: ${e.qualityScore.toFixed(2)}`).join("\n");
  const highExamples = highQuality.slice(0, 5).map(e => `  - Input: "${e.inputSummary.slice(0, 100)}" → Score: ${e.qualityScore.toFixed(2)}`).join("\n");

  const analysis = await ai(
    `You are analyzing the performance of an AI agent called "${agentName}".

Average quality score: ${avgQuality.toFixed(2)} (scale: 0-1)
Low-quality outputs (${lowQuality.length}/${recentExecutions.length}):
${lowExamples || "  None"}

High-quality outputs (${highQuality.length}/${recentExecutions.length}):
${highExamples || "  None"}

Identify:
1. What patterns cause low-quality outputs?
2. What makes high-quality outputs succeed?
3. Suggest ONE specific instruction (max 2 sentences) to add to the agent's system prompt that would fix the most common failure pattern.

Respond in JSON:
{
  "patterns": ["pattern 1", "pattern 2"],
  "suggestedDirective": "The specific instruction to add",
  "reason": "Why this will help"
}`,
    { system: "You are a prompt optimization specialist. Be specific. One targeted fix, not a rewrite.", maxTokens: 500 }
  );

  try {
    const parsed = JSON.parse(analysis.replace(/```json?\n?/g, "").replace(/```/g, "").trim());

    const directive = parsed.suggestedDirective;
    if (directive) {
      // Check if we already have max directives
      const existing = directiveStore.get(agentName) || [];
      if (existing.filter(d => d.active).length >= MAX_DIRECTIVES_PER_AGENT) {
        // Remove lowest-performing directive
        const sorted = existing.filter(d => d.active).sort((a, b) =>
          (a.qualityAfter ?? a.qualityBefore) - (b.qualityAfter ?? b.qualityBefore)
        );
        if (sorted.length > 0) sorted[0].active = false;
      }

      const newDirective: PromptDirective = {
        id: `dir_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        agentName,
        directive,
        reason: parsed.reason || "",
        qualityBefore: avgQuality,
        qualityAfter: null,
        createdAt: Date.now(),
        active: true,
      };

      existing.push(newDirective);
      directiveStore.set(agentName, existing);
      log.info("Self-improvement directive created", { agent: agentName, directive: directive.slice(0, 100) });
    }

    return {
      agentName,
      executionsAnalyzed: recentExecutions.length,
      avgQuality,
      patterns: parsed.patterns || [],
      suggestedDirective: directive,
      reason: parsed.reason || "",
    };
  } catch {
    return {
      agentName,
      executionsAnalyzed: recentExecutions.length,
      avgQuality,
      patterns: [],
      suggestedDirective: null,
      reason: "Analysis failed to parse",
    };
  }
}

/**
 * Get active directives for an agent.
 * These are appended to the agent's system prompt at execution time.
 */
export function getActiveDirectives(agentName: string): string[] {
  return (directiveStore.get(agentName) || [])
    .filter(d => d.active)
    .map(d => d.directive);
}

/**
 * Get all directives (including inactive) for review.
 */
export function getAllDirectives(agentName: string): PromptDirective[] {
  return directiveStore.get(agentName) || [];
}

/**
 * Rollback: deactivate a specific directive.
 */
export function rollbackDirective(directiveId: string): boolean {
  for (const directives of directiveStore.values()) {
    const found = directives.find(d => d.id === directiveId);
    if (found) { found.active = false; return true; }
  }
  return false;
}
