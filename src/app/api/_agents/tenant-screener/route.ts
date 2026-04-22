import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * TENANT-SCREENER — Rental application → risk score + compliance flags.
 *
 * Takes an applicant description (NL or structured) and produces a
 * fair-housing-compliant risk assessment focused on financial and rental-
 * history signals only.
 *
 * Input:
 *   application: string  (required — NL description or JSON-stringified record)
 *   jurisdiction?: string  (optional — for fair-housing compliance context)
 *
 * Output (JSON):
 *   {
 *     riskScore: number (0-100),
 *     strengths: string[],
 *     concerns: string[],
 *     verdict: "strong" | "acceptable" | "marginal" | "decline",
 *     legalCautions: string[]
 *   }
 *
 * Pairs with:
 *   - `listing-writer` — upstream listing that attracted the applicant
 */

const TENANT_SCREENER_SYSTEM_PROMPT = `You are an experienced property manager conducting a LEGAL rental screening. Your assessment must comply with the US Fair Housing Act, state equivalents, and (where jurisdiction is given) local ordinances.

${ANTI_SLOP_RULES}

## HARD RULES — PROTECTED CLASSES
You MUST NOT factor, mention, or infer any of the following in your scoring, concerns, or verdict:
- Race, color, national origin, ancestry
- Religion, creed
- Sex, gender identity, sexual orientation
- Familial status (children, pregnancy, single-parent)
- Disability (physical or mental) or service-animal status
- Age (except legal minority — under 18)
- Marital status
- Source of income where protected (e.g. Section 8 in protected jurisdictions)

If the application contains info on any of these, IGNORE it entirely. If the applicant mentions such info, note in legalCautions that it must not be used.

## SCORING CRITERIA (the ONLY permitted factors)
1. Income-to-rent ratio: target ≥ 3× gross monthly rent. Score higher as ratio grows; lower as it approaches or falls below 2.5×.
2. Rental history: length at prior residences, reason for leaving, landlord references, eviction history (evictions are permitted to consider).
3. Employment stability: length of employment, role stability, consistency of income. Gaps are neutral unless unexplained.
4. Credit signals (payment history, collections) — permitted IF consistently applied to all applicants.

## OUTPUT RULES
- riskScore: 0 = highest risk (decline), 100 = strongest applicant.
- Verdict thresholds (guideline): strong ≥ 80, acceptable 60-79, marginal 40-59, decline < 40.
- legalCautions[] MUST include any fair-housing concern you observed (e.g. application mentioned a disability — ignored; consider jurisdiction rules on source-of-income discrimination).
- Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "tenant-screener",
  requiredFields: ["application"],
  handler: async ({ input }) => {
    const { application, jurisdiction } = input as {
      application: string;
      jurisdiction?: string;
    };

    const prompt = `Screen this rental application under fair-housing rules. Return ONLY valid JSON matching the schema.

${jurisdiction ? `JURISDICTION: ${jurisdiction}\n` : ""}
APPLICATION:
"""
${application.slice(0, 8000)}
"""

SCHEMA:
{
  "riskScore": number,
  "strengths": [ string ],
  "concerns": [ string ],
  "verdict": "strong" | "acceptable" | "marginal" | "decline",
  "legalCautions": [ string ]
}`;

    const response = await ai(prompt, {
      system: TENANT_SCREENER_SYSTEM_PROMPT,
      maxTokens: 1500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Tenant screening failed: model returned non-JSON output");
    }

    return { success: true, screening: parsed };
  },
});
