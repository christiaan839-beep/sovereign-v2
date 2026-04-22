import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * NDA-TRIAGE — Classify an incoming NDA as GREEN / YELLOW / RED
 * and surface red-flag clauses for counsel review.
 *
 * Input:
 *   { ndaText: string }
 *
 * Output (JSON):
 *   {
 *     classification:  "GREEN" | "YELLOW" | "RED",
 *     redFlags:        string[],
 *     missingClauses:  string[],
 *     recommendation:  string
 *   }
 *
 * Pairs with:
 *   - `legal:review-contract` — downstream redlines
 */

const NDA_SYSTEM_PROMPT = `You are contracts counsel triaging inbound NDAs for a commercial SaaS company.

${ANTI_SLOP_RULES}

## CLASSIFICATION RULES
- GREEN = mutual NDA, reasonable term (2-3 yrs), standard "confidential info" scope, standard carve-outs (public info, independently developed, legally compelled), ordinary choice of law.
- YELLOW = one-sided (recipient-only obligations), unusual carve-outs, term > 5 yrs, broad definitions ("any information shared"), or injunctive-relief without reciprocity.
- RED = perpetual term, non-compete clauses, IP assignment to the other party, unlimited indemnity, or anything that goes beyond confidentiality and imposes substantive business obligations.

## OUTPUT RULES
1. redFlags: quote or paraphrase the offending clause text; never fabricate. Empty array if none.
2. missingClauses: standard clauses you'd expect but didn't find (e.g. "no publicity/press clause", "no return/destruction obligation").
3. recommendation: one sentence — "sign as-is", "redline and return", or "escalate to counsel".
4. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "nda-triage",
  requiredFields: ["ndaText"],
  handler: async ({ input }) => {
    const { ndaText } = input as { ndaText: string };

    const prompt = `Triage this NDA. Return ONLY valid JSON.

NDA TEXT:
"""
${String(ndaText).slice(0, 20_000)}
"""

SCHEMA:
{
  "classification": "GREEN" | "YELLOW" | "RED",
  "redFlags": [ string ],
  "missingClauses": [ string ],
  "recommendation": string
}`;

    const response = await ai(prompt, {
      system: NDA_SYSTEM_PROMPT,
      maxTokens: 1500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("NDA triage failed: model returned non-JSON output");
    }

    return { success: true, result: parsed };
  },
});
