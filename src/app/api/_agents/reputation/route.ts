import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";

const REPUTATION_PROMPT = `You are a reputation management specialist who protects and grows business reputations online. You handle Google reviews, Yelp reviews, and social mentions with surgical precision.

${ANTI_SLOP_RULES}

## REVIEW RESPONSE RULES
1. **Positive reviews (4-5 stars)**: Thank them personally (use their name), reference something specific they mentioned, invite them back with a specific offer or next step.
2. **Neutral reviews (3 stars)**: Acknowledge the feedback, address the specific concern, explain what you're doing to improve, invite them to return.
3. **Negative reviews (1-2 stars)**: Start with empathy (NOT "we're sorry you feel that way"), take ownership, explain the fix, offer to make it right privately (phone/email), close with commitment to improvement.
4. **Fake/competitor reviews**: Professional but firm, state facts, invite genuine contact to resolve.

## TONE RULES
- Never defensive, never robotic, never generic
- Use the reviewer's name
- Reference their specific experience
- Keep responses 50-150 words
- Sound like a real human owner who genuinely cares`;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { action } = await req.json();

    if (action === "respond") {
      const body = await req.json().catch(() => ({}));
      const { reviewerName, rating, reviewText, businessName, businessType } = body;

      const prompt = `Generate a professional response to this review:

BUSINESS: ${businessName || "Our Business"}
BUSINESS TYPE: ${businessType || "Local Service Business"}
REVIEWER: ${reviewerName || "A Customer"}
RATING: ${rating || 5}/5 stars
REVIEW: "${reviewText || "Great service!"}"

Write ONLY the response text. No explanations, no options — just the response.`;

      const response = await ai(prompt, { system: REPUTATION_PROMPT, maxTokens: 300 });

      return NextResponse.json({ success: true, response: response.trim() });
    }

    if (action === "analyze") {
      const body = await req.json().catch(() => ({}));
      const { reviews, businessName } = body;

      const prompt = `Analyze these reviews for ${businessName || "our business"} and provide a reputation intelligence report:

REVIEWS:
${(reviews || []).map((r: { name: string; rating: number; text: string }) => `- ${r.name} (${r.rating}★): "${r.text}"`).join("\n")}

Respond in JSON:
{
  "overallSentiment": "positive|neutral|negative",
  "averageRating": 4.2,
  "commonPraises": ["Theme 1", "Theme 2"],
  "commonComplaints": ["Issue 1", "Issue 2"],
  "competitorMentions": [],
  "urgentIssues": ["Any issues that need immediate attention"],
  "recommendations": ["Action 1", "Action 2", "Action 3"],
  "responseTemplates": {
    "positive": "Template for positive reviews",
    "neutral": "Template for neutral reviews",
    "negative": "Template for negative reviews"
  }
}`;

      const result = await ai(prompt, { system: REPUTATION_PROMPT, maxTokens: 2000 });

      let parsed;
      try {
        const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { analysis: result };
      }

      await fireUserWebhook("Reputation", "Analyzed", { businessName, reviewCount: (reviews || []).length });

      return NextResponse.json({ success: true, analysis: parsed });
    }

    if (action === "generate-request") {
      const body = await req.json().catch(() => ({}));
      const { customerName, businessName, platform } = body;

      const prompt = `Write a short, warm message asking ${customerName || "a customer"} to leave a review for ${businessName || "our business"} on ${platform || "Google"}.

Rules:
- Max 3 sentences
- Reference their recent experience (leave it slightly vague so it can apply broadly)
- Include a direct link placeholder: [REVIEW_LINK]
- Sound personal, not automated
- Don't be pushy`;

      const message = await ai(prompt, { system: REPUTATION_PROMPT, maxTokens: 200 });

      return NextResponse.json({ success: true, message: message.trim() });
    }

    return NextResponse.json({ error: "Invalid action. Use: respond, analyze, generate-request" }, { status: 400 });
  } catch (err) {
    console.error("[Reputation] Error:", err);
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}
