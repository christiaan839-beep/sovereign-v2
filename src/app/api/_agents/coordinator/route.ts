import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat } from "@/lib/nvidia";

/**
 * GOAL COORDINATOR — Plan and execute multi-agent pipelines from plain English.
 *
 * Input: { goal: string, auto_execute?: boolean, max_steps?: number }
 * Output: { plan: Step[], results?: StepResult[] }
 *
 * The coordinator uses an LLM to decompose a business goal into 2-5 concrete
 * steps, each targeting a specific agent. If auto_execute is true, it runs
 * each step sequentially, threading the output of step N into step N+1.
 */

const AVAILABLE_AGENTS = [
  "leads",
  "blog-gen",
  "seo",
  "competitor-scan",
  "email-sequence",
  "smart-router",
  "vision",
  "translate",
  "embed",
] as const;

type AgentName = (typeof AVAILABLE_AGENTS)[number];

interface PlanStep {
  agent: AgentName;
  params: Record<string, string>;
  reason: string;
}

interface StepResult {
  step: number;
  agent: string;
  reason: string;
  status: "success" | "failed";
  data?: unknown;
  error?: string;
  duration_ms: number;
}

const MAX_STEPS_HARD_LIMIT = 5;

const PLANNER_SYSTEM = `You are a task planner. Given a business goal, break it into 2-5 concrete steps. Each step uses one of these agents: ${AVAILABLE_AGENTS.join(", ")}. Return a JSON array of steps.

Each step has this shape:
{ "agent": "<agent-name>", "params": { "<key>": "<value>" }, "reason": "Why this step matters" }

The params object should contain the fields the agent expects. Common patterns:
- leads: { "niche": "...", "location": "..." }
- blog-gen: { "topic": "...", "tone": "..." }
- seo: { "url": "...", "keywords": "..." }
- competitor-scan: { "target": "..." }
- email-sequence: { "product": "...", "audience": "..." }
- smart-router: { "prompt": "...", "task_type": "..." }
- vision: { "url": "..." }
- translate: { "text": "...", "target_language": "..." }
- embed: { "text": "..." }

Return ONLY a JSON array. No markdown, no explanation.`;

export const POST = createAgentRoute({
  name: "coordinator",
  requiredFields: ["goal"],
  handler: async ({ input }) => {
    const goal = input.goal as string;
    const autoExecute = (input.auto_execute as boolean) ?? false;
    const maxSteps = Math.min(
      (input.max_steps as number) || MAX_STEPS_HARD_LIMIT,
      MAX_STEPS_HARD_LIMIT
    );

    // ─── Phase 1: Generate the plan ───
    const planRaw = await nimChat(
      "deepseek-ai/deepseek-v3.2",
      [
        { role: "system", content: PLANNER_SYSTEM },
        { role: "user", content: goal },
      ],
      { maxTokens: 1200, temperature: 0.3 }
    );

    let plan: PlanStep[];
    try {
      const cleaned = planRaw
        .replace(/```json?\n?/g, "")
        .replace(/```/g, "")
        .trim();
      plan = JSON.parse(cleaned);
    } catch {
      return {
        goal,
        error: "Failed to parse plan from LLM",
        raw: planRaw.slice(0, 500),
      };
    }

    // Validate and clamp
    if (!Array.isArray(plan) || plan.length === 0) {
      return { goal, error: "LLM returned an empty or invalid plan", raw: planRaw.slice(0, 500) };
    }

    plan = plan.slice(0, maxSteps).filter(
      (s) => s.agent && AVAILABLE_AGENTS.includes(s.agent as AgentName)
    );

    if (plan.length === 0) {
      return { goal, error: "No valid agent steps in the plan", raw: planRaw.slice(0, 500) };
    }

    // ─── Phase 2 (optional): Execute the plan ───
    if (!autoExecute) {
      return { goal, plan, auto_execute: false, message: "Plan generated. Set auto_execute to true to run it." };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const results: StepResult[] = [];
    let previousOutput = "";

    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      const start = Date.now();

      // Inject context from previous step
      const body: Record<string, string> = { ...step.params };
      if (previousOutput) {
        body.context = previousOutput;
      }
      // Agents that use `prompt` as primary key need it populated
      if (!body.prompt && !body.text && !body.url && !body.target && !body.niche) {
        body.prompt = `${step.reason}. Context: ${previousOutput.slice(0, 500)}`;
      }

      try {
        const res = await fetch(`${baseUrl}/api/_agents/${step.agent}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30000),
        });

        const data = await res.json();
        const duration_ms = Date.now() - start;

        if (!res.ok) {
          results.push({
            step: i + 1,
            agent: step.agent,
            reason: step.reason,
            status: "failed",
            error: data.error || `HTTP ${res.status}`,
            duration_ms,
          });
          previousOutput += `\nStep ${i + 1} (${step.agent}) failed: ${data.error || res.status}`;
          continue;
        }

        // Extract a usable summary for the next step
        const summary = JSON.stringify(data).slice(0, 1500);
        previousOutput = summary;

        results.push({
          step: i + 1,
          agent: step.agent,
          reason: step.reason,
          status: "success",
          data,
          duration_ms,
        });
      } catch (err) {
        const duration_ms = Date.now() - start;
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        results.push({
          step: i + 1,
          agent: step.agent,
          reason: step.reason,
          status: "failed",
          error: errMsg,
          duration_ms,
        });
        previousOutput += `\nStep ${i + 1} (${step.agent}) failed: ${errMsg}`;
      }
    }

    const succeeded = results.filter((r) => r.status === "success").length;

    return {
      goal,
      plan,
      auto_execute: true,
      results,
      summary: {
        total_steps: results.length,
        succeeded,
        failed: results.length - succeeded,
        total_duration_ms: results.reduce((sum, r) => sum + r.duration_ms, 0),
      },
    };
  },
});
