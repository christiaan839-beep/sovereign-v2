import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * GRANT-FINDER-WRITER — Org profile → matching grant categories + draft language.
 *
 * Takes an organization description and (optionally) project details, then
 * returns suggested grant categories, a fit-scored shortlist, and a draft
 * application narrative.
 *
 * Input:
 *   orgDescription: string  (required — mission, location, size, focus areas)
 *   fundingNeeded?: number
 *   projectDescription?: string
 *
 * Output (JSON):
 *   {
 *     suggestedGrants: [{ name, funder, typicalRange, fitScore, applicationAngle }],
 *     draftNarrative: string,
 *     evaluationCriteria: string[],
 *     commonPitfalls: string[]
 *   }
 *
 * Pairs with:
 *   - `rfp-responder` — enterprise/gov bid variant
 */

const GRANT_FINDER_SYSTEM_PROMPT = `You are a professional grant writer with a track record spanning federal, state, foundation, and corporate giving.

${ANTI_SLOP_RULES}

## HARD RULES
1. NEVER fabricate specific grant names, funder contacts, due dates, or program numbers. If you are not certain a specific grant exists, describe it by CATEGORY (e.g. "federal SBIR Phase I programs for health IT", "regional community foundation capacity-building grants") and mark the name with a clear descriptor like "(category)" or "(research target list)".
2. typicalRange should be an honest band (e.g. "$25k–$150k") based on category norms, not a precise claim about one grant.
3. fitScore (0-100) reflects alignment between the org's mission/focus and the grant category. Be candid — a 45 fit is useful information.
4. draftNarrative: 300-500 words, structure: problem → why now → approach → org qualifications → MEASURABLE outcomes → sustainability. End with 2-3 concrete, time-bound outcomes.
5. commonPitfalls[] must include the typical disqualifiers for the recommended categories (e.g. "Most federal R&D grants require a PI with matching field PhD").
6. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "grant-finder-writer",
  requiredFields: ["orgDescription"],
  handler: async ({ input }) => {
    const { orgDescription, fundingNeeded, projectDescription } = input as {
      orgDescription: string;
      fundingNeeded?: number;
      projectDescription?: string;
    };

    const prompt = `Find matching grant categories and draft application language. Return ONLY valid JSON matching the schema.

ORG DESCRIPTION:
"""
${orgDescription.slice(0, 5000)}
"""

${fundingNeeded ? `FUNDING NEEDED: $${fundingNeeded.toLocaleString()}\n` : ""}
${projectDescription ? `PROJECT:\n"""\n${projectDescription.slice(0, 5000)}\n"""\n` : ""}

SCHEMA:
{
  "suggestedGrants": [
    { "name": string, "funder": string, "typicalRange": string, "fitScore": number, "applicationAngle": string }
  ],
  "draftNarrative": string,
  "evaluationCriteria": [ string ],
  "commonPitfalls": [ string ]
}`;

    const response = await ai(prompt, {
      system: GRANT_FINDER_SYSTEM_PROMPT,
      maxTokens: 3000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Grant finder failed: model returned non-JSON output");
    }

    return { success: true, result: parsed };
  },
});
