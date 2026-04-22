import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * REVIEW-ANALYZER — Analyze a batch of G2 / Trustpilot / Google /
 * Amazon reviews into sentiment, themes, urgent issues, and draft
 * public responses.
 *
 * Input:
 *   {
 *     reviews: Array<{
 *       rating:  number,
 *       text:    string,
 *       source?: string,
 *       author?: string
 *     }>
 *   }
 *
 * Output (JSON):
 *   {
 *     overallSentiment:  "positive" | "mixed" | "negative",
 *     averageRating:     number,
 *     themes: {
 *       positive: string[],
 *       negative: string[]
 *     },
 *     urgentIssues:      string[],
 *     draftResponses:    Record<string, string>
 *   }
 *
 * Pairs with:
 *   - `customer-support:draft-response` — downstream human response
 */

const REVIEW_SYSTEM_PROMPT = `You are a senior customer-experience specialist turning raw review batches into actionable intelligence.

${ANTI_SLOP_RULES}

## ANALYSIS RULES
1. NEVER use empty hedges like "we're sorry you feel that way" — always acknowledge the specific issue the reviewer raised.
2. Draft responses must be under 80 words, specific to the reviewer's complaint, and MUST NOT promise refunds, credits, or policy changes unless the reviewer explicitly quoted that context.
3. urgentIssues flags anything involving: safety, fraud, injury, legal threats, data breaches, or regulatory non-compliance. If none, return empty array — do NOT invent urgency.
4. Themes are surface-level patterns across >=2 reviews. For a single review, put the observation in draftResponses, not in themes.
5. Key of draftResponses = author name (or "review-N" fallback indexed from the input array).
6. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "review-analyzer",
  requiredFields: ["reviews"],
  handler: async ({ input }) => {
    const { reviews } = input as {
      reviews: Array<{ rating: number; text: string; source?: string; author?: string }>;
    };

    if (!Array.isArray(reviews) || reviews.length === 0) {
      throw new Error("Review analysis failed: reviews must be a non-empty array");
    }

    const formatted = reviews
      .slice(0, 50)
      .map((r, i) => {
        const who = r.author ?? `review-${i + 1}`;
        const src = r.source ? ` (${r.source})` : "";
        return `[${who}]${src} ${r.rating}/5: ${String(r.text).slice(0, 1_200)}`;
      })
      .join("\n\n");

    const prompt = `Analyze these reviews. Return ONLY valid JSON.

REVIEWS:
${formatted}

SCHEMA:
{
  "overallSentiment": "positive" | "mixed" | "negative",
  "averageRating": number,
  "themes": { "positive": [ string ], "negative": [ string ] },
  "urgentIssues": [ string ],
  "draftResponses": { "<authorOrId>": string }
}`;

    const response = await ai(prompt, {
      system: REVIEW_SYSTEM_PROMPT,
      maxTokens: 2500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Review analysis failed: model returned non-JSON output");
    }

    return { success: true, result: parsed };
  },
});
