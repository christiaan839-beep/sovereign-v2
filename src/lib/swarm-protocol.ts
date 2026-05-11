// STATUS: ahead-of-consumers — see docs/audits/codebase-audit.md (Tier B).
// "agent-to-agent economy" claim; not wired.
/**
 * SOVEREIGN MATRIX — Agent Swarm Protocol
 *
 * Executes multiple agents in parallel and synthesizes their results
 * using configurable consensus mechanisms.
 *
 * This is NOT sequential chaining (that's playbooks).
 * This is PARALLEL execution where multiple agents attack the same
 * problem simultaneously, and a consensus layer merges their outputs.
 *
 * Consensus modes:
 *   - "best"     — Pick the highest-quality output (fastest)
 *   - "merge"    — LLM synthesizes all outputs into one (most thorough)
 *   - "vote"     — Majority agreement on key facts (most accurate)
 *   - "debate"   — Adversarial synthesis (highest quality, slowest)
 *
 * Usage:
 *   const result = await executeSwarm({
 *     goal: "Analyze competitor.com",
 *     agents: ["seo-dominator", "competitor-scan", "site-assassin"],
 *     consensus: "merge",
 *   });
 */

import { ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("swarm-protocol");

// ── Types ──

export type ConsensusMode = "best" | "merge" | "vote" | "debate";

interface SwarmAgent {
  name: string;
  params?: Record<string, unknown>;
}

interface AgentOutput {
  agent: string;
  output: string;
  quality: number; // 0-1
  durationMs: number;
  success: boolean;
  error?: string;
}

interface SwarmResult {
  goal: string;
  consensus: ConsensusMode;
  finalOutput: string;
  confidence: number;
  agentOutputs: AgentOutput[];
  totalDurationMs: number;
  agentsSucceeded: number;
  agentsFailed: number;
}

interface SwarmOptions {
  goal: string;
  agents: SwarmAgent[] | string[];
  consensus?: ConsensusMode;
  timeoutMs?: number;
  minAgentsRequired?: number;
}

// ── Execute Single Agent ──

async function runAgent(agent: SwarmAgent, goal: string, baseUrl: string): Promise<AgentOutput> {
  const start = Date.now();
  try {
    const res = await fetch(`${baseUrl}/api/agents/${agent.name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Sovereign-Internal": "swarm-protocol" },
      body: JSON.stringify({ prompt: goal, confirmed: true, ...agent.params }),
      signal: AbortSignal.timeout(45000),
    });

    const data = await res.json();
    const output = typeof data.output === "string" ? data.output
      : typeof data.result === "string" ? data.result
      : JSON.stringify(data).slice(0, 3000);

    return {
      agent: agent.name,
      output,
      quality: data._meta?.qualityScore || 0.7,
      durationMs: Date.now() - start,
      success: res.ok,
      error: res.ok ? undefined : data.error,
    };
  } catch (err) {
    return {
      agent: agent.name,
      output: "",
      quality: 0,
      durationMs: Date.now() - start,
      success: false,
      error: err instanceof Error ? err.message : "Agent failed",
    };
  }
}

// ── Consensus Functions ──

async function consensusBest(outputs: AgentOutput[]): Promise<{ output: string; confidence: number }> {
  const best = outputs.sort((a, b) => b.quality - a.quality)[0];
  return { output: best.output, confidence: best.quality };
}

async function consensusMerge(goal: string, outputs: AgentOutput[]): Promise<{ output: string; confidence: number }> {
  const combined = outputs.map((o, i) =>
    `--- Agent ${i + 1}: ${o.agent} (quality: ${o.quality.toFixed(2)}) ---\n${o.output.slice(0, 1500)}`
  ).join("\n\n");

  const merged = await ai(
    `Multiple AI agents worked on the same goal in parallel. Merge their outputs into ONE comprehensive result that keeps the best insights from each.

GOAL: ${goal}

AGENT OUTPUTS:
${combined}

Produce a single, unified response. Resolve any contradictions by favoring higher-quality sources. Include everything that's unique and valuable.`,
    { system: "You are a synthesis specialist. Merge parallel outputs without losing information.", maxTokens: 3000 }
  );

  const avgQuality = outputs.reduce((sum, o) => sum + o.quality, 0) / outputs.length;
  return { output: merged, confidence: Math.min(1, avgQuality + 0.1) }; // Merge bonus
}

async function consensusVote(goal: string, outputs: AgentOutput[]): Promise<{ output: string; confidence: number }> {
  const votePrompt = outputs.map((o, i) =>
    `Option ${i + 1} (${o.agent}): ${o.output.slice(0, 800)}`
  ).join("\n\n");

  const vote = await ai(
    `Multiple agents produced different answers to: "${goal}"

${votePrompt}

Identify the key FACTS that appear in 2+ outputs (majority agreement). List them clearly. Then produce a final answer using ONLY majority-agreed facts.

Respond: {"agreedFacts": ["fact1", "fact2"], "finalAnswer": "...", "agreement": 0.85}`,
    { system: "You are a fact-checker. Only include claims that multiple sources agree on.", maxTokens: 2000 }
  );

  try {
    const parsed = JSON.parse(vote.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    return { output: parsed.finalAnswer || vote, confidence: parsed.agreement || 0.7 };
  } catch {
    return { output: vote, confidence: 0.7 };
  }
}

// ── Main Swarm Execution ──

export async function executeSwarm(options: SwarmOptions): Promise<SwarmResult> {
  const {
    goal,
    agents: rawAgents,
    consensus = "merge",
    timeoutMs = 60000,
    minAgentsRequired = 1,
  } = options;

  const startTime = Date.now();

  // Normalize agent list
  const agents: SwarmAgent[] = rawAgents.map(a =>
    typeof a === "string" ? { name: a } : a
  );

  log.info("Swarm started", { goal: goal.slice(0, 100), agents: agents.map(a => a.name), consensus });

  // Determine base URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Execute all agents in parallel
  const results = await Promise.all(
    agents.map(agent => runAgent(agent, goal, baseUrl))
  );

  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  if (succeeded.length < minAgentsRequired) {
    return {
      goal,
      consensus,
      finalOutput: `Swarm failed: only ${succeeded.length}/${agents.length} agents succeeded (need ${minAgentsRequired})`,
      confidence: 0,
      agentOutputs: results,
      totalDurationMs: Date.now() - startTime,
      agentsSucceeded: succeeded.length,
      agentsFailed: failed.length,
    };
  }

  // Apply consensus
  let finalOutput = "";
  let confidence = 0;

  switch (consensus) {
    case "best":
      ({ output: finalOutput, confidence } = await consensusBest(succeeded));
      break;
    case "merge":
      ({ output: finalOutput, confidence } = await consensusMerge(goal, succeeded));
      break;
    case "vote":
      ({ output: finalOutput, confidence } = await consensusVote(goal, succeeded));
      break;
    case "debate": {
      // Use the adversarial synthesis engine
      const { adversarialSynthesis } = await import("@/lib/adversarial-synthesis");
      const debate = await adversarialSynthesis({ task: goal, context: succeeded.map(o => o.output).join("\n---\n") });
      finalOutput = debate.output;
      confidence = debate.confidence;
      break;
    }
  }

  log.info("Swarm completed", {
    goal: goal.slice(0, 50),
    consensus,
    succeeded: succeeded.length,
    failed: failed.length,
    confidence,
    durationMs: Date.now() - startTime,
  });

  return {
    goal,
    consensus,
    finalOutput,
    confidence,
    agentOutputs: results,
    totalDurationMs: Date.now() - startTime,
    agentsSucceeded: succeeded.length,
    agentsFailed: failed.length,
  };
}
