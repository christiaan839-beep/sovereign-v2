import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * PLAYBOOK-BUILDER — Natural-language goal → executable agent chain.
 *
 * Composes a playbook by chaining existing agents, wiring each step's
 * output into the next step's input, and emitting a checkable
 * guarantee clause. Result can be fed straight into /api/playbooks/run.
 *
 * Input:
 *   {
 *     goal:              string
 *     availableAgents?:  string[]    — restrict composition to these slugs
 *     maxSteps?:         number      — default 5
 *   }
 *
 * Output:
 *   {
 *     playbookName:      string
 *     description:       string
 *     steps:             Array<{ agent, inputs, outputKey }>
 *     guarantee:         string     — machine-checkable clause
 *     estimatedCostCents:number
 *   }
 */

const PLAYBOOK_BUILDER_SYSTEM_PROMPT = `You are a workflow architect composing Sovereign Matrix playbooks. You turn a natural-language goal into a minimal sequence of agent calls with a checkable guarantee clause.

${ANTI_SLOP_RULES}

## RULES
1. Keep playbooks under maxSteps (default 5) to keep end-to-end latency < 60s.
2. Each step wires into the next — step N's outputKey becomes a variable that step N+1 references in inputs (e.g. "{{step1.leads}}").
3. The guarantee clause MUST be checkable by a regex or count assertion. Examples:
   - "≥5 leads each with contact_angle field"
   - "exactly 1 blog post, ≥800 words, with H1 + 3 H2s"
   - "JSON array of domains, each scored 0-100"
   Avoid vague guarantees like "high quality" or "relevant".
4. Cost estimate: sum of per-step cost. Defaults per step: cheap extract/format $0.005, LLM reasoning $0.03, long-form write $0.08. Round to cents.
5. If availableAgents is provided, ONLY use agents in that list. If the goal cannot be met with those agents, return steps: [] and describe the gap in description.
6. Name playbooks action-first, kebab-case: "lead-blitz-europe", NOT "europe-lead-blitz-playbook-v2".

Return VALID JSON only — no markdown fences, no prose.`;

export const POST = createAgentRoute({
  name: "playbook-builder",
  requiredFields: ["goal"],
  handler: async ({ input }) => {
    const {
      goal,
      availableAgents,
      maxSteps = 5,
    } = input as {
      goal: string;
      availableAgents?: string[];
      maxSteps?: number;
    };

    const prompt = `Compose a playbook for this goal.

GOAL:
"""
${goal.slice(0, 4000)}
"""

AVAILABLE AGENTS: ${availableAgents && availableAgents.length ? availableAgents.join(", ") : "(any registered agent)"}
MAX STEPS: ${maxSteps}

SCHEMA:
{
  "playbookName":       string,
  "description":        string,
  "steps":              [ { "agent": string, "inputs": {string: string}, "outputKey": string } ],
  "guarantee":          string,
  "estimatedCostCents": number
}`;

    const response = await ai(prompt, {
      system: PLAYBOOK_BUILDER_SYSTEM_PROMPT,
      maxTokens: 2500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Playbook build failed: model returned non-JSON output");
    }

    return { success: true, playbook: parsed };
  },
});
