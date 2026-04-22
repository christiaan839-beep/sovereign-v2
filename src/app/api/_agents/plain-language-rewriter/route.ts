import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * PLAIN-LANGUAGE-REWRITER — Rewrite text to a target reading grade level.
 *
 * Input:
 *   { text: string, gradeLevel?: number, preserveJargon?: string[] }
 *
 * Output (JSON):
 *   { rewritten: string, originalGradeLevel: number|null, newGradeLevel: number|null, changes: string[] }
 */

const PLAIN_LANGUAGE_SYSTEM_PROMPT = `You are a plain language expert. You rewrite dense, jargon-heavy, or passive text so that ordinary readers can understand it on the first read.

${ANTI_SLOP_RULES}

## REWRITING RULES
1. Shorter sentences. Aim for 12-18 words. Never more than 25.
2. Concrete verbs. "Give" not "provide." "Use" not "utilize." "Help" not "facilitate."
3. Kill passive voice unless the actor is truly unknown. "We approved the request" not "The request was approved."
4. Prefer common words over Latin-derived words. "Start" not "commence." "End" not "terminate."
5. Keep technical terms ONLY if they are in the preserveJargon[] list. Otherwise replace with plain equivalents or brief explanations.
6. One idea per paragraph.
7. originalGradeLevel and newGradeLevel are approximate Flesch-Kincaid estimates — return null if unsure.
8. changes[] lists concrete transformations ("split 3 run-on sentences", "replaced 'leverage' with 'use' 4 times").
9. Output VALID JSON only — no markdown fences, no prose outside the JSON.`;

export const POST = createAgentRoute({
  name: "plain-language-rewriter",
  requiredFields: ["text"],
  handler: async ({ input }) => {
    const {
      text,
      gradeLevel = 8,
      preserveJargon = [],
    } = input as { text: string; gradeLevel?: number; preserveJargon?: string[] };

    const targetGrade = Math.max(4, Math.min(12, Number(gradeLevel) || 8));

    const prompt = `Rewrite the following text to approximately grade ${targetGrade} reading level. Return ONLY valid JSON.

PRESERVE THESE TERMS EXACTLY (do not simplify): ${JSON.stringify(preserveJargon)}

ORIGINAL TEXT:
"""
${text.slice(0, 12_000)}
"""

SCHEMA:
{
  "rewritten": string,
  "originalGradeLevel": number|null,
  "newGradeLevel": number|null,
  "changes": [ string ]
}`;

    const response = await ai(prompt, {
      system: PLAIN_LANGUAGE_SYSTEM_PROMPT,
      maxTokens: 1500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Plain-language rewriting failed: model returned non-JSON output");
    }

    return { success: true, ...(parsed as object) };
  },
});
