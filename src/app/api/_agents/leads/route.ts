import { NextResponse } from "next/server";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";
import { requireAuth } from "@/lib/auth-guard";

export async function POST(req: Request) {
  const auth = await requireAuth(); 
  if (auth.error) return auth.error;

  try {
    const { action, params } = await req.json();

    if (action === "prospect") {
      const { niche, location } = params;
      
      if (!niche || !location) {
        return NextResponse.json({ error: "Missing niche or location" }, { status: 400 });
      }

      const prompt = `You are an elite B2B prospector and outreach specialist. 
I need you to generate 3 realistic, highly-targeted local business prospects for the following sector and location:

NICHE: ${niche}
LOCATION: ${location}

For each prospect, identify a plausible but severe marketing gap (e.g., missing Schema, slow site, terrible GBP reviews, no organic traffic). Then, write a hyper-personalized, ultra-short cold email that calls out this gap and offers to fix it.

${ANTI_SLOP_RULES}

Return EXACTLY this JSON structure, and nothing else:
{
  "reports": [
    {
      "business_name": "Example Roofers LLC",
      "website": "exampleroofers.com",
      "detected_gap": "Terrible GBP reviews and no service-area schema.",
      "cold_email_subject": "Quick question about your Google Maps reviews",
      "cold_email_body": "Hey, noticed you're dropping in the local pack because of a few uncaught negative reviews last month. We help roofers in [Location] flip those and inject Schema so you show up #1. Open to a quick chat?"
    }
  ]
}`;

      const text = await ai(prompt, { model: "gemini", maxTokens: 2500 });
      
      let parsed;
      try {
        const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        console.error("Failed to parse prospector AI output:", text);
        return NextResponse.json({ error: "AI returned invalid structure." }, { status: 500 });
      }

      await fireUserWebhook("Leads", "Sweep Completed", { niche, location, count: parsed.reports?.length || 0 });

      const result = {
        success: true,
        prospects_analyzed: parsed.reports?.length || 0,
        reports: parsed.reports || []
      };

      // Auto-handoff to outreach agent
      fetch(new URL("/api/agents/comms", req.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "lead-hunter",
          to: "outbound",
          type: "handoff",
          payload: { leads: result, action: "draft_outreach" },
          autoExecute: false
        })
      }).catch(() => {}); // Fire and forget

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[Leads API Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
