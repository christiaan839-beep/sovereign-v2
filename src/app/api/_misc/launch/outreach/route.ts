import { NextResponse } from "next/server";
import { vertex as google } from "@ai-sdk/google-vertex";
import { generateText } from "ai";
import { db } from "@/db";
import { globalTelemetry } from "@/db/schema";
import { requireAuth } from "@/lib/auth-guard";

/**
 * Launch Outreach API
 * 
 * Generates personalized cold outreach emails for potential clients
 * using Gemini 2.5 Pro. Each email is tailored to the prospect's
 * industry and pain points.
 */
export async function POST(req: Request) {
  const auth = await requireAuth(); if (auth.error) return auth.error;
  try {
    const { prospectName, businessName, industry, website, painPoints } = await req.json();

    if (!prospectName || !businessName) {
      return NextResponse.json({ error: "Missing prospectName or businessName" }, { status: 400 });
    }

    const { text: emailContent } = await generateText({
      model: google("gemini-2.5-pro"),
      prompt: `You are a world-class B2B sales copywriter working for SOVEREIGN, an autonomous AI marketing platform. Write a personalized cold outreach email.

PROSPECT: ${prospectName}
BUSINESS: ${businessName}
INDUSTRY: ${industry || "General"}
WEBSITE: ${website || "Unknown"}
PAIN POINTS: ${painPoints || "Marketing ROI, scaling, automation, content creation"}

Write a cold email that:
1. Opens with a specific observation about their business (not generic flattery)
2. Identifies ONE specific problem they likely face
3. Shows how SOVEREIGN solves it (with a specific metric or example)
4. Ends with a low-commitment CTA (free AI scan, not a call)
5. Is under 120 words — brevity is premium

Format as JSON:
{
  "subject": "...",
  "body": "...",
  "followUp": "..." (a 2-sentence follow-up for 3 days later)
}

Output ONLY the JSON.`,
    });

    let parsed;
    try {
      const cleaned = emailContent.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { subject: "SOVEREIGN for your business", body: emailContent, followUp: "Following up on my previous email." };
    }

    await db.insert(globalTelemetry).values({
      tenantId: "system",
      eventType: "outreach_email_generated",
      payload: JSON.stringify({ prospectName, businessName, industry }),
    });

    return NextResponse.json({ success: true, email: parsed });
  } catch (error) {
    console.error("[Launch Outreach Error]:", error);
    return NextResponse.json({ error: "Outreach generation failed" }, { status: 500 });
  }
}
