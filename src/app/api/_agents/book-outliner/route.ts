import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * BOOK-OUTLINER — Premise → chapter outline with word-count estimates.
 *
 * Takes a natural-language premise plus optional genre, target length
 * bucket, and POV preference, then returns a polished logline, chapter
 * count, per-chapter summaries with key scenes and word targets, plus
 * a character list and major themes.
 *
 * Input:
 *   {
 *     premise:       string,
 *     genre?:        string,
 *     targetLength?: "novella" | "standard" | "epic",
 *     pov?:          "first" | "third-limited" | "omniscient"
 *   }
 *
 * Output (JSON):
 *   {
 *     logline:       string,
 *     chapterCount:  number,
 *     chapters:      Array<{
 *       number:       number,
 *       title:        string,
 *       summary:      string,
 *       wordEstimate: number,
 *       keyScenes:    string[]
 *     }>,
 *     characters:    string[],
 *     majorThemes:   string[]
 *   }
 *
 * Pairs with:
 *   - `screenplay-assistant` — screen-form counterpart
 *   - `content-engine` — downstream chapter drafting
 */

const BOOK_OUTLINER_SYSTEM_PROMPT = `You are a fiction story editor trained on structural craft — rising action, turning points, motif, and voice — with taste honed on acquisitions desks.

${ANTI_SLOP_RULES}

## OUTLINING RULES
1. NEVER fabricate market data, comp-title sales figures, publishing trends, or reader preferences. This is creative structure only — do not claim "readers love X" or "agents want Y." Stay in the room with the story.
2. Target total word counts by length:
   - "novella": 30,000–50,000 words (~10–15 chapters)
   - "standard": 80,000–100,000 words (~25–30 chapters)
   - "epic": 140,000+ words (~40+ chapters)
   Default to "standard" if unspecified. Scale wordEstimate per chapter to hit the total.
3. Each chapter has a clear turn — something changes by the end. Avoid purely descriptive chapters.
4. Title chapters evocatively but functionally (e.g. "The Empty Harbor"), not with numbers-only or single-word labels.
5. keyScenes are 2–4 concrete scene seeds per chapter ("Maya confronts Rhen on the roof"), not abstract summaries.
6. Characters list is cast-and-function (e.g. "Maya — protagonist, cartographer with a secret"), up to 10 entries.
7. majorThemes are 3–5 short thematic questions the novel explores (e.g. "What does loyalty cost?"), not bare abstract nouns.
8. Output VALID JSON only — no markdown fences, no prose wrapper, no trailing commas.`;

export const POST = createAgentRoute({
  name: "book-outliner",
  requiredFields: ["premise"],
  handler: async ({ input }) => {
    const { premise, genre, targetLength = "standard", pov } = input as {
      premise: string;
      genre?: string;
      targetLength?: "novella" | "standard" | "epic";
      pov?: "first" | "third-limited" | "omniscient";
    };

    const prompt = `Outline this book premise into a full chapter-level plan. Return ONLY valid JSON matching the schema.

PREMISE: ${premise}
TARGET LENGTH: ${targetLength}
${genre ? `GENRE: ${genre}` : ""}
${pov ? `POV: ${pov}` : ""}

SCHEMA:
{
  "logline":       string,
  "chapterCount":  number,
  "chapters": [
    {
      "number":       number,
      "title":        string,
      "summary":      string,
      "wordEstimate": number,
      "keyScenes":    [ string ]
    }
  ],
  "characters":   [ string ],
  "majorThemes":  [ string ]
}`;

    const response = await ai(prompt, {
      system: BOOK_OUTLINER_SYSTEM_PROMPT,
      maxTokens: 4000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Book outlining failed: model returned non-JSON output");
    }

    return { success: true, outline: parsed };
  },
});
