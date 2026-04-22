import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * SHOPIFY-OPTIMIZER — Store description → conversion-focused quick wins + A/B test ideas.
 *
 * Reads a natural-language description of a Shopify (or similar e-commerce) store
 * and returns prioritized conversion-rate optimizations bucketed by funnel stage
 * (homepage, product, cart, checkout, email), plus A/B test concepts and the
 * real-world caveats on any lift estimates.
 *
 * Input:
 *   storeDescription: string   (required — NL: what the store sells + current challenges)
 *   monthlyRevenue?:  number   (helps calibrate effort-vs-impact)
 *   primaryProduct?:  string   (sharpens product-page suggestions)
 *
 * Output (JSON):
 *   {
 *     quickWins: Array<{
 *       area: "homepage"|"product"|"cart"|"checkout"|"email",
 *       change: string,
 *       expectedLift: string,      // range, e.g. "5-15%"
 *       effort: "low"|"medium"|"high"
 *     }>,
 *     abTestIdeas: string[],
 *     benchmarksCaveats: string[]
 *   }
 *
 * Pairs with:
 *   - `competitor-price-monitor` — upstream price-positioning context
 *   - `ad-report` — downstream ad-spend efficiency pass
 */

const SHOPIFY_SYSTEM_PROMPT = `You are a conversion rate optimization specialist with deep Shopify experience. You recommend changes that move needles — not cosmetic polish.

${ANTI_SLOP_RULES}

## CRO RULES
1. NEVER fabricate specific lift numbers. Always use ranges (e.g. "5-15%", "2-8%") AND include the corresponding caveat in benchmarksCaveats (e.g. "Lift ranges are industry estimates from Baymard / Shopify benchmarks — your actual lift depends on baseline conversion rate and traffic quality").
2. Quick wins are things a small team can ship in ≤1 sprint. Anything multi-sprint should NOT appear as a quick win.
3. "change" is imperative and specific (e.g. "Add real customer reviews with photos above the add-to-cart button", not "improve social proof").
4. Effort rating:
   - low   = config change or copy swap, no eng required
   - medium = theme tweak, possible eng support
   - high  = new app integration, custom code, or data work
5. abTestIdeas MUST be formulated as falsifiable hypotheses (e.g. "Showing live-viewer count on product pages increases add-to-cart rate by at least 5% for bestsellers").
6. If monthlyRevenue is provided, prioritize wins by absolute-dollar impact, not percentage alone.
7. Do NOT recommend dark patterns (fake countdowns, fake stock scarcity, forced account creation).
8. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "shopify-optimizer",
  requiredFields: ["storeDescription"],
  handler: async ({ input }) => {
    const {
      storeDescription,
      monthlyRevenue,
      primaryProduct,
    } = input as {
      storeDescription: string;
      monthlyRevenue?: number;
      primaryProduct?: string;
    };

    const prompt = `Analyze this e-commerce store and produce prioritized conversion optimization suggestions. Return ONLY valid JSON matching the schema.

STORE DESCRIPTION:
"""
${storeDescription.slice(0, 8000)}
"""
MONTHLY REVENUE: ${monthlyRevenue != null ? `$${monthlyRevenue}` : "unspecified"}
PRIMARY PRODUCT: ${primaryProduct ?? "unspecified"}

SCHEMA:
{
  "quickWins": [
    {
      "area": "homepage" | "product" | "cart" | "checkout" | "email",
      "change": string,
      "expectedLift": string,
      "effort": "low" | "medium" | "high"
    }
  ],
  "abTestIdeas": [ string ],
  "benchmarksCaveats": [ string ]
}`;

    const response = await ai(prompt, {
      system: SHOPIFY_SYSTEM_PROMPT,
      maxTokens: 2500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Shopify optimization failed: model returned non-JSON output");
    }

    return { success: true, optimization: parsed };
  },
});
