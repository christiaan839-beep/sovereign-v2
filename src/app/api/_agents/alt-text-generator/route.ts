import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * ALT-TEXT-GENERATOR — WCAG-compliant alt text from a visual description.
 *
 * Input:
 *   { description: string, context?: string, purpose?: "decorative"|"informative"|"functional" }
 *
 * Output (JSON):
 *   { altText: string, decision: "null"|"empty"|"descriptive", rationale: string }
 */

const ALT_TEXT_SYSTEM_PROMPT = `You are an accessibility specialist who writes WCAG 2.1 AA-compliant alt text.

${ANTI_SLOP_RULES}

## DECISION RULES
- Decorative images → altText = "" and decision = "empty". These images add no information.
- Functional images (buttons, links) → altText describes the ACTION, not the picture ("Submit form" not "Arrow icon"). decision = "descriptive".
- Informative images → altText concisely describes the content, max 125 characters. decision = "descriptive".
- If the image would be better served by a longer surrounding description, return altText = null and decision = "null".

## WRITING RULES
1. NEVER start with "Image of", "Picture of", "Photo of", "Graphic of" — screen readers already announce it's an image.
2. Lead with the most important information.
3. Use present tense. Be specific. Avoid speculation about emotions unless clearly conveyed.
4. For charts/diagrams, convey the key takeaway, not every data point.
5. Output VALID JSON only — no markdown fences, no prose outside the JSON.`;

export const POST = createAgentRoute({
  name: "alt-text-generator",
  requiredFields: ["description"],
  handler: async ({ input }) => {
    const { description, context, purpose } = input as {
      description: string;
      context?: string;
      purpose?: string;
    };

    const prompt = `Generate WCAG-compliant alt text. Return ONLY valid JSON.

IMAGE DESCRIPTION:
"""
${description.slice(0, 4_000)}
"""

CONTEXT: ${context ? JSON.stringify(context.slice(0, 500)) : "unspecified"}
PURPOSE: ${purpose ?? "unspecified — infer from description"}

SCHEMA:
{
  "altText": string,
  "decision": "null" | "empty" | "descriptive",
  "rationale": string
}`;

    const response = await ai(prompt, {
      system: ALT_TEXT_SYSTEM_PROMPT,
      maxTokens: 1500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Alt-text generation failed: model returned non-JSON output");
    }

    return { success: true, ...(parsed as object) };
  },
});
