import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat } from "@/lib/nvidia";
import { getPlaybook, resolvePlaybookSteps } from "@/lib/playbooks";

/**
 * GOAL COORDINATOR — Plan and execute multi-agent pipelines from plain English.
 *
 * Two modes:
 *   1. Goal mode:     { goal: string, auto_execute?: boolean }
 *      → LLM decomposes the goal into steps, optionally executes them
 *   2. Playbook mode: { playbook_id: string, inputs: Record<string, string>, auto_execute?: boolean }
 *      → Pre-configured multi-agent chain with user-provided inputs
 *
 * Output: { plan: Step[], results?: StepResult[], summary? }
 */

const AVAILABLE_AGENTS = [
  "leads",
  "blog-gen",
  "seo-dominator",
  "site-assassin",
  "competitor-scan",
  "email-sequence",
  "smart-router",
  "vision",
  "translate",
  "embed",
  "omni-search",
  "deep-think",
  "proposal-generator",
  "case-study",
  "brand-voice",
  "brand-audit",
  "ad-report",
  "funnel-xray",
  "organic-content",
  "content",
  "doc-intel",
  "contract-analyzer",
  "client-report",
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

const PLANNER_SYSTEM = `You are a task planner for an AI agent platform. Given a business goal, break it into 2-5 concrete steps. Each step uses one of these agents: ${AVAILABLE_AGENTS.join(", ")}. Return a JSON array of steps.

Each step has this shape:
{ "agent": "<agent-name>", "params": { "<key>": "<value>" }, "reason": "Why this step matters" }

Agent capabilities and expected params:
- leads: Find prospects. { "niche": "...", "location": "..." }
- blog-gen: Write SEO blog posts. { "topic": "...", "tone": "..." }
- seo-dominator: SEO audit and analysis. { "url": "..." }
- site-assassin: Deep website analysis. { "url": "..." }
- competitor-scan: Competitive intelligence. { "target": "..." }
- email-sequence: Multi-step email campaigns. { "product": "...", "audience": "..." }
- smart-router: General AI tasks routed to best model. { "prompt": "...", "task_type": "..." }
- vision: Analyze images/screenshots. { "url": "..." }
- translate: Translate text. { "text": "...", "target_language": "..." }
- embed: Generate text embeddings. { "text": "..." }
- omni-search: Research any topic with AI synthesis. { "query": "..." }
- deep-think: Complex reasoning and analysis. { "prompt": "..." }
- proposal-generator: Business proposals. { "prompt": "..." }
- case-study: Generate case studies. { "prompt": "..." }
- brand-voice: Brand voice analysis. { "prompt": "..." }
- brand-audit: Comprehensive brand audit. { "url": "..." }
- ad-report: Advertising analysis. { "prompt": "..." }
- funnel-xray: Sales funnel analysis. { "url": "..." }
- organic-content: Organic content strategy. { "prompt": "..." }
- content: General content creation. { "prompt": "..." }
- doc-intel: Document analysis. { "prompt": "..." }
- contract-analyzer: Legal document review. { "prompt": "..." }
- client-report: Client performance reports. { "prompt": "..." }

Chain steps so output from step N can inform step N+1.
Return ONLY a JSON array. No markdown, no explanation.`;

export const POST = createAgentRoute({
  name: "coordinator",
  requiredFields: [],
  handler: async ({ input }) => {
    const autoExecute = (input.auto_execute as boolean) ?? false;
    const maxSteps = Math.min(
      (input.max_steps as number) || MAX_STEPS_HARD_LIMIT,
      MAX_STEPS_HARD_LIMIT
    );

    let plan: PlanStep[];
    let goalText: string;

    // ─── Mode Selection: Playbook vs. Goal ───
    const playbookId = input.playbook_id as string | undefined;

    if (playbookId) {
      // ── Playbook mode: use pre-configured steps ──
      const playbook = getPlaybook(playbookId);
      if (!playbook) {
        return { error: `Playbook "${playbookId}" not found` };
      }

      const userInputs = (input.inputs as Record<string, string>) || {};

      // Validate required fields
      for (const field of playbook.fields) {
        if (field.required && (!userInputs[field.key] || !userInputs[field.key].trim())) {
          return { error: `Missing required field: ${field.label}` };
        }
      }

      const resolvedSteps = resolvePlaybookSteps(playbook, userInputs);
      plan = resolvedSteps.map((s) => ({
        agent: s.agent as AgentName,
        params: s.params,
        reason: s.reason,
      }));
      goalText = `Playbook: ${playbook.name} — ${playbook.tagline}`;
    } else {
      // ── Goal mode: LLM plans the steps ──
      const goal = input.goal as string;
      if (!goal) {
        return { error: "Either 'goal' or 'playbook_id' is required" };
      }
      goalText = goal;

      const planRaw = await nimChat(
        "deepseek-ai/deepseek-v3.2",
        [
          { role: "system", content: PLANNER_SYSTEM },
          { role: "user", content: goal },
        ],
        { maxTokens: 1200, temperature: 0.3 }
      );

      try {
        const cleaned = planRaw
          .replace(/```json?\n?/g, "")
          .replace(/```/g, "")
          .trim();
        plan = JSON.parse(cleaned);
      } catch {
        return {
          goal: goalText,
          error: "Failed to parse plan from LLM",
          raw: planRaw.slice(0, 500),
        };
      }

      if (!Array.isArray(plan) || plan.length === 0) {
        return { goal: goalText, error: "LLM returned an empty or invalid plan", raw: planRaw.slice(0, 500) };
      }

      plan = plan.slice(0, maxSteps).filter(
        (s) => s.agent && AVAILABLE_AGENTS.includes(s.agent as AgentName)
      );

      if (plan.length === 0) {
        return { goal: goalText, error: "No valid agent steps in the plan", raw: planRaw.slice(0, 500) };
      }
    }

    // ─── Preview mode: return the plan without executing ───
    if (!autoExecute) {
      return {
        goal: goalText,
        plan,
        auto_execute: false,
        message: "Plan generated. Set auto_execute to true to run it.",
        ...(playbookId ? { playbook_id: playbookId } : {}),
      };
    }

    // ─── Execute the plan ───
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const results: StepResult[] = [];
    let previousOutput = "";
    const stepOutputs: Record<string, string> = {};

    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      const start = Date.now();

      // Resolve {{step_N}} templates with previous step outputs
      const body: Record<string, string> = {};
      for (const [key, value] of Object.entries(step.params)) {
        let resolved = value;
        for (const [ref, output] of Object.entries(stepOutputs)) {
          resolved = resolved.replaceAll(ref, output);
        }
        body[key] = resolved;
      }

      // Inject context from previous step if no explicit context
      if (previousOutput && !body.context) {
        body.context = previousOutput.slice(0, 1500);
      }
      // Agents that use `prompt` as primary key need it populated
      if (!body.prompt && !body.text && !body.url && !body.target && !body.niche && !body.query) {
        body.prompt = `${step.reason}. Context: ${previousOutput.slice(0, 500)}`;
      }

      try {
        const res = await fetch(`${baseUrl}/api/agents/${step.agent}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, confirmed: true }),
          signal: AbortSignal.timeout(45000),
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

        // Extract summary for downstream steps
        const summary = JSON.stringify(data).slice(0, 2000);
        previousOutput = summary;
        stepOutputs[`{{step_${i + 1}}}`] = summary;

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
      goal: goalText,
      plan,
      auto_execute: true,
      ...(playbookId ? { playbook_id: playbookId } : {}),
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
