import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * REFACTOR-SUGGESTER — Code snippet → prioritized refactor suggestions with risk assessment.
 *
 * Reads a code snippet and produces concrete refactor suggestions (extract function,
 * rename, simplify, split, consolidate, apply pattern) with before/after diffs and
 * a per-suggestion risk rating. Intended to augment — not replace — human code review.
 *
 * Input:
 *   code:     string                                                        (required)
 *   language: "typescript"|"javascript"|"python"|"go"|"rust"|"java"         (required)
 *   goal?:    "readability"|"performance"|"testability"|"security"          (default "readability")
 *
 * Output (JSON):
 *   {
 *     suggestions: Array<{
 *       type: "extract-function"|"rename"|"simplify"|"split"|"consolidate"|"pattern",
 *       description: string,
 *       before: string,
 *       after: string,
 *       risk: "low"|"medium"|"high",
 *       breaksTests: boolean
 *     }>,
 *     overallPriority: string[]
 *   }
 *
 * Pairs with:
 *   - `code-reviewer` — upstream reviewer that may surface refactor opportunities
 *   - `documentation-writer` — downstream doc pass on refactored output
 */

const REFACTOR_SYSTEM_PROMPT = `You are a staff engineer conducting a surgical refactor review. You suggest concrete, minimal, reversible changes — never rewrites for their own sake.

${ANTI_SLOP_RULES}

## REFACTOR RULES
1. NEVER fabricate refactors that require changes OUTSIDE the provided snippet unless explicitly marked in the description (e.g. "requires updating caller in X").
2. Every suggestion MUST include real before/after excerpts pulled from the snippet — no placeholder code.
3. Rate risk honestly: "low" = purely local change; "medium" = may affect callers in the snippet; "high" = likely changes behavior or public contract.
4. breaksTests=true whenever a behavioral change is possible, even subtly. Be pessimistic here.
5. Respect the stated goal — a "performance" goal should not produce readability-only suggestions.
6. overallPriority ranks suggestion descriptions from highest-impact to lowest — use the exact description strings.
7. If the code is already clean for the stated goal, return suggestions=[] and overallPriority=[] — don't invent churn.
8. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

type Language = "typescript" | "javascript" | "python" | "go" | "rust" | "java";
type Goal = "readability" | "performance" | "testability" | "security";

export const POST = createAgentRoute({
  name: "refactor-suggester",
  requiredFields: ["code", "language"],
  handler: async ({ input }) => {
    const {
      code,
      language,
      goal = "readability",
    } = input as {
      code: string;
      language: Language;
      goal?: Goal;
    };

    const prompt = `Analyze this ${language} snippet and suggest refactors optimized for ${goal}. Return ONLY valid JSON matching the schema.

LANGUAGE: ${language}
GOAL: ${goal}

CODE:
\`\`\`${language}
${code.slice(0, 15_000)}
\`\`\`

SCHEMA:
{
  "suggestions": [
    {
      "type": "extract-function" | "rename" | "simplify" | "split" | "consolidate" | "pattern",
      "description": string,
      "before": string,
      "after": string,
      "risk": "low" | "medium" | "high",
      "breaksTests": boolean
    }
  ],
  "overallPriority": [ string ]
}`;

    const response = await ai(prompt, {
      system: REFACTOR_SYSTEM_PROMPT,
      maxTokens: 3000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Refactor suggestion failed: model returned non-JSON output");
    }

    return { success: true, refactor: parsed };
  },
});
