import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * PAPER-SUMMARIZER — Convert raw paper text (OCR or copy-paste) into a
 * structured summary: abstract, key findings, methodology, limitations,
 * applicability, and citation.
 *
 * Input:
 *   { paperText: string, audience?: "expert"|"practitioner"|"layperson" }
 *
 * Output (JSON):
 *   {
 *     title:          string,
 *     abstract:       string,
 *     keyFindings:    string[],
 *     methodology:    string,
 *     limitations:    string[],
 *     applicability:  string,
 *     citation:       string|null
 *   }
 *
 * Pairs with:
 *   - `literature-review` — downstream cross-paper synthesis
 *   - `citation-verifier` — verify claims back against this summary's source
 */

const PAPER_SYSTEM_PROMPT = `You are a research analyst who distills papers into structured summaries. You never fabricate details that are not in the source. If the paper does not state its limitations, say so — do not invent generic ones.

${ANTI_SLOP_RULES}

## AUDIENCE TONE
- "expert" — preserve technical terms, cite specific metrics (p-values, effect sizes, sample sizes), assume field knowledge.
- "practitioner" — default. Plain language, define acronyms on first use, focus on "what does this mean for day-to-day work".
- "layperson" — no jargon, short sentences, translate stats into intuitions ("twice as likely", not "OR 2.1").

## FIELD RULES
1. title — verbatim from the paper if present; otherwise your best reconstruction from the text, prefixed with "[inferred] ".
2. abstract — 2-4 sentence plain-language summary of what the paper did and found. Not a copy of the paper's abstract section — a distillation for the chosen audience.
3. keyFindings[] — 3-6 specific, evidence-backed findings with numbers where possible. Not "the intervention worked", but "fasting reduced HbA1c by 0.8 percentage points over 12 weeks (n=142, p<0.01)". Honor the audience tone.
4. methodology — 1-2 sentences max. Include design (RCT, observational, meta-analysis), sample size, and duration if present.
5. limitations[] — ONLY those the paper itself states, or obvious ones the paper should have acknowledged but visibly did not (e.g., "no control group described"). Never invent limitations to pad the section. If the paper states none and none are obvious, return an array with a single entry: "No limitations stated by the authors or visible from this text." so the consumer knows this was checked, not skipped.
6. applicability — 1-2 sentences answering: "can a practitioner act on this tomorrow, and if so, how?". If the finding is too preliminary, say so.
7. citation — assembled reference (authors, year, title, venue) if derivable. null if the text does not provide enough to form one.

Output VALID JSON only — no markdown fences, no prose outside the JSON.`;

export const POST = createAgentRoute({
  name: "paper-summarizer",
  requiredFields: ["paperText"],
  handler: async ({ input }) => {
    const { paperText, audience } = input as {
      paperText: string;
      audience?: "expert" | "practitioner" | "layperson";
    };

    const targetAudience = audience ?? "practitioner";

    const prompt = `Summarize this paper for a ${targetAudience} audience. Return ONLY valid JSON.

PAPER TEXT:
"""
${paperText.slice(0, 40_000)}
"""

SCHEMA:
{
  "title": string,
  "abstract": string,
  "keyFindings": [ string ],
  "methodology": string,
  "limitations": [ string ],
  "applicability": string,
  "citation": string|null
}`;

    const response = await ai(prompt, {
      system: PAPER_SYSTEM_PROMPT,
      maxTokens: 2500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Paper summarization failed: model returned non-JSON output");
    }

    return { success: true, ...(parsed as object) };
  },
});
