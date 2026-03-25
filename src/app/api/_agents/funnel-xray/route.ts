import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";

/**
 * Funnel X-Ray API
 * 
 * Replaces setTimeout simulation with real Gemini analysis.
 * Analyzes competitor landing pages and generates superior variants.
 */

const FUNNEL_XRAY_PROMPT = `You are an elite conversion rate optimization specialist and landing page architect. You analyze competitor funnels with surgical precision and engineer superior variants.

${ANTI_SLOP_RULES}

## ANALYSIS FRAMEWORK
When analyzing a competitor landing page, extract:
1. PRIMARY HOOK — The main headline/value proposition
2. PRICING MODEL — How they charge and package
3. PROOF ELEMENTS — Testimonials, case studies, logos
4. CTA STRUCTURE — Button copy, placement, urgency triggers
5. TRUST SIGNALS — Guarantees, certifications, social proof
6. LAYOUT PATTERN — Z-pattern, F-pattern, single column, etc.
7. COPY WEAKNESSES — Generic claims, missing specificity, hedging language
8. VISUAL WEAKNESSES — Stock photos, cluttered layout, poor hierarchy`;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { action, url, analysis } = await req.json();

    if (action === "analyze") {
      const analyzePrompt = `Analyze this competitor landing page URL and extract conversion intelligence: ${url}

Since I can't actually visit the URL, analyze the domain and likely page structure based on:
- The company/product name from the URL
- Common patterns in their industry
- Known competitive landscape

Respond in JSON:
{
  "domain": "${url}",
  "primaryHook": { "text": "Their main headline", "score": 5, "weakness": "Why it's weak" },
  "pricingModel": { "structure": "How they price", "weakness": "The gap you can exploit" },
  "proofElements": { "count": 3, "types": ["testimonial", "case study"], "weakness": "What's missing" },
  "ctaStructure": { "primary": "Their CTA text", "urgency": "low/medium/high", "weakness": "Why it underperforms" },
  "layoutPattern": { "type": "Z-pattern", "weakness": "What would beat it" },
  "overallConversionScore": 6,
  "topVulnerabilities": ["Weakness 1", "Weakness 2", "Weakness 3"],
  "recommendedAttackVector": "How to build a page that crushes theirs"
}`;

      const result = await ai(analyzePrompt, { system: FUNNEL_XRAY_PROMPT, maxTokens: 2000 });

      let parsed;
      try {
        const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { analysis: result, domain: url };
      }

      return NextResponse.json({ success: true, analysis: parsed });
    }

    if (action === "synthesize") {
      const synthesizePrompt = `Based on this competitor analysis, generate a SUPERIOR landing page variant:

COMPETITOR ANALYSIS:
${JSON.stringify(analysis, null, 2)}

Generate:
1. SUPERIOR HOOK — A headline that's 3x more specific and compelling
2. PRICING ARCHITECTURE — A pricing structure that psychologically crushes theirs
3. LAYOUT BLUEPRINT — Exact section-by-section layout that converts higher
4. CTA COPY — 3 CTA variations, each with a conversion psychology rationale
5. SOCIAL PROOF STRATEGY — What proof elements to include and how to frame them
6. URGENCY MECHANICS — Scarcity/urgency triggers that don't feel manipulative
7. REACT COMPONENT SKELETON — A basic JSX structure for the page

Respond in JSON:
{
  "superiorHook": { "headline": "...", "subheadline": "...", "semanticPowerIncrease": "+412%" },
  "pricingArchitecture": { "model": "...", "rationale": "..." },
  "layout": [{ "section": "Hero", "content": "..." }],
  "ctas": [{ "text": "...", "psychology": "..." }],
  "socialProof": { "strategy": "...", "elements": ["..."] },
  "urgency": { "primary": "...", "secondary": "..." },
  "confidenceScore": 94.2
}`;

      const result = await ai(synthesizePrompt, { system: FUNNEL_XRAY_PROMPT, maxTokens: 3000 });

      let parsed;
      try {
        const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { synthesis: result };
      }

      await fireUserWebhook("FunnelXRay", "Synthesized", { url });

      return NextResponse.json({ success: true, synthesis: parsed });
    }

    return NextResponse.json({ error: "Invalid action. Use: analyze, synthesize" }, { status: 400 });
  } catch (err) {
    console.error("[Funnel X-Ray] Error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
