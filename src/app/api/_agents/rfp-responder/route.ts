import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * RFP-RESPONDER — RFP doc → compliant draft response with section mapping.
 *
 * Takes an RFP document plus our company capabilities (and optionally past
 * wins) and produces an executive summary, section-by-section responses,
 * a compliance checklist, and a risk register.
 *
 * Input:
 *   rfpText: string  (required)
 *   companyCapabilities: string  (required — what we offer)
 *   pastWins?: string[]  (reference wins to draw language from)
 *
 * Output (JSON):
 *   {
 *     executiveSummary: string,
 *     sectionResponses: [{ rfpSection, response, supportingEvidence }],
 *     complianceChecklist: string[],
 *     risks: string[]
 *   }
 *
 * Pairs with:
 *   - `grant-finder-writer` — nonprofit grants variant
 */

const RFP_RESPONDER_SYSTEM_PROMPT = `You are a senior RFP / proposal response specialist with a track record of winning competitive government and enterprise bids.

${ANTI_SLOP_RULES}

## RESPONSE RULES
1. Map EVERY mandatory RFP requirement (must/shall/required) to a sectionResponses entry. If a requirement is missed, the compliance checklist MUST flag it.
2. Executive summary: 3-5 sentences, lead with the top evaluation criterion, end with a quantified differentiator.
3. Each section response must cite companyCapabilities language verbatim where possible. Past wins can be paraphrased as "similar engagement with [anonymized descriptor]".
4. supportingEvidence: reference a specific capability, cert, past-win metric, or data point. Never cite a fictional certification or client.
5. NEVER bluff. If our capabilities don't cover a requirement, write an honest response (gap acknowledged, mitigation proposed) and list it in risks.
6. Compliance checklist: one line per mandatory requirement, prefixed with [PASS] or [GAP].
7. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "rfp-responder",
  requiredFields: ["rfpText", "companyCapabilities"],
  handler: async ({ input }) => {
    const { rfpText, companyCapabilities, pastWins = [] } = input as {
      rfpText: string;
      companyCapabilities: string;
      pastWins?: string[];
    };

    const prompt = `Draft an RFP response. Return ONLY valid JSON matching the schema.

RFP TEXT:
"""
${rfpText.slice(0, 15_000)}
"""

OUR CAPABILITIES:
"""
${companyCapabilities.slice(0, 5000)}
"""

${pastWins.length ? `PAST WINS (reference only):\n${pastWins.slice(0, 10).map((w) => `- ${w.slice(0, 500)}`).join("\n")}\n` : ""}

SCHEMA:
{
  "executiveSummary": string,
  "sectionResponses": [
    { "rfpSection": string, "response": string, "supportingEvidence": string }
  ],
  "complianceChecklist": [ string ],
  "risks": [ string ]
}`;

    const response = await ai(prompt, {
      system: RFP_RESPONDER_SYSTEM_PROMPT,
      maxTokens: 4000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("RFP response failed: model returned non-JSON output");
    }

    return { success: true, response: parsed };
  },
});
