import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { adCreatives } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ai } from "@/lib/ai";
import { fireUserWebhook } from "@/lib/webhooks";

const AD_CREATOR_PROMPT = `You are SOVEREIGN's elite Performance Creative Strategist — trained on $50M+ in ad spend data across Meta, TikTok, Google, and LinkedIn.

You generate ads that agencies charge $5,000-$15,000 to produce. Your creatives consistently achieve 3-8x ROAS.

## CREATIVE FRAMEWORK
Generate exactly 5 ad creative variations, each using a DIFFERENT proven psychological hook:

1. **PAIN → SOLUTION** (PAS Framework)
   - Agitate the #1 pain point brutally, then present the business as the inevitable solution.
   - Opening line must trigger an emotional "that's exactly me" reaction.

2. **SOCIAL PROOF / AUTHORITY**
   - Lead with results, metrics, or credentials.
   - Use specific numbers (not "many clients" but "847% ROI increase").

3. **URGENCY / SCARCITY**
   - Create time-pressure or exclusivity. Limited spots, deadline, or one-time offer.
   - Must feel authentic, not manipulative.

4. **CURIOSITY GAP**
   - Open a loop in the first line that DEMANDS a click to close.
   - Never reveal the full answer in the ad itself.

5. **DIRECT BENEFIT / TRANSFORMATION**
   - Lead with the measurable outcome the customer will experience.
   - Use before/after framing. Be specific and vivid.

## COPYWRITING RULES
- First line MUST stop the scroll. No generic openings. Ever.
- Write like a human, not a brand. Use contractions, direct address ("you").
- Headlines: max 40 characters. Punchy. Memorable.
- Primary text: 2-3 short paragraphs max. No walls of text.
- Every ad must end with ONE clear CTA.
- Match the platform's native tone (TikTok = casual, LinkedIn = professional).

Respond in this exact JSON format:
{
  "creatives": [
    {
      "headline": "Max 40 chars — the scroll-stopper",
      "primaryText": "The full ad body text (2-3 punchy paragraphs)",
      "callToAction": "Book Now | Learn More | Get Started | Sign Up",
      "hook": "The exact opening line that stops the scroll",
      "style": "pain-solution | social-proof | urgency | curiosity | direct-benefit",
      "targetAudience": "Specific audience micro-segment this ad targets"
    }
  ]
}`;

export async function GET() {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const creatives = await db.query.adCreatives.findMany({
      where: eq(adCreatives.userEmail, user.primaryEmailAddress.emailAddress),
      orderBy: (c, { desc }) => [desc(c.createdAt)]
    });
    return NextResponse.json({ creatives });
  } catch (err) {
    console.error("GET /api/agents/ads error:", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { businessDescription, targetAudience, platform, tone } = await req.json();

    const prompt = `Generate 5 high-converting ${platform || "Meta"} ad creatives for this business:

BUSINESS: ${businessDescription}
TARGET AUDIENCE: ${targetAudience}
PLATFORM: ${platform || "Meta (Facebook/Instagram)"}
TONE: ${tone || "Professional but bold"}

Generate the creatives now.`;

    const result = await ai(prompt, { system: AD_CREATOR_PROMPT, maxTokens: 4000 });
    
    let parsed;
    try {
      const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { creatives: [], rawOutput: result };
    }

    // Save all creatives to database
    if (parsed.creatives?.length > 0) {
      for (const creative of parsed.creatives) {
        await db.insert(adCreatives).values({
          userEmail: user.primaryEmailAddress.emailAddress,
          platform: platform || "meta",
          headline: creative.headline,
          primaryText: creative.primaryText,
          callToAction: creative.callToAction || "Learn More",
          targetAudience: creative.targetAudience || targetAudience,
          hook: creative.hook,
          style: creative.style || "direct-response",
        });
      }
    }

    await fireUserWebhook("AdCreator", "CreativesGenerated", {
      count: parsed.creatives?.length || 0,
      platform: platform || "meta",
      businessDescription
    });

    return NextResponse.json({ success: true, ...parsed });
  } catch (err) {
    console.error("POST /api/agents/ads error:", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
