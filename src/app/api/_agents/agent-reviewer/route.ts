import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * AGENT-REVIEWER — Score an agent's recent outputs + recommend fixes.
 *
 * Feed it an agent slug and 3-10 of its recent real outputs; get back
 * a 0-100 score, explicit strengths/weaknesses, targeted prompt
 * change suggestions, and optionally a different model recommendation.
 *
 * Input:
 *   {
 *     agentSlug:    string
 *     sampleOutputs: string[]         — 3-10 recent outputs
 *     targetQuality?: "basic"|"verified"|"premium"  (default "verified")
 *   }
 *
 * Output:
 *   {
 *     overallScore:             number (0-100),
 *     strengths:                string[],
 *     weaknesses:               string[],
 *     suggestedPromptChanges:   string[],
 *     suggestedModelChange:     string|null
 *   }
 */

const AGENT_REVIEWER_SYSTEM_PROMPT = `You are a senior prompt engineer auditing another agent's production outputs. Your feedback must be specific, minimal, and grounded in the samples.

${ANTI_SLOP_RULES}

## SCORING RUBRIC (0-100)
- 90-100: consistent, instruction-following, on-format, zero hallucinations detected
- 70-89:  mostly correct, minor inconsistencies or format drift
- 50-69:  works but unreliable; format compliance slipping
- 30-49:  partial instruction following, visible hallucinations or scope creep
- 0-29:   broken — wrong format, off-topic, or unsafe

## HEURISTICS
1. Consistency across outputs — do similar inputs produce similar structure?
2. Instruction following — does the output respect the implicit task?
3. Format adherence — valid JSON / length / style where expected?
4. Hallucination rate — any fabricated details not supported by inputs?
5. Format compliance — headings, punctuation, casing, field names.

## OUTPUT DISCIPLINE
- Suggest the SMALLEST prompt edit that addresses each weakness. Preserve what works.
- Suggest a model change ONLY if the failure pattern is clearly a capability gap (e.g. structured extraction failing on a 7B model → recommend Claude/Nemotron). Else return null.
- Never suggest cosmetic rewrites.

Return VALID JSON only — no markdown fences, no prose.`;

export const POST = createAgentRoute({
  name: "agent-reviewer",
  requiredFields: ["agentSlug", "sampleOutputs"],
  handler: async ({ input }) => {
    const {
      agentSlug,
      sampleOutputs,
      targetQuality = "verified",
    } = input as {
      agentSlug: string;
      sampleOutputs: string[];
      targetQuality?: "basic" | "verified" | "premium";
    };

    const trimmedSamples = (sampleOutputs || [])
      .slice(0, 10)
      .map((s, i) => `[SAMPLE ${i + 1}]\n${String(s).slice(0, 3000)}`)
      .join("\n\n---\n\n");

    const prompt = `Review this agent's outputs.

AGENT SLUG: ${agentSlug}
TARGET QUALITY: ${targetQuality}
SAMPLE COUNT: ${sampleOutputs?.length ?? 0}

SAMPLES:
"""
${trimmedSamples}
"""

SCHEMA:
{
  "overallScore": number,
  "strengths": [string],
  "weaknesses": [string],
  "suggestedPromptChanges": [string],
  "suggestedModelChange": string|null
}`;

    const response = await ai(prompt, {
      system: AGENT_REVIEWER_SYSTEM_PROMPT,
      maxTokens: 2000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Agent review failed: model returned non-JSON output");
    }

    return { success: true, review: parsed };
  },
});
