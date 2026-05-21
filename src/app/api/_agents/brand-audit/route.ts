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

const schema = z
  .object({
    competitorUrl: z.string().max(500).optional(),
    competitorName: z.string().max(200).optional(),
    yourBusiness: z.string().max(500).optional(),
    industry: z.string().max(200).optional(),
    prompt: z.string().max(5000).optional(),
    context: z.string().max(5000).optional(),
  })
  .refine((d) => d.competitorUrl || d.competitorName || d.prompt, {
    message: "Provide a competitorUrl, competitorName, or prompt",
  });

export const POST = createAgentRoute({
  name: "brand-audit",
  schema,
  // Wave-111.1 batch 3: memory hooks. Prior audits on the same
  // competitor + your-business pairing compound into trend signal —
  // surface positioning shifts, repositioning attempts, retention
  // of weaknesses. Store the counter-strategy tagline + positioning
  // gap headline as the next-run anchor.
  memory: {
    search: {
      query: (input) =>
        `brand-audit competitor:${input.competitorName ?? input.competitorUrl ?? ""} yours:${input.yourBusiness ?? ""} industry:${input.industry ?? ""}`,
      limit: 3,
    },
    store: {
      extract: (result) => {
        const r = result as {
          result?: {
            counterStrategy?: { tagline?: string; positioning?: string };
            strengthsWeaknesses?: { positioningGaps?: string[] };
          };
        };
        const cs = r.result?.counterStrategy;
        const gaps = r.result?.strengthsWeaknesses?.positioningGaps;
        const parts: string[] = [];
        if (cs?.tagline) parts.push(`Counter-tagline: ${cs.tagline}`);
        if (cs?.positioning)
          parts.push(`Positioning: ${cs.positioning.slice(0, 240)}`);
        if (gaps && gaps.length > 0)
          parts.push(`Gaps: ${gaps.slice(0, 3).join("; ")}`);
        return parts.length > 0 ? parts.join(" | ") : null;
      },
      metadata: (input) => ({
        competitor: String(input.competitorName ?? input.competitorUrl ?? ""),
        yourBusiness: String(input.yourBusiness ?? ""),
        industry: String(input.industry ?? ""),
        kind: "brand-audit",
      }),
    },
  },
  handler: async ({ input, pastContextAsPrompt }) => {
    const competitorUrl = (input.competitorUrl as string) || "";
    const competitorName = (input.competitorName as string) || "";
    const yourBusiness = (input.yourBusiness as string) || "";
    const industry = (input.industry as string) || "Marketing technology";
    const context = (input.context as string) || "";
    const pastAudits = pastContextAsPrompt();

    let researchAvailable = false;
    const result = await research_ai(
      `${competitorUrl || competitorName} brand identity positioning strategy values tagline`,
      `Conduct a brand audit for ${competitorName || competitorUrl}.
COMPETITOR URL: ${competitorUrl || "Not provided"}
YOUR BUSINESS: ${yourBusiness || "Not specified"}
INDUSTRY: ${industry}
${context ? `CONTEXT:\n${context.slice(0, 2000)}` : ""}
${pastAudits ? `\nPRIOR AUDITS on this competitor (historical FACTS — surface trend changes, don't restate prior findings):\n${pastAudits}\n` : ""}
Provide a JSON response with: competitorBrand (name, tagline, brandVoice, values, targetAudience), strengthsWeaknesses (strengths, weaknesses, positioningGaps), counterStrategy (positioning, tagline, keyMessages, visualDirection), actionPlan (action, priority, impact).
Return ONLY valid JSON.`,
      { system: BRAND_SYSTEM, maxTokens: 3000 },
    );

    researchAvailable = result.length > 100;

    let parsed;
    try {
      const match = result.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(match ? match[0] : result);
    } catch {
      parsed = { raw: result };
    }

    await fireUserWebhook("Brand Audit", "Analysis Complete", parsed).catch(
      () => {},
    );

    return {
      success: true,
      agent: "brand-audit",
      researchGrounded: researchAvailable,
      result: parsed,
      timestamp: new Date().toISOString(),
    };
  },
});
