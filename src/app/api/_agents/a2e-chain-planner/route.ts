import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * A2E-CHAIN-PLANNER — Design a multi-agent playbook with cost/latency estimates.
 *
 * Given a natural-language goal and a list of available agents (with their
 * per-run cost and latency), this agent designs an ordered chain of steps
 * that meets the goal within an optional budget, and estimates total cost,
 * latency, and critical path.
 *
 * Input:
 *   {
 *     goal:            string  — Natural language outcome the user wants
 *     availableAgents: Array<{ slug, purpose, avgCostCents, avgLatencyMs }>
 *     budgetCents?:    number  — Hard cost cap, optional
 *     maxSteps?:       number  — Max chain length (default 7)
 *   }
 *
 * Output (JSON):
 *   {
 *     chain: Array<{
 *       step, agent, inputs, outputKey, estimatedCostCents,
 *       estimatedLatencyMs, failureFallback
 *     }>,
 *     totalEstimatedCostCents:   number,
 *     totalEstimatedLatencyMs:   number,
 *     criticalPath:              string[],
 *     riskAssessment:            string
 *   }
 */

const A2E_CHAIN_PLANNER_SYSTEM_PROMPT = `You are a staff-level agent-orchestration engineer who designs production playbooks. You think like a distributed-systems architect: you minimize serial steps, parallelize where safe, and you never recommend an agent that doesn't exist.

${ANTI_SLOP_RULES}

## PLANNING RULES
1. NEVER fabricate agent capabilities. You may ONLY compose agents whose slug appears in availableAgents. If no supplied agent fits a needed step, do NOT invent one — instead, emit that step with agent: "MISSING" and a failureFallback that says "no agent matches — recommend building X" with a one-line description of what X would do.
2. Every inputs value references either a literal string, a {{user.fieldName}} placeholder for user inputs, or a {{step_N_outputKey}} reference to a prior step's outputKey.
3. outputKey is a single snake_case identifier describing that step's artifact (e.g. "enriched_lead", "scored_draft"). Downstream steps reference it.
4. estimatedCostCents and estimatedLatencyMs come from that agent's avgCostCents and avgLatencyMs in availableAgents — do not invent numbers.
5. totalEstimatedCostCents is the arithmetic sum of all step costs. totalEstimatedLatencyMs is the sum of the critical-path latency (sequential steps only — if multiple steps could run in parallel, only the slowest counts).
6. If budgetCents is provided and the chain exceeds it, shrink the chain to fit rather than omitting the budget cap.
7. Respect maxSteps (default 7). If the goal truly requires more, compress aggressively and note in riskAssessment.
8. criticalPath is the ordered list of outputKeys that gate the final output.
9. failureFallback on each step is a one-line instruction for what to do if that step errors (e.g. "retry with smaller batch", "skip and continue with partial data", null if truly no fallback exists).
10. riskAssessment is 1-3 sentences of honest risk commentary — flaky steps, data-dependency issues, or places where a human-in-the-loop is advisable.
11. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "a2e-chain-planner",
  requiredFields: ["goal", "availableAgents"],
  handler: async ({ input }) => {
    const {
      goal,
      availableAgents,
      budgetCents,
      maxSteps,
    } = input as {
      goal: string;
      availableAgents: Array<{
        slug: string;
        purpose: string;
        avgCostCents: number;
        avgLatencyMs: number;
      }>;
      budgetCents?: number;
      maxSteps?: number;
    };

    const stepCap = typeof maxSteps === "number" && maxSteps > 0 ? Math.min(maxSteps, 20) : 7;

    const prompt = `Design an agent chain that accomplishes the goal. Return ONLY valid JSON matching the schema.

GOAL:
${goal}

AVAILABLE AGENTS (you may ONLY use these):
${JSON.stringify(availableAgents, null, 2)}

CONSTRAINTS:
- maxSteps: ${stepCap}
- budgetCents: ${typeof budgetCents === "number" ? budgetCents : "unlimited"}

SCHEMA:
{
  "chain": [
    {
      "step": number,
      "agent": string,
      "inputs": { [key: string]: string },
      "outputKey": string,
      "estimatedCostCents": number,
      "estimatedLatencyMs": number,
      "failureFallback": string | null
    }
  ],
  "totalEstimatedCostCents": number,
  "totalEstimatedLatencyMs": number,
  "criticalPath": [ string ],
  "riskAssessment": string
}`;

    const response = await ai(prompt, {
      system: A2E_CHAIN_PLANNER_SYSTEM_PROMPT,
      maxTokens: 3000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Chain planning failed: model returned non-JSON output");
    }

    return { success: true, plan: parsed };
  },
});
