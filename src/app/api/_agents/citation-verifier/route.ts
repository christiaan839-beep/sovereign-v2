import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * CITATION-VERIFIER — Given a factual claim and supposed source text,
 * verify whether the source actually supports the claim.
 *
 * Input:
 *   { claim: string, sourceText: string }
 *
 * Output (JSON):
 *   {
 *     verdict:        "supported"|"partially-supported"|"unsupported"|"contradicts",
 *     confidence:     number (0-1),
 *     relevantQuote:  string|null,
 *     discrepancies:  string[],
 *     recommendation: string
 *   }
 *
 * Pairs with:
 *   - `paper-summarizer` — upstream content extraction
 *   - `literature-review` — cross-paper synthesis
 */

const CITATION_SYSTEM_PROMPT = `You are a rigorous academic fact-checker. You verify whether a claim is truly supported by its cited source. Authors often overreach — your job is to catch it.

${ANTI_SLOP_RULES}

## VERDICT DEFINITIONS (strict)
- "supported" — the source text directly states the claim, or the claim is a straightforward paraphrase. Numbers, scope, and qualifiers match. Reserve for cases where a fair reader would agree the source says this.
- "partially-supported" — the source addresses the topic and leans the same direction, but the claim overstates magnitude, strips qualifiers, generalizes beyond the study population, or compresses nuance.
- "unsupported" — the source does not mention the claim at all, or only tangentially. The claim may still be true elsewhere, but this source does not evidence it.
- "contradicts" — the source states something incompatible with the claim (different direction of effect, opposite conclusion, explicit refutation).

## RULES
1. relevantQuote must be a verbatim passage from sourceText (up to 400 chars). If nothing in the source is relevant, set to null.
2. discrepancies[] enumerates specific mismatches: "claim says 70%, source says 43%", "claim omits 'in mice only' qualifier", "source covers 2018-2020, claim generalizes to 'always'".
3. Confidence reflects how certain you are about the verdict. Lower confidence is fine — a claim where the source is ambiguous may be 0.6 with verdict="partially-supported".
4. recommendation is actionable: "Revise claim to 'In adult mice, X increased Y by 43%'", "Remove citation — source does not support this claim", "Add qualifier 'in short-term studies'".
5. Never fabricate content that is not in sourceText. If sourceText is too short or empty, say so in discrepancies and set verdict="unsupported".

Output VALID JSON only — no markdown fences, no prose outside the JSON.`;

export const POST = createAgentRoute({
  name: "citation-verifier",
  requiredFields: ["claim", "sourceText"],
  handler: async ({ input }) => {
    const { claim, sourceText } = input as {
      claim: string;
      sourceText: string;
    };

    const prompt = `Verify whether the SOURCE TEXT supports the CLAIM. Return ONLY valid JSON.

CLAIM:
"""
${claim.slice(0, 4_000)}
"""

SOURCE TEXT (what the source actually says):
"""
${sourceText.slice(0, 20_000)}
"""

SCHEMA:
{
  "verdict": "supported"|"partially-supported"|"unsupported"|"contradicts",
  "confidence": number,
  "relevantQuote": string|null,
  "discrepancies": [ string ],
  "recommendation": string
}`;

    const response = await ai(prompt, {
      system: CITATION_SYSTEM_PROMPT,
      maxTokens: 2000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Citation verification failed: model returned non-JSON output");
    }

    return { success: true, ...(parsed as object) };
  },
});
