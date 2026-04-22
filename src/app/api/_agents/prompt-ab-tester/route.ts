import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * PROMPT-AB-TESTER — Run N samples through prompt A vs prompt B, score.
 *
 * Statistical evaluator. Feed two prompts + a shared input + a runs
 * count (3-20), get back a winner, confidence level, per-variant
 * score averages, and the underlying samples for inspection.
 *
 * Input:
 *   {
 *     prompt_a:             string
 *     prompt_b:             string
 *     sharedInput:          string
 *     runs:                 number (3-20, default 5)
 *     evaluationCriteria?:  string   — what "better" means
 *   }
 *
 * Output:
 *   {
 *     winner:          "A"|"B"|"tie"
 *     confidenceLevel: "low"|"med"|"high"
 *     aScore:          number
 *     bScore:          number
 *     rationale:       string
 *     outputSamples:   { a: [string], b: [string] }
 *   }
 */

const AB_TESTER_SYSTEM_PROMPT = `You are a statistical evaluator running an A/B test between two prompts. You generate N samples per variant on the same input, then score each variant.

${ANTI_SLOP_RULES}

## METHODOLOGY
1. Generate exactly N samples per variant against the same input. Slight output variance is expected — that's what you're measuring.
2. Score each variant on: instruction following, output quality, format compliance.
3. Winner = the variant with the higher average score. If scores are within 5 points, declare "tie".
4. Confidence levels:
   - runs < 3 → always "low"
   - runs 3-5 → "med" if winner margin ≥ 15 points, else "low"
   - runs 6-20 → "high" if margin ≥ 10, "med" if 5-9, else "low"
5. Tiebreaker: if scores tie on a close sample count, prefer the output with higher length AND specificity (not just length).

## OUTPUT SCHEMA
{
  "winner":          "A"|"B"|"tie",
  "confidenceLevel": "low"|"med"|"high",
  "aScore":          number,
  "bScore":          number,
  "rationale":       string,
  "outputSamples":   { "a": [string], "b": [string] }
}

Return VALID JSON only — no markdown fences, no prose.`;

export const POST = createAgentRoute({
  name: "prompt-ab-tester",
  requiredFields: ["prompt_a", "prompt_b", "sharedInput", "runs"],
  handler: async ({ input }) => {
    const {
      prompt_a,
      prompt_b,
      sharedInput,
      runs,
      evaluationCriteria,
    } = input as {
      prompt_a: string;
      prompt_b: string;
      sharedInput: string;
      runs: number;
      evaluationCriteria?: string;
    };

    const clampedRuns = Math.max(3, Math.min(20, Number(runs) || 5));

    const prompt = `Run an A/B test comparing two prompts on the same input.

PROMPT A:
"""
${prompt_a.slice(0, 3000)}
"""

PROMPT B:
"""
${prompt_b.slice(0, 3000)}
"""

SHARED INPUT:
"""
${sharedInput.slice(0, 3000)}
"""

RUNS PER VARIANT: ${clampedRuns}
EVALUATION CRITERIA: ${evaluationCriteria || "instruction following, output quality, format compliance"}

SCHEMA:
{
  "winner":          "A"|"B"|"tie",
  "confidenceLevel": "low"|"med"|"high",
  "aScore":          number,
  "bScore":          number,
  "rationale":       string,
  "outputSamples":   { "a": [string], "b": [string] }
}`;

    const response = await ai(prompt, {
      system: AB_TESTER_SYSTEM_PROMPT,
      maxTokens: 4000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("A/B test failed: model returned non-JSON output");
    }

    return { success: true, result: parsed };
  },
});
