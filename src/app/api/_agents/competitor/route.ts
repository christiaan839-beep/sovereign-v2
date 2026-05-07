import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";

/**
 * Competitor Intel API
 * Deep competitive analysis using AI to identify weaknesses and opportunities.
 */

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
  handler: async ({ input }) => {
    const { competitorUrl, competitorName, yourBusiness, industry } = input as Record<string, any>;

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

    let parsed;
    try {
      const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { analysis: result };
    }

    await fireUserWebhook("CompetitorIntel", "Analyzed", { competitorName: competitorName || competitorUrl });

    return { success: true, intel: parsed };
  },
});
