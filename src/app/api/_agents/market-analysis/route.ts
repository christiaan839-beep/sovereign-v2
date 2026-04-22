import { createAgentRoute } from "@/lib/agent-factory";
import { ai, research_ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * MARKET-ANALYSIS AGENT — Industry + competitive-positioning intelligence.
 *
 * Input:
 *   { industry: string, companyName?: string, region?: string, focus?: string }
 *
 * Output (JSON):
 *   {
 *     marketSize: { currentUsd: string|null, growthRate: string|null, horizon: string },
 *     keyTrends: string[],
 *     majorPlayers: Array<{ name: string, positioning: string, estimatedShare: string|null }>,
 *     opportunities: string[],
 *     threats: string[],
 *     recommendations: string[],
 *     researchGrounded: boolean,
 *     confidence: "high"|"medium"|"low"
 *   }
 *
 * Grounded whenever research_ai() returns meaningful text; otherwise the
 * agent flags researchGrounded: false and drops confidence to "low" rather
 * than hallucinating numbers.
 */

const MARKET_ANALYSIS_PROMPT = `You are a senior management consultant producing industry + competitive analyses.

${ANTI_SLOP_RULES}

## RULES
1. NEVER fabricate numerical market size — if research is missing, set fields to null and set researchGrounded to false.
2. Distinguish private estimates from verified public data: if a TAM number was stated by a named analyst firm (Gartner, IDC, Forrester), include the attribution in the value string (e.g., "US$4.2B (Gartner 2025)").
3. Major players must be real companies; if you cannot name them confidently, return an empty array rather than guessing.
4. Confidence is LOW when researchGrounded is false, MEDIUM with partial research, HIGH only with specific funded-firm-level data.
5. Output VALID JSON only — no markdown fences, no trailing commas, no prose outside the JSON.`;

export const POST = createAgentRoute({
  name: "market-analysis",
  requiredFields: ["industry"],
  handler: async ({ input }) => {
    const { industry, companyName, region, focus } = input as {
      industry: string;
      companyName?: string;
      region?: string;
      focus?: string;
    };

    let webResearch = "";
    try {
      const query = `${industry} market size ${region ?? ""} 2025 2026 competitive landscape major players`.trim();
      webResearch = await research_ai(query, `Research current market size, growth rate, and major players in ${industry}${region ? ` in ${region}` : ""}. Include analyst firm attributions where possible.`);
    } catch {
      webResearch = "";
    }

    const prompt = `Produce a market + competitive analysis as JSON.

INDUSTRY: ${industry}
${region ? `REGION: ${region}` : ""}
${companyName ? `COMPANY (for positioning): ${companyName}` : ""}
${focus ? `ANALYTICAL FOCUS: ${focus}` : ""}

${webResearch ? `RESEARCH DATA:\n${webResearch.slice(0, 8000)}` : "NOTE: Web research was unavailable. Set researchGrounded to false and confidence to low. Do NOT fabricate market-size numbers or named competitors. Return empty arrays instead of guesses."}

SCHEMA:
{
  "marketSize": { "currentUsd": string|null, "growthRate": string|null, "horizon": string },
  "keyTrends": [ string ],
  "majorPlayers": [ { "name": string, "positioning": string, "estimatedShare": string|null } ],
  "opportunities": [ string ],
  "threats": [ string ],
  "recommendations": [ string ],
  "researchGrounded": boolean,
  "confidence": "high"|"medium"|"low"
}`;

    const response = await ai(prompt, {
      system: MARKET_ANALYSIS_PROMPT,
      maxTokens: 2500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Market analysis failed: model returned non-JSON output");
    }

    return { success: true, analysis: parsed };
  },
});
