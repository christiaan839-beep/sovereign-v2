import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * LITERATURE-REVIEW — Cross-paper synthesis. Given 3-10 paper summaries,
 * identify consensus, surface conflicts with named opposing papers, note
 * gaps, and produce a narrative synthesis.
 *
 * Input:
 *   { papers: Array<{ title: string, abstract: string, findings?: string }>, topic?: string }
 *
 * Output (JSON):
 *   {
 *     consensus:          string[],
 *     conflicts:          Array<{ claim: string, supportingPapers: string[], opposingPapers: string[] }>,
 *     gapsInLiterature:   string[],
 *     synthesis:          string
 *   }
 *
 * Pairs with:
 *   - `paper-summarizer` — upstream per-paper extraction
 *   - `citation-verifier` — downstream claim-by-claim verification
 */

const LITREVIEW_SYSTEM_PROMPT = `You are a rigorous academic reviewer synthesizing multiple papers. You refuse to manufacture consensus where none exists, and you call out methodological conflicts explicitly.

${ANTI_SLOP_RULES}

## CONSENSUS RULES
1. A claim belongs in consensus[] only if AT LEAST three papers support it, OR the majority of provided papers support it with no meaningful opposition. With fewer supporting papers, phrase as "emerging — supported by [paper A, paper B]" inside consensus[] if you want to surface it.
2. Never invent consensus. If papers disagree, the disagreement belongs in conflicts[], not a smoothed-over sentence.
3. Consensus entries should be specific: "Intermittent fasting reduces fasting insulin in metabolically healthy adults" not "fasting is good".

## CONFLICT RULES
- conflicts[] items list a specific claim with supportingPapers and opposingPapers by title. Both arrays must be non-empty for a true conflict.
- Call out methodology type explicitly when it drives the conflict: "RCT (Smith 2024) vs observational cohort (Jones 2022)", or "animal study vs human trial". A conflict between an RCT and an observational study is not a true conflict of evidence — it is a conflict of evidence strength.

## GAPS
- gapsInLiterature[] are honest observations of what the provided papers do NOT cover: missing populations, missing timeframes, absent control conditions, unexplored mechanisms. Be specific.

## SYNTHESIS
- 3-6 sentence narrative of the state of the literature. Plain language. Weight evidence strength (RCT > cohort > case series). End with one sentence on the most important next research question.

## GENERAL
- Use paper titles verbatim from the input when referencing them.
- If only 1-2 papers are provided, consensus[] may be empty and gapsInLiterature[] should note the thin base.

Output VALID JSON only — no markdown fences, no prose outside the JSON.`;

export const POST = createAgentRoute({
  name: "literature-review",
  requiredFields: ["papers"],
  handler: async ({ input }) => {
    const { papers, topic } = input as {
      papers: Array<{ title: string; abstract: string; findings?: string }>;
      topic?: string;
    };

    const papersBlock = papers
      .slice(0, 20)
      .map((p, i) => {
        const findings = p.findings ? `\nFindings: ${p.findings.slice(0, 2_000)}` : "";
        return `[${i + 1}] ${p.title}\nAbstract: ${(p.abstract ?? "").slice(0, 3_000)}${findings}`;
      })
      .join("\n\n---\n\n");

    const prompt = `Synthesize the following papers into themes, consensus, conflicts, and gaps. Return ONLY valid JSON.

TOPIC / RESEARCH QUESTION: ${topic ?? "not specified — infer from papers"}

PAPERS:
"""
${papersBlock}
"""

SCHEMA:
{
  "consensus": [ string ],
  "conflicts": [
    {
      "claim": string,
      "supportingPapers": [ string ],
      "opposingPapers": [ string ]
    }
  ],
  "gapsInLiterature": [ string ],
  "synthesis": string
}`;

    const response = await ai(prompt, {
      system: LITREVIEW_SYSTEM_PROMPT,
      maxTokens: 3000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Literature review failed: model returned non-JSON output");
    }

    return { success: true, ...(parsed as object) };
  },
});
