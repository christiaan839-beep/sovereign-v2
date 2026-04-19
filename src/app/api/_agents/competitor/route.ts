import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";
import { withSelfHeal } from "@/lib/self-heal";
import { z } from "zod";

/**
 * Competitor Intel API
 * Deep competitive analysis using AI to identify weaknesses and opportunities.
 *
 * Self-heal: if the model returns an object missing `competitorProfile`
 * or `battlePlan` (happens on ambiguous/too-short inputs), the
 * diagnoser proposes a clearer business + industry combination.
 */

const INPUT_SCHEMA = z.object({
  competitorUrl: z.string().max(500).optional(),
  competitorName: z.string().max(200).optional(),
  yourBusiness: z.string().max(500).optional(),
  industry: z.string().max(200).optional(),
  prompt: z.string().max(5000).optional(),
}).passthrough();

const COMPETITOR_PROMPT = `You are a competitive intelligence analyst. You identify market vulnerabilities and actionable opportunities.

${ANTI_SLOP_RULES}

## ANALYSIS FRAMEWORK
Use Porter's Five Forces + Blue Ocean Strategy to identify:
1. Direct competitor weaknesses
2. Indirect competitor threats
3. Market gaps nobody is filling
4. Pricing arbitrage opportunities
5. Messaging vulnerabilities`;

export const POST = createAgentRoute({
  name: "competitor",
  handler: withSelfHeal(async ({ input }) => {
    const { competitorUrl, competitorName, yourBusiness, industry } = input as Record<string, unknown>;

    const prompt = `Conduct a deep competitive intelligence analysis:

COMPETITOR: ${competitorName || competitorUrl || "Unknown"}
COMPETITOR URL: ${competitorUrl || "Not provided"}
YOUR BUSINESS: ${yourBusiness || "AI marketing platform"}
INDUSTRY: ${industry || "Marketing technology"}

Provide a comprehensive analysis in JSON:
{
  "competitorProfile": {
    "name": "...",
    "estimatedSize": "...",
    "targetMarket": "...",
    "pricingModel": "...",
    "estimatedRevenue": "..."
  },
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "weaknesses": [
    { "weakness": "...", "howToExploit": "...", "urgency": "HIGH/MEDIUM/LOW" }
  ],
  "marketGaps": [
    { "gap": "...", "opportunity": "...", "estimatedValue": "..." }
  ],
  "messagingAnalysis": {
    "theirPositioning": "...",
    "vulnerabilities": ["..."],
    "superiorPositioning": "How you should position against them"
  },
  "pricingIntelligence": {
    "theirPricing": "...",
    "pricingWeakness": "...",
    "recommendedStrategy": "..."
  },
  "battlePlan": {
    "immediate": ["Action 1", "Action 2"],
    "shortTerm": ["Action 1", "Action 2"],
    "longTerm": ["Action 1", "Action 2"]
  }
}`;

    const result = await ai(prompt, { system: COMPETITOR_PROMPT, maxTokens: 3000 });

    let parsed: Record<string, unknown>;
    try {
      const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Model returned non-JSON competitor analysis");
    }

    // Self-heal trigger: battlePlan is the highest-signal field for
    // "did the analysis actually complete". If it's missing we ask the
    // diagnoser to reformulate rather than returning a partial object.
    if (!parsed.battlePlan && !parsed.competitorProfile) {
      throw new Error("Analysis missing required sections (battlePlan/competitorProfile)");
    }

    await fireUserWebhook("CompetitorIntel", "Analyzed", { competitorName: competitorName || competitorUrl });

    return { success: true, intel: parsed };
  }, { label: "competitor", maxRetries: 1, inputSchema: INPUT_SCHEMA }),
});
