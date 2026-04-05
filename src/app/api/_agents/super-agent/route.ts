import { createAgentRoute } from "@/lib/agent-factory";
import { smartAi } from "@/lib/ai";
import { verifiedAi } from "@/lib/consensus";
import { getBaseUrl } from "@/lib/base-url";

/**
 * SUPER AGENT — The most powerful endpoint in Sovereign Matrix.
 *
 * One prompt. Any goal. The Super Agent:
 *   1. UNDERSTANDS the goal (classifies what's needed)
 *   2. PLANS the execution (picks agents + order)
 *   3. EXECUTES each step (calls agents with context chaining)
 *   4. VERIFIES the output (consensus check on complex tasks)
 *   5. RETURNS a unified result
 *
 * Combines: Coordinator planning + Smart Router intelligence +
 *           Consensus verification + Playbook execution
 *
 * Input:  { goal: string, verified?: boolean, max_steps?: number }
 * Output: { plan, results, summary, verified? }
 */

const AVAILABLE_AGENTS = [
  "leads", "blog-gen", "seo-dominator", "site-assassin", "competitor-scan",
  "email-sequence", "smart-router", "vision", "translate", "embed",
  "omni-search", "deep-think", "proposal-generator", "case-study",
  "brand-voice", "brand-audit", "ad-report", "funnel-xray",
  "organic-content", "content", "doc-intel", "contract-analyzer",
  "client-report",
];

const MAX_STEPS = 5;

interface Step {
  agent: string;
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

export const POST = createAgentRoute({
  name: "super-agent",
  requiredFields: ["goal"],
  handler: async ({ input }) => {
    const goal = input.goal as string;
    const useVerification = (input.verified as boolean) ?? false;
    const maxSteps = Math.min((input.max_steps as number) || MAX_STEPS, MAX_STEPS);
    const totalStart = Date.now();

    // ─── Phase 1: UNDERSTAND + PLAN ───
    // Use smartAi with research to understand what the user actually needs
    const planResponse = await smartAi(
      `You are a task planner. Break this goal into 2-${maxSteps} concrete steps.
Each step uses one agent: ${AVAILABLE_AGENTS.join(", ")}.

GOAL: ${goal}

Return ONLY a JSON array:
[{"agent": "leads", "params": {"niche": "..."}, "reason": "Why this step"}]

Agent params:
- leads: { niche, location }
- blog-gen: { topic, tone }
- seo-dominator: { domain, keywords }
- site-assassin: { url }
- competitor-scan: { target }
- email-sequence: { product, audience }
- smart-router: { prompt, task_type }
- omni-search: { query }
- deep-think: { problem }
- proposal-generator: { client_name, project_type }
- case-study: { prompt }
- brand-voice: { prompt }
- funnel-xray: { url }
- contract-analyzer: { prompt }
- content: { prompt }`,
      {
        category: "analysis",
        research: goal.includes("http") || goal.includes(".com"),
        thinking: true,
      }
    );

    // Parse the plan
    let plan: Step[];
    try {
      const cleaned = planResponse.answer
        .replace(/```json?\n?/g, "")
        .replace(/```/g, "")
        .trim();
      // Extract JSON array from the response
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      plan = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      // If planning fails, use smart-router as fallback
      plan = [{ agent: "smart-router", params: { prompt: goal, task_type: "analysis" }, reason: "Direct execution — planning failed" }];
    }

    // Validate and clamp
    plan = plan
      .filter((s) => s.agent && AVAILABLE_AGENTS.includes(s.agent))
      .slice(0, maxSteps);

    if (plan.length === 0) {
      plan = [{ agent: "smart-router", params: { prompt: goal, task_type: "analysis" }, reason: "Fallback — no valid steps planned" }];
    }

    // ─── Phase 2: EXECUTE ───
    const baseUrl = getBaseUrl();
    const results: StepResult[] = [];
    let previousOutput = "";
    const stepOutputs: Record<string, string> = {};

    for (let i = 0; i < plan.length; i++) {
      const step = plan[i];
      const start = Date.now();

      // Build request body with context from previous steps
      const body: Record<string, string> = { ...step.params };
      for (const [ref, output] of Object.entries(stepOutputs)) {
        for (const key of Object.keys(body)) {
          body[key] = body[key].replaceAll(ref, output);
        }
      }
      if (previousOutput && !body.context) {
        body.context = previousOutput.slice(0, 2000);
      }
      if (!body.prompt && !body.text && !body.url && !body.target && !body.niche && !body.query && !body.domain && !body.problem) {
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
          results.push({ step: i + 1, agent: step.agent, reason: step.reason, status: "failed", error: data.error || `HTTP ${res.status}`, duration_ms });
          previousOutput += `\nStep ${i + 1} failed: ${data.error || res.status}`;
          continue;
        }

        const summary = JSON.stringify(data).slice(0, 2000);
        previousOutput = summary;
        stepOutputs[`{{step_${i + 1}}}`] = summary;

        results.push({ step: i + 1, agent: step.agent, reason: step.reason, status: "success", data, duration_ms });
      } catch (err) {
        const duration_ms = Date.now() - start;
        results.push({ step: i + 1, agent: step.agent, reason: step.reason, status: "failed", error: err instanceof Error ? err.message : "Unknown", duration_ms });
      }
    }

    // ─── Phase 3: VERIFY (optional) ───
    let verification;
    if (useVerification && results.some((r) => r.status === "success")) {
      try {
        const successData = results
          .filter((r) => r.status === "success")
          .map((r) => `Step ${r.step} (${r.agent}): ${JSON.stringify(r.data).slice(0, 500)}`)
          .join("\n");

        verification = await verifiedAi(
          `Review this multi-agent execution result for accuracy and completeness:\n\nGOAL: ${goal}\n\nRESULTS:\n${successData}`,
          { system: "You are a quality reviewer. Check for errors, gaps, and inconsistencies.", maxTokens: 1500 }
        );
      } catch {
        verification = { answer: "Verification skipped — reviewer unavailable", verified: false };
      }
    }

    // ─── Phase 4: SUMMARIZE ───
    const succeeded = results.filter((r) => r.status === "success").length;
    const totalDuration = Date.now() - totalStart;

    return {
      goal,
      plan,
      results,
      verification: verification ? {
        review: verification.answer,
        confidence: verification.confidence,
        verified: verification.verified,
        models_used: verification.models,
      } : undefined,
      summary: {
        total_steps: results.length,
        succeeded,
        failed: results.length - succeeded,
        total_duration_ms: totalDuration,
        research_grounded: !!planResponse.research,
        thinking_enabled: true,
      },
    };
  },
});
