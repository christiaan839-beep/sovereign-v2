import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";

/**
 * FUNNEL X-RAY — Analyzes competitor landing pages and generates superior variants.
 * Now uses createAgentRoute for full safety pipeline.
 */

const FUNNEL_XRAY_PROMPT = `You are a conversion rate optimization specialist. You analyze competitor funnels and engineer superior variants.

${ANTI_SLOP_RULES}

## ANALYSIS FRAMEWORK
When analyzing a competitor landing page, extract:
1. PRIMARY HOOK — The main headline/value proposition
2. PRICING MODEL — How they charge and package
3. PROOF ELEMENTS — Testimonials, case studies, logos
4. CTA STRUCTURE — Button copy, placement, urgency triggers
5. TRUST SIGNALS — Guarantees, certifications, social proof
6. LAYOUT PATTERN — Z-pattern, F-pattern, single column
7. COPY WEAKNESSES — Generic claims, missing specificity
8. VISUAL WEAKNESSES — Stock photos, cluttered layout, poor hierarchy`;

const schema = z.object({
  action: z.enum(["analyze", "synthesize"]),
  url: z.string().max(500).optional(),
  analysis: z.record(z.string(), z.unknown()).optional(),
  prompt: z.string().max(5000).optional(),
}).refine(
  (d) => (d.action === "analyze" && d.url) || (d.action === "synthesize" && d.analysis) || d.prompt,
  { message: "analyze requires url; synthesize requires analysis" }
);

export const POST = createAgentRoute({
  name: "funnel-xray",
  schema,
  handler: async ({ input }) => {
    const { action, url, analysis } = input as z.infer<typeof schema>;

    if (action === "analyze") {
      const result = await ai(
        `Analyze this competitor landing page: ${url}\n\nBased on the domain and likely page structure, extract conversion intelligence.\n\nRespond in JSON:\n{"domain": "${url}", "primaryHook": {"text": "...", "score": 5, "weakness": "..."}, "pricingModel": {"structure": "...", "weakness": "..."}, "proofElements": {"count": 3, "types": [], "weakness": "..."}, "ctaStructure": {"primary": "...", "urgency": "low/medium/high", "weakness": "..."}, "overallConversionScore": 6, "topVulnerabilities": ["..."], "recommendedAttackVector": "..."}`,
        { system: FUNNEL_XRAY_PROMPT, maxTokens: 2000 }
      );

      let parsed;
      try {
        parsed = JSON.parse(result.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      } catch {
        parsed = { analysis: result, domain: url };
      }

      return { success: true, analysis: parsed };
    }

    if (action === "synthesize") {
      const result = await ai(
        `Based on this competitor analysis, generate a SUPERIOR landing page variant:\n\n${JSON.stringify(analysis, null, 2)}\n\nRespond in JSON with: superiorHook, pricingArchitecture, layout, ctas, socialProof, urgency, confidenceScore.`,
        { system: FUNNEL_XRAY_PROMPT, maxTokens: 3000 }
      );

      let parsed;
      try {
        parsed = JSON.parse(result.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      } catch {
        parsed = { synthesis: result };
      }

      await fireUserWebhook("FunnelXRay", "Synthesized", { url }).catch(() => {});
      return { success: true, synthesis: parsed };
    }

    throw new Error("Invalid action. Use: analyze, synthesize");
  },
});
