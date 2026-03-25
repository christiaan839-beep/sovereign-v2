import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";

const REPORT_PROMPT = `You are a senior marketing analyst at a premium agency. You create executive-level performance reports that justify $5,000-$15,000/month retainers.

Your reports use REAL data patterns (when provided) or generate realistic example data when none is provided. Reports must feel data-driven, not generic.

${ANTI_SLOP_RULES}

## REPORT STRUCTURE
Generate a complete branded performance report in this JSON format:
{
  "title": "Monthly Performance Report — [Month] 2026",
  "executiveSummary": "2-3 sentence overview of wins and key metrics",
  "kpis": [
    { "metric": "Organic Traffic", "current": "12,847", "previous": "9,234", "change": "+39.1%", "status": "up" },
    { "metric": "Leads Generated", "current": "247", "previous": "183", "change": "+35.0%", "status": "up" }
  ],
  "sections": [
    {
      "title": "SEO Performance",
      "content": "Detailed analysis paragraph",
      "highlights": ["Highlight 1", "Highlight 2"],
      "chart_data": { "labels": ["Week 1", "Week 2", "Week 3", "Week 4"], "values": [234, 289, 312, 367] }
    }
  ],
  "recommendations": [
    { "priority": "HIGH", "action": "Specific recommendation", "expectedImpact": "Expected result with numbers" }
  ],
  "nextMonthFocus": ["Priority 1", "Priority 2", "Priority 3"]
}`;

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { clientName, businessType, reportPeriod, metrics, focus } = await req.json();

    const prompt = `Generate a comprehensive marketing performance report.

CLIENT: ${clientName || "Client"}
BUSINESS TYPE: ${businessType || "Local Business"}
REPORT PERIOD: ${reportPeriod || "March 2026"}
FOCUS AREAS: ${focus || "SEO, Content Marketing, Lead Generation, Social Media"}
${metrics ? `RAW METRICS PROVIDED:\n${JSON.stringify(metrics, null, 2)}` : "No raw metrics provided — generate realistic example data based on a growing local business."}

Include sections for:
1. Executive Summary (2-3 sentences, wins-focused)
2. KPI Dashboard (6-8 key metrics with month-over-month changes)
3. SEO Performance (rankings, traffic, keywords)
4. Content Performance (blog views, engagement, top content)
5. Lead Generation (total leads, conversion rate, cost per lead)
6. Social Media (follower growth, engagement rate, top posts)
7. Recommendations (3-5 prioritized actions for next period)
8. Next Month Focus Areas`;

    const result = await ai(prompt, { system: REPORT_PROMPT, maxTokens: 4000 });

    let parsed;
    try {
      const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { title: `Performance Report — ${reportPeriod || "March 2026"}`, executiveSummary: result, kpis: [], sections: [], recommendations: [], nextMonthFocus: [] };
    }

    await fireUserWebhook("ClientReport", "Generated", { clientName, period: reportPeriod });

    return NextResponse.json({ success: true, report: parsed });
  } catch (err) {
    console.error("[Client Report] Error:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
