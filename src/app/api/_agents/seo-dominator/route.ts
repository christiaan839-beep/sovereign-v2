import { NextResponse } from "next/server";
import { nimChat } from "@/lib/nvidia";
import { research_ai } from "@/lib/ai";

/**
 * NEMOCLAW SEO DOMINATOR — Real keyword gap analysis, content velocity
 * scoring, and SERP position intelligence.
 * Uses Tavily for live SERP data + Nemotron Ultra for analysis.
 */

export async function POST(request: Request) {
  try {
    const { domain, keywords, mode = "audit" } = await request.json();

    if (!domain) {
      return NextResponse.json({ error: "domain is required." }, { status: 400 });
    }

    const start = Date.now();

    // Step 1: Live SERP research
    const keywordList = keywords || [`${domain} reviews`, `${domain} pricing`, `${domain} alternatives`];
    
    let serpIntel = "";
    try {
      serpIntel = await research_ai(
        `site:${domain} SEO analysis content marketing`,
        `Analyze the SEO performance of ${domain}. Identify: their top ranking keywords, content publishing frequency, backlink quality indicators, meta tag optimization, site speed indicators, and content gaps. Compare against competitors in their space.`
      );
    } catch {
      serpIntel = "Unable to perform live SERP analysis. Proceeding with domain-level assessment.";
    }

    if (mode === "audit") {
      const analysis = await nimChat(
        "nvidia/llama-3.1-nemotron-ultra-253b",
        [
          { role: "system", content: "You are an elite SEO strategist who has managed $100M+ in organic traffic. Provide specific, actionable SEO intelligence." },
          { role: "user", content: `Full SEO audit for ${domain}.\n\nLIVE SERP DATA:\n${serpIntel}\n\nKEYWORDS TO ANALYZE: ${keywordList.join(", ")}\n\nOutput JSON:\n{"domain_authority_estimate": 0-100, "content_velocity": "posts/month estimate", "keyword_gaps": [{"keyword": "term", "monthly_volume": "est", "difficulty": "LOW|MED|HIGH", "opportunity": "why this matters"}], "technical_issues": ["list"], "content_strategy": {"strengths": [], "weaknesses": [], "recommended_topics": ["5 specific topics to write"]}, "backlink_strategy": "recommendation", "estimated_organic_traffic": "monthly estimate", "dominance_score": 0-100}` },
        ],
        { maxTokens: 2500, temperature: 0.3 }
      );

      let parsed;
      try {
        parsed = JSON.parse(analysis.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      } catch {
        parsed = { raw: analysis };
      }

      return NextResponse.json({
        success: true,
        agent: "nemoclaw-seo-dominator",
        mode: "audit",
        domain,
        seo_intelligence: parsed,
        duration_ms: Date.now() - start,
      });
    }

    if (mode === "content-plan") {
      const plan = await nimChat(
        "mistralai/mistral-nemotron",
        [
          { role: "system", content: "You are an SEO content strategist. Create a 30-day content calendar with exact titles, target keywords, and word count goals." },
          { role: "user", content: `Create a 30-day SEO content plan for ${domain}.\n\nCurrent intel:\n${serpIntel}\n\nOutput a JSON array of 30 posts:\n[{"day": 1, "title": "Exact Blog Title", "target_keyword": "primary keyword", "word_count": 1500, "content_type": "pillar|supporting|comparison|how-to", "estimated_traffic": "monthly search volume"}]` },
        ],
        { maxTokens: 3000, temperature: 0.4 }
      );

      let parsed;
      try {
        parsed = JSON.parse(plan.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      } catch {
        parsed = { raw: plan };
      }

      return NextResponse.json({
        success: true,
        agent: "nemoclaw-seo-dominator",
        mode: "content-plan",
        domain,
        content_calendar: parsed,
        duration_ms: Date.now() - start,
      });
    }

    return NextResponse.json({ error: "mode must be 'audit' or 'content-plan'." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "SEO Dominator error", details: String(error) }, { status: 500 });
  }
}
