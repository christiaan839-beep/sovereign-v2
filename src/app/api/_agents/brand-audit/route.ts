import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { research_ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";

/**
 * Brand Audit Agent API
 * Analyzes a competitor's brand via live web research and generates
 * a counter-positioning strategy. Fills the biggest gap vs Bloodline.
 */

const BRAND_SYSTEM = `You are an elite brand strategist with 20 years experience at agencies like Pentagram, Collins, and vandenbusken. You identify brand positioning gaps and create counter-strategies.

${ANTI_SLOP_RULES}`;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { competitorUrl, competitorName, yourBusiness, industry } = await req.json();

    if (!competitorUrl && !competitorName) {
      return NextResponse.json(
        { error: "Missing required: competitorUrl or competitorName" },
        { status: 400 }
      );
    }

    const result = await research_ai(
      `${competitorUrl || competitorName} brand identity positioning strategy values tagline`,
      `Conduct a comprehensive brand audit and generate a counter-positioning strategy.

COMPETITOR: ${competitorName || competitorUrl}
COMPETITOR URL: ${competitorUrl || "Not provided"}
YOUR BUSINESS: ${yourBusiness || "AI marketing platform"}
INDUSTRY: ${industry || "Marketing technology"}

Provide a detailed brand audit in this JSON format:
{
  "competitorBrand": {
    "name": "${competitorName || 'Unknown'}",
    "tagline": "Their current tagline/positioning",
    "brandVoice": "Professional/Casual/Bold/Corporate etc",
    "visualIdentity": {
      "primaryColors": ["#hex1", "#hex2"],
      "typography": "Font families they use",
      "style": "Minimalist/Luxury/Playful/etc"
    },
    "values": ["Value 1", "Value 2", "Value 3"],
    "targetAudience": "Who they target",
    "emotionalAppeal": "What emotion their brand evokes"
  },
  "strengthsWeaknesses": {
    "brandStrengths": ["Strength 1", "Strength 2"],
    "brandWeaknesses": ["Weakness 1", "Weakness 2"],
    "positioningGaps": ["Gap 1 you can exploit", "Gap 2"]
  },
  "counterStrategy": {
    "recommendedPositioning": "How to position against them",
    "suggestedTagline": "Your counter-tagline",
    "brandVoice": "Recommended tone/voice for your brand",
    "keyMessages": ["Message 1", "Message 2", "Message 3"],
    "visualDirection": {
      "suggestedColors": ["#hex1", "#hex2"],
      "suggestedFonts": "Recommended font pairing",
      "moodBoard": "Visual direction description"
    }
  },
  "actionPlan": [
    { "action": "Specific action to take", "priority": "HIGH/MEDIUM/LOW", "impact": "Expected impact" }
  ]
}

Return ONLY valid JSON.`,
      {
        model: "gemini",
        system: BRAND_SYSTEM,
        maxTokens: 3000,
      }
    );

    let parsed;
    try {
      const match = result.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : result);
    } catch {
      parsed = { raw: result };
    }

    await fireUserWebhook("Brand Audit", "Analysis Complete", parsed);

    return NextResponse.json({
      success: true,
      agent: "brand-audit",
      result: parsed,
      raw: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Brand Audit Error]:", message);
    return NextResponse.json({ error: "Brand audit failed", details: message }, { status: 500 });
  }
}
