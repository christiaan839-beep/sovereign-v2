import { createAgentRoute } from "@/lib/agent-factory";
import { research_ai } from "@/lib/ai";
import { nimChat } from "@/lib/nvidia";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * LEADS AGENT — Find real prospects using live web research.
 *
 * Uses Tavily to search for real companies, then NVIDIA Nemotron Ultra
 * to analyze, qualify, and draft personalized outreach.
 *
 * Input: { niche: string, location: string, product?: string, context?: string }
 * Output: { leads: Lead[], total: number }
 */

export const POST = createAgentRoute({
  name: "leads",
  requiredFields: ["niche"],
  handler: async ({ input }) => {
    const niche = input.niche as string;
    const location = (input.location as string) || "worldwide";
    const product = (input.product as string) || "";
    const context = (input.context as string) || "";

    // Step 1: Real web research via Tavily
    let webResearch = "";
    try {
      webResearch = await research_ai(
        `${niche} companies ${location} hiring growing 2026`,
        `Find real companies in the ${niche} industry located in ${location}. For each company found, identify: the company name, what they do, their website URL if available, and any recent news (funding, hiring, product launches). Focus on companies that would be good prospects for outreach.`
      );
    } catch (err) {
      // Don't hallucinate fake leads — flag that research was unavailable
      webResearch = "";
    }

    // Step 2: AI analysis + lead generation
    const prompt = `You are a B2B sales intelligence analyst. Based on the real web research below, generate a list of qualified prospects.

${webResearch ? `RESEARCH DATA:\n${webResearch}` : "NOTE: Web research was unavailable. Generate prospects based on your training knowledge but clearly mark all leads as UNVERIFIED. Do NOT fabricate specific website URLs — use 'unknown' instead."}

TARGET NICHE: ${niche}
LOCATION: ${location}
${product ? `PRODUCT/SERVICE BEING SOLD: ${product}` : ""}
${context ? `ADDITIONAL CONTEXT: ${context}` : ""}

${ANTI_SLOP_RULES}

Generate 5-10 qualified prospects. For each, provide:
- company_name: The real company name (from research if possible)
- industry: Their specific sub-industry
- location: City/region
- website: Their website URL (use real URLs from research, or best guess based on company name)
- signal: Why they're a good prospect right now (recent funding, hiring, expansion, etc.)
- contact_angle: A specific personalized outreach angle based on their situation
- score: 1-10 qualification score

Return ONLY valid JSON:
{
  "leads": [
    {
      "company_name": "...",
      "industry": "...",
      "location": "...",
      "website": "...",
      "signal": "...",
      "contact_angle": "...",
      "score": 8
    }
  ]
}`;

    const result = await nimChat(
      "nvidia/llama-3.1-nemotron-ultra-253b-v1",
      [
        { role: "system", content: "You are a B2B sales intelligence analyst. Output ONLY valid JSON. No markdown, no explanation." },
        { role: "user", content: prompt },
      ],
      { maxTokens: 3000, temperature: 0.4 }
    );

    let parsed;
    try {
      const cleaned = result.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return {
        success: true,
        leads: [],
        total: 0,
        raw: result.slice(0, 500),
        note: "AI returned non-JSON output. Raw text included for review.",
      };
    }

    const leads = parsed.leads || parsed.reports || [];

    return {
      success: true,
      leads,
      total: leads.length,
      niche,
      location,
      researchGrounded: webResearch.length > 50, // true if we got real web data
    };
  },
});
