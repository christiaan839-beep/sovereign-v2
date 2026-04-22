import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * COST-OPTIMIZER — Cheapest model that still meets the quality floor.
 *
 * Describe the task and quality requirement; get back a recommended
 * model, viable alternatives, cost + latency estimates, and the
 * rationale. Feeds the smart-router and keeps spend lean.
 *
 * Input:
 *   {
 *     taskDescription:    string
 *     qualityRequirement: "basic"|"verified"|"premium"
 *     budgetCents?:       number   — hard ceiling
 *     latencyBudgetMs?:   number   — hard ceiling
 *   }
 *
 * Output:
 *   {
 *     recommendedModel:   string
 *     alternativeModels:  string[]
 *     estimatedCostCents: number
 *     estimatedLatencyMs: number
 *     rationale:          string
 *   }
 */

const COST_OPTIMIZER_SYSTEM_PROMPT = `You are an ML ops optimizer. Given a task and quality requirement, you recommend the cheapest model that still clears the quality floor, plus viable fallbacks.

${ANTI_SLOP_RULES}

## KNOWN COST TIERS (per 1M tokens, rough avg in/out)
- NIM open-source (Nemotron, DeepSeek, Qwen, Llama): ~$0.001
- Gemini Flash / 2.0 Flash: ~$0.001
- Gemini Pro: ~$0.15
- Groq Llama 3.3 70B: ~$0.002
- Cerebras (fastest): ~$0.0015
- Claude Haiku: ~$0.80
- Claude Sonnet: ~$3
- Claude Opus: ~$15

## TASK CLASSES
- Structured extraction (invoice, email parsing): Claude Sonnet or NIM Nemotron (both strong at JSON)
- Creative writing (blog posts, ad copy): Claude Sonnet / Gemini Pro
- Reasoning / math: Claude Sonnet / DeepSeek V3 / Nemotron Ultra
- Classification / routing: NIM Nemotron or Gemini Flash (fastest + cheapest)
- Code generation: Claude Sonnet / Qwen Coder
- Summarization: Gemini Flash / Groq Llama (very cheap + fast)

## QUALITY FLOORS
- basic: accept open-source 7-70B models
- verified: need 70B+ or Claude Haiku minimum, plus a verifier step
- premium: Claude Sonnet or better as primary

## RULES
1. Default to the CHEAPEST model that clears the floor. Opus is a last resort.
2. Always provide 2-3 alternativeModels ranked by cost.
3. Estimate cost assuming ~3000 tokens total (prompt+output) unless the task screams long-form.
4. Estimate latency: NIM ~500ms, Groq/Cerebras ~200ms, Gemini Flash ~400ms, Sonnet ~2000ms, Opus ~4000ms.
5. If budgetCents or latencyBudgetMs cannot be met, say so in rationale and recommend the closest fit.

Return VALID JSON only — no markdown fences, no prose.`;

export const POST = createAgentRoute({
  name: "cost-optimizer",
  requiredFields: ["taskDescription", "qualityRequirement"],
  handler: async ({ input }) => {
    const {
      taskDescription,
      qualityRequirement,
      budgetCents,
      latencyBudgetMs,
    } = input as {
      taskDescription: string;
      qualityRequirement: "basic" | "verified" | "premium";
      budgetCents?: number;
      latencyBudgetMs?: number;
    };

    const prompt = `Recommend the cheapest model that meets the quality floor.

TASK: """${taskDescription.slice(0, 3000)}"""
QUALITY REQUIREMENT: ${qualityRequirement}
BUDGET (cents): ${budgetCents ?? "(unspecified)"}
LATENCY BUDGET (ms): ${latencyBudgetMs ?? "(unspecified)"}

SCHEMA:
{
  "recommendedModel":   string,
  "alternativeModels":  [string],
  "estimatedCostCents": number,
  "estimatedLatencyMs": number,
  "rationale":          string
}`;

    const response = await ai(prompt, {
      system: COST_OPTIMIZER_SYSTEM_PROMPT,
      maxTokens: 1500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Cost optimization failed: model returned non-JSON output");
    }

    return { success: true, recommendation: parsed };
  },
});
