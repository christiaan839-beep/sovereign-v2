import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * COMPETITOR-PRICE-MONITOR — Product + competitor prices → positioning + strategy recommendations.
 *
 * Takes a product description and a list of competitor prices (supplied by the
 * caller — no web scraping) and produces a price-range summary, a positioning
 * statement, concrete pricing actions, and risk flags. Never invents competitor
 * prices beyond what was provided.
 *
 * Input:
 *   product:       string                                                                  (required — NL description)
 *   competitors:   Array<{ name: string, estimatedPrice: number, source?: string }>        (required)
 *   currentPrice?: number                                                                  (your price, if known)
 *   strategy?:     "premium"|"match"|"undercut"                                            (positioning intent)
 *
 * Output (JSON):
 *   {
 *     priceRange: { low: number, median: number, high: number },
 *     positioning: string,
 *     recommendations: Array<{
 *       action: "raise"|"hold"|"lower"|"bundle"|"differentiate",
 *       rationale: string,
 *       expectedImpact: string
 *     }>,
 *     riskFlags: string[]
 *   }
 *
 * Pairs with:
 *   - `shopify-optimizer` — downstream, applies pricing moves to on-store UX
 *   - `market-analysis`  — upstream category context
 */

const PRICE_SYSTEM_PROMPT = `You are a pricing strategist. You reason rigorously from the data provided and flag uncertainty explicitly.

${ANTI_SLOP_RULES}

## PRICING RULES
1. NEVER fabricate competitor prices. Use ONLY the estimatedPrice values in the competitors[] input. If the list is empty or has only one entry, say so in riskFlags and still return the schema.
2. priceRange.low / median / high are computed from the provided competitor prices PLUS currentPrice (if given). Median for even-length arrays is the average of the two middle values.
3. positioning is a one-sentence statement (e.g. "Premium — 20% above category median, justified by X") that must be defensible from the data.
4. Recommendations MUST honor the user's stated strategy if provided. If strategy is "premium" you may not recommend "lower" as the primary action.
5. expectedImpact is qualitative and bounded (e.g. "Expect 5-12% volume lift with ~3% gross-margin compression"). NEVER single-number forecasts.
6. riskFlags list things a human MUST verify before acting (stale sample, small n, source reliability, currency mismatch, feature-set parity).
7. If competitors have source="unknown" or no source, flag that in riskFlags.
8. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

type Competitor = { name: string; estimatedPrice: number; source?: string };
type Strategy = "premium" | "match" | "undercut";

export const POST = createAgentRoute({
  name: "competitor-price-monitor",
  requiredFields: ["product", "competitors"],
  handler: async ({ input }) => {
    const {
      product,
      competitors,
      currentPrice,
      strategy,
    } = input as {
      product: string;
      competitors: Competitor[];
      currentPrice?: number;
      strategy?: Strategy;
    };

    const prompt = `Produce a competitive pricing report. Return ONLY valid JSON matching the schema.

PRODUCT:
"""
${product.slice(0, 4000)}
"""

CURRENT PRICE: ${currentPrice != null ? `$${currentPrice}` : "unspecified"}
STRATEGY INTENT: ${strategy ?? "unspecified"}

COMPETITORS (use ONLY these prices, do not invent others):
${JSON.stringify(competitors.slice(0, 50), null, 2)}

SCHEMA:
{
  "priceRange": { "low": number, "median": number, "high": number },
  "positioning": string,
  "recommendations": [
    {
      "action": "raise" | "hold" | "lower" | "bundle" | "differentiate",
      "rationale": string,
      "expectedImpact": string
    }
  ],
  "riskFlags": [ string ]
}`;

    const response = await ai(prompt, {
      system: PRICE_SYSTEM_PROMPT,
      maxTokens: 2500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Competitor price analysis failed: model returned non-JSON output");
    }

    return { success: true, report: parsed };
  },
});
