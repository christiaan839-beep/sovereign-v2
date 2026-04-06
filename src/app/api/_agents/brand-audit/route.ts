import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { research_ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";

/**
 * BRAND AUDIT — Analyzes a competitor's brand via live web research
 * and generates a counter-positioning strategy.
 */

const BRAND_SYSTEM = `You are a brand strategist who identifies positioning gaps and creates counter-strategies. Be specific — cite real observations, not generic advice.

${ANTI_SLOP_RULES}`;

const schema = z.object({
  competitorUrl: z.string().max(500).optional(),
  competitorName: z.string().max(200).optional(),
  yourBusiness: z.string().max(500).optional(),
  industry: z.string().max(200).optional(),
  prompt: z.string().max(5000).optional(),
  context: z.string().max(5000).optional(),
}).refine(
  (d) => d.competitorUrl || d.competitorName || d.prompt,
  { message: "Provide a competitorUrl, competitorName, or prompt" }
);

export const POST = createAgentRoute({
  name: "brand-audit",
  schema,
  handler: async ({ input }) => {
    const competitorUrl = (input.competitorUrl as string) || "";
    const competitorName = (input.competitorName as string) || "";
    const yourBusiness = (input.yourBusiness as string) || "";
    const industry = (input.industry as string) || "Marketing technology";
    const context = (input.context as string) || "";

    let researchAvailable = false;
    const result = await research_ai(
      `${competitorUrl || competitorName} brand identity positioning strategy values tagline`,
      `Conduct a brand audit for ${competitorName || competitorUrl}.
COMPETITOR URL: ${competitorUrl || "Not provided"}
YOUR BUSINESS: ${yourBusiness || "Not specified"}
INDUSTRY: ${industry}
${context ? `CONTEXT:\n${context.slice(0, 2000)}` : ""}

Provide a JSON response with: competitorBrand (name, tagline, brandVoice, values, targetAudience), strengthsWeaknesses (strengths, weaknesses, positioningGaps), counterStrategy (positioning, tagline, keyMessages, visualDirection), actionPlan (action, priority, impact).
Return ONLY valid JSON.`,
      { system: BRAND_SYSTEM, maxTokens: 3000 }
    );

    researchAvailable = result.length > 100;

    let parsed;
    try {
      const match = result.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : result);
    } catch {
      parsed = { raw: result };
    }

    await fireUserWebhook("Brand Audit", "Analysis Complete", parsed).catch(() => {});

    return {
      success: true,
      agent: "brand-audit",
      researchGrounded: researchAvailable,
      result: parsed,
      timestamp: new Date().toISOString(),
    };
  },
});
