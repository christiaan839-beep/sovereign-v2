import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";

/**
 * Outbound Engine API
 * Generates personalized cold outreach sequences (email + LinkedIn + DM).
 */

const OUTBOUND_PROMPT = `You are an elite B2B outbound sales specialist. You write cold outreach that gets replies, not spam complaints.

${ANTI_SLOP_RULES}

## OUTBOUND RULES
1. Subject lines: Max 5 words, lowercase, curiosity-driven
2. Opening line: Reference something specific about the prospect (never "I hope this finds you well")
3. Value prop in 1 sentence — what result you deliver, not what you do
4. Social proof: 1 specific result (client name + metric)
5. CTA: Single, low-friction ask (never "jump on a call")
6. Total email length: 50-80 words max
7. Follow-ups get progressively shorter
8. Never use "touching base" or "circling back"`;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { prospectName, prospectCompany, prospectIndustry, yourOffer, yourProof, channels, sequenceLength } = await req.json();

    const prompt = `Generate a ${sequenceLength || 5}-step cold outreach sequence for:

PROSPECT: ${prospectName || "Decision Maker"} at ${prospectCompany || "Target Company"}
INDUSTRY: ${prospectIndustry || "B2B Services"}
YOUR OFFER: ${yourOffer || "AI-powered marketing automation"}
YOUR PROOF: ${yourProof || "Helped 50+ businesses increase leads by 300%"}
CHANNELS: ${(channels || ["email"]).join(", ")}

For EACH step, generate:
1. CHANNEL: Email, LinkedIn message, or DM
2. TIMING: Day number and time
3. SUBJECT (for email): Max 5 words
4. FULL MESSAGE: Complete, ready-to-send text
5. FOLLOW-UP TRIGGER: What determines if you send next step

Respond in JSON:
{
  "sequence": [
    {
      "step": 1,
      "channel": "email",
      "dayNumber": 1,
      "timing": "Tuesday 9:15 AM",
      "subject": "quick q about [company]",
      "message": "Full message text",
      "followUpTrigger": "No reply within 3 days"
    }
  ],
  "overallStrategy": "Brief description of the sequence psychology"
}`;

    const result = await ai(prompt, { system: OUTBOUND_PROMPT, maxTokens: 3000 });

    let parsed;
    try {
      const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { sequence: [], rawOutput: result };
    }

    await fireUserWebhook("Outbound", "SequenceGenerated", { prospectCompany, steps: parsed.sequence?.length });

    return NextResponse.json({ success: true, ...parsed });
  } catch (err) {
    console.error("[Outbound] Error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
