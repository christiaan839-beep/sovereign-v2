import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { ai, research_ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("competitor-scan");

/**
 * COMPETITOR SCAN — Real web research + LLM analysis.
 * Uses Tavily to research the target, then synthesizes an intelligence report.
 *
 * Now uses createAgentRoute for full safety pipeline.
 * Removed fire-and-forget handoff — user triggers report generation separately.
 */

const schema = z.object({
  target: z.string().min(1, "Target company or domain is required").max(300).optional(),
  url: z.string().url().optional(),
  prompt: z.string().optional(),
  context: z.string().max(5000).optional(),
}).refine(
  (d) => d.target || d.url || d.prompt,
  { message: "Provide at least a target, URL, or prompt" }
);

export const POST = createAgentRoute({
  name: "competitor-scan",
  schema,
  handler: async ({ input }) => {
    const target = (input.target || input.url || input.prompt) as string;
    const context = (input.context as string) || "";
    const start = Date.now();

    // Step 1: Real web research — flag explicitly when unavailable
    let webIntel = "";
    let researchAvailable = false;
    try {
      webIntel = await research_ai(
        `${target} reviews criticism pricing competitors`,
        `Research ${target}: find public reviews, pricing details, known limitations, customer complaints, and how they compare to alternatives.`
      );
      researchAvailable = webIntel.length > 50;
    } catch (err) {
      log.warn("Web research unavailable for competitor-scan", { target, error: String(err) });
    }

    // Step 2: LLM analysis
    const analysis = await ai(
      `You are a competitive intelligence analyst. Produce a tactical intelligence report.

TARGET: ${target}

${researchAvailable ? `WEB RESEARCH:\n${webIntel}` : "NOTE: Web research was unavailable. Clearly mark all findings as estimates based on general knowledge. Do NOT fabricate specific data points, reviews, or statistics."}
${context ? `\nADDITIONAL CONTEXT:\n${context.slice(0, 2000)}` : ""}

OUTPUT (strict JSON):
{
  "threat_level": "HIGH|MEDIUM|LOW",
  "data_grounded": ${researchAvailable},
  "vulnerabilities": ["specific weaknesses${researchAvailable ? " with evidence from research" : " — mark as estimated"}"],
  "counter_strategies": ["specific actions to differentiate against this competitor"],
  "positioning_angles": ["3 ways to position against this competitor"]
}

Be specific and actionable. ${researchAvailable ? "Reference real findings from the research." : "Clearly distinguish fact from inference."} Output ONLY valid JSON.`,
      { system: "You are a strategic competitive analyst. Be specific. Never fabricate data.", maxTokens: 2500 }
    );

    let parsed;
    try {
      parsed = JSON.parse(analysis.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    } catch {
      parsed = {
        threat_level: "UNKNOWN",
        data_grounded: false,
        vulnerabilities: ["Analysis produced non-structured output"],
        counter_strategies: [analysis.substring(0, 300)],
        positioning_angles: [],
      };
    }

    return {
      success: true,
      target,
      researchGrounded: researchAvailable,
      threat_level: parsed.threat_level,
      vulnerabilities: parsed.vulnerabilities,
      counter_strategies: parsed.counter_strikes || parsed.counter_strategies,
      positioning_angles: parsed.positioning_angles || [],
      duration_ms: Date.now() - start,
    };
  },
});
