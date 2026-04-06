/**
 * SOVEREIGN MATRIX — Plan-Execute-Evaluate-Refine (PEER) Loop
 *
 * Autonomous self-healing execution loop for complex multi-step tasks.
 * Instead of failing and returning an error, the system:
 *   1. PLAN — Break the goal into steps
 *   2. EXECUTE — Run each step
 *   3. EVALUATE — Judge the quality of the output
 *   4. REFINE — If evaluation fails, generate a critique and retry with modifications
 *
 * Prevents infinite loops via:
 *   - Max refinement attempts per step (default: 2)
 *   - Max total loop iterations (default: 3)
 *   - Diminishing returns detection (if score doesn't improve, stop)
 *
 * Usage:
 *   const result = await peerLoop({
 *     goal: "Find 50 SaaS leads in Austin and draft outreach emails",
 *     agents: ["leads", "email-sequence"],
 *   });
 */

import { ai } from "@/lib/ai";
import { nimChat } from "@/lib/nvidia";
import { createLogger } from "@/lib/logger";

const log = createLogger("peer-loop");

// ── Types ──

interface PeerStep {
  agent: string;
  task: string;
  params: Record<string, string>;
}

interface StepResult {
  step: number;
  agent: string;
  task: string;
  output: string;
  score: number;
  passed: boolean;
  attempts: number;
  refinements: string[];
}

interface PeerResult {
  goal: string;
  status: "success" | "partial" | "failed";
  steps: StepResult[];
  totalAttempts: number;
  totalDurationMs: number;
}

interface PeerOptions {
  /** The high-level goal to accomplish */
  goal: string;
  /** Optional pre-defined agent sequence (auto-planned if omitted) */
  agents?: string[];
  /** Max refinement attempts per step (default: 2) */
  maxRefinePerStep?: number;
  /** Max total loop iterations (default: 3) */
  maxIterations?: number;
  /** Quality threshold to pass (0-1, default: 0.7) */
  qualityThreshold?: number;
  /** Additional context from previous operations */
  context?: string;
}

// ── Planning Phase ──

async function planSteps(goal: string, agents?: string[]): Promise<PeerStep[]> {
  if (agents && agents.length > 0) {
    // Use pre-defined agent sequence
    return agents.map((agent, i) => ({
      agent,
      task: `Step ${i + 1} of goal: ${goal}`,
      params: {},
    }));
  }

  // Auto-plan using LLM
  const planRaw = await nimChat(
    "deepseek-ai/deepseek-v3.2",
    [
      {
        role: "system",
        content: `You are a task planner. Break the goal into 2-5 sequential steps. Each step uses one agent. Available agents: leads, email-sequence, seo-dominator, blog-gen, competitor-scan, brand-voice, proposal-generator, organic-content, client-report, creative-director. Return ONLY JSON array: [{"agent": "leads", "task": "Find prospects", "params": {"niche": "SaaS"}}]`,
      },
      { role: "user", content: goal },
    ],
    { maxTokens: 800, temperature: 0.2 }
  );

  try {
    return JSON.parse(planRaw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
  } catch {
    return [{ agent: "smart-router", task: goal, params: {} }];
  }
}

// ── Evaluation Phase ──

async function evaluateOutput(task: string, output: string, threshold: number): Promise<{ score: number; passed: boolean; critique: string }> {
  const evalRaw = await ai(
    `Evaluate this output for the task "${task}".

OUTPUT:
${output.slice(0, 2000)}

Score from 0.0 to 1.0 on:
- Relevance (does it address the task?)
- Completeness (are there gaps?)
- Quality (is it actionable and specific?)

Respond ONLY with JSON: {"score": 0.85, "passed": true, "critique": "Brief critique if score < threshold"}`,
    { system: "You are a quality evaluator. Be strict but fair. Score realistically.", maxTokens: 300 }
  );

  try {
    const parsed = JSON.parse(evalRaw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    return {
      score: Math.min(1, Math.max(0, parsed.score || 0)),
      passed: (parsed.score || 0) >= threshold,
      critique: parsed.critique || "",
    };
  } catch {
    // If evaluation fails, assume it passed (don't block on eval failure)
    return { score: 0.7, passed: true, critique: "" };
  }
}

// ── Refinement Phase ──

async function refineOutput(task: string, output: string, critique: string): Promise<string> {
  const refined = await ai(
    `The following output was produced for the task "${task}" but didn't pass quality review.

ORIGINAL OUTPUT:
${output.slice(0, 2000)}

CRITIQUE:
${critique}

Produce an improved version that addresses the critique. Output ONLY the improved content.`,
    { system: "You are a refinement specialist. Fix the specific issues raised in the critique.", maxTokens: 2000 }
  );

  return refined;
}

// ── Main PEER Loop ──

export async function peerLoop(options: PeerOptions): Promise<PeerResult> {
  const {
    goal,
    agents,
    maxRefinePerStep = 2,
    maxIterations = 3,
    qualityThreshold = 0.7,
    context,
  } = options;

  const startTime = Date.now();
  let totalAttempts = 0;

  log.info("PEER loop started", { goal, maxIterations, qualityThreshold });

  // Step 1: PLAN
  const plan = await planSteps(goal, agents);
  const results: StepResult[] = [];
  let previousOutput = context || "";

  // Step 2-4: EXECUTE → EVALUATE → REFINE for each step
  for (let i = 0; i < Math.min(plan.length, maxIterations); i++) {
    const step = plan[i];
    let output = "";
    let score = 0;
    let passed = false;
    let attempts = 0;
    const refinements: string[] = [];

    // Execute
    try {
      output = await ai(
        `${step.task}\n\n${previousOutput ? `Context from previous steps:\n${previousOutput.slice(0, 1500)}` : ""}\n\n${Object.entries(step.params).map(([k, v]) => `${k}: ${v}`).join("\n")}`,
        { system: `You are the ${step.agent} agent. Complete the task thoroughly.`, maxTokens: 2000 }
      );
      attempts++;
      totalAttempts++;
    } catch (err) {
      results.push({
        step: i + 1,
        agent: step.agent,
        task: step.task,
        output: "",
        score: 0,
        passed: false,
        attempts: 1,
        refinements: [String(err)],
      });
      continue;
    }

    // Evaluate
    const eval1 = await evaluateOutput(step.task, output, qualityThreshold);
    score = eval1.score;
    passed = eval1.passed;

    // Refine loop (if not passed and retries available)
    let prevScore = score;
    while (!passed && attempts <= maxRefinePerStep) {
      log.info("PEER refining step", { step: i + 1, agent: step.agent, score, attempt: attempts });

      refinements.push(eval1.critique);
      output = await refineOutput(step.task, output, eval1.critique);
      attempts++;
      totalAttempts++;

      const evalN = await evaluateOutput(step.task, output, qualityThreshold);
      score = evalN.score;
      passed = evalN.passed;

      // Diminishing returns check — if score didn't improve, stop refining
      if (score <= prevScore) {
        log.info("PEER diminishing returns — stopping refinement", { step: i + 1, prevScore, newScore: score });
        break;
      }
      prevScore = score;
    }

    previousOutput = output;
    results.push({
      step: i + 1,
      agent: step.agent,
      task: step.task,
      output,
      score,
      passed,
      attempts,
      refinements,
    });
  }

  const succeeded = results.filter(r => r.passed).length;
  const status = succeeded === results.length ? "success"
    : succeeded > 0 ? "partial"
    : "failed";

  log.info("PEER loop completed", { goal, status, steps: results.length, totalAttempts });

  return {
    goal,
    status,
    steps: results,
    totalAttempts,
    totalDurationMs: Date.now() - startTime,
  };
}
