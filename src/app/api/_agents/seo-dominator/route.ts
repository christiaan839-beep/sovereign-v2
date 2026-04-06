import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { nimChat } from "@/lib/nvidia";
import { research_ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("seo-dominator");

/**
 * SEO DOMINATOR — Real keyword gap analysis, content velocity
 * scoring, and SERP position intelligence.
 *
 * Now uses createAgentRoute for full safety pipeline.
 */

const schema = z.object({
  domain: z.string().min(3, "Domain is required").max(200),
  keywords: z.array(z.string()).optional(),
  mode: z.enum(["audit", "content-plan"]).optional().default("audit"),
  prompt: z.string().optional(),
});

export const POST = createAgentRoute({
  name: "seo-dominator",
  schema,
  handler: async ({ input }) => {
    const { domain, keywords, mode } = input as z.infer<typeof schema>;
    const start = Date.now();

    // Step 1: Live SERP research — flag explicitly when unavailable
    const keywordList = keywords || [`${domain} reviews`, `${domain} pricing`, `${domain} alternatives`];
    let serpIntel = "";
    let serpAvailable = false;

    try {
      serpIntel = await research_ai(
        `site:${domain} SEO analysis content marketing`,
        `Analyze the SEO performance of ${domain}. Identify: top ranking keywords, content publishing frequency, backlink quality indicators, meta tag optimization, site speed indicators, and content gaps.`
      );
      serpAvailable = serpIntel.length > 50;
    } catch (err) {
      log.warn("SERP research unavailable for seo-dominator", { domain, error: String(err) });
    }

    if (mode === "audit") {
      const analysis = await nimChat(
        "nvidia/llama-3.1-nemotron-ultra-253b-v1",
        [
          {
            role: "system",
            content: "You are a senior SEO strategist. Provide specific, actionable SEO intelligence. Do NOT make up metrics — if data is unavailable, say so explicitly. Never fabricate domain authority scores or traffic numbers without real data.",
          },
          {
            role: "user",
            content: `Full SEO audit for ${domain}.\n\n${serpAvailable ? `LIVE SERP DATA:\n${serpIntel}` : "NOTE: Live SERP data was unavailable. Base your analysis on general domain knowledge and clearly mark any estimates."}\n\nKEYWORDS TO ANALYZE: ${keywordList.join(", ")}\n\nOutput JSON:\n{"domain_authority_estimate": "number or 'unknown'", "content_velocity": "posts/month estimate", "keyword_gaps": [{"keyword": "term", "monthly_volume": "est", "difficulty": "LOW|MED|HIGH", "opportunity": "why this matters"}], "technical_issues": ["list"], "content_strategy": {"strengths": [], "weaknesses": [], "recommended_topics": ["5 specific topics to write"]}, "backlink_strategy": "recommendation", "data_grounded": ${serpAvailable}, "dominance_score": "0-100 or 'insufficient data'"}`,
          },
        ],
        { maxTokens: 2500, temperature: 0.3 }
      );

      let parsed;
      try {
        parsed = JSON.parse(analysis.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      } catch {
        parsed = { raw: analysis };
      }

      return {
        success: true,
        agent: "seo-dominator",
        mode: "audit",
        domain,
        serpDataAvailable: serpAvailable,
        seo_intelligence: parsed,
        duration_ms: Date.now() - start,
      };
    }

    if (mode === "content-plan") {
      const plan = await nimChat(
        "nvidia/llama-3.1-nemotron-ultra-253b-v1",
        [
          {
            role: "system",
            content: "You are an SEO content strategist. Create a 30-day content calendar with exact titles, target keywords, and word count goals. Base recommendations on actual research data when available.",
          },
          {
            role: "user",
            content: `Create a 30-day SEO content plan for ${domain}.\n\n${serpAvailable ? `Current intel:\n${serpIntel}` : "No live SERP data available — create plan based on general best practices for this domain type."}\n\nOutput a JSON array of 30 posts:\n[{"day": 1, "title": "Exact Blog Title", "target_keyword": "primary keyword", "word_count": 1500, "content_type": "pillar|supporting|comparison|how-to", "estimated_traffic": "monthly search volume"}]`,
          },
        ],
        { maxTokens: 3000, temperature: 0.4 }
      );

      let parsed;
      try {
        parsed = JSON.parse(plan.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      } catch {
        parsed = { raw: plan };
      }

      return {
        success: true,
        agent: "seo-dominator",
        mode: "content-plan",
        domain,
        serpDataAvailable: serpAvailable,
        content_calendar: parsed,
        duration_ms: Date.now() - start,
      };
    }

    throw new Error("mode must be 'audit' or 'content-plan'");
  },
});
