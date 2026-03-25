import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";

/**
 * Competitor Intel API
 * Deep competitive analysis using AI to identify weaknesses and opportunities.
 */

const COMPETITOR_PROMPT = `You are an elite competitive intelligence analyst. You identify market vulnerabilities and actionable opportunities.

${ANTI_SLOP_RULES}

## ANALYSIS FRAMEWORK
Use Porter's Five Forces + Blue Ocean Strategy to identify:
1. Direct competitor weaknesses
2. Indirect competitor threats
3. Market gaps nobody is filling
4. Pricing arbitrage opportunities
5. Messaging vulnerabilities`;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { competitorUrl, competitorName, yourBusiness, industry } = await req.json();

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

    return NextResponse.json({ success: true, intel: parsed });
  } catch (err) {
    console.error("[Competitor Intel] Error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
