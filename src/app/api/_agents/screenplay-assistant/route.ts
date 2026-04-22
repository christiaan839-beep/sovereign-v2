import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * SCREENPLAY-ASSISTANT — Logline → beat sheet + three-act structure.
 *
 * Takes a one-sentence premise (logline), optional genre, target length,
 * and tone, then returns a full beat sheet with page targets, three
 * act-level summaries, a character cast, and thematic anchors.
 *
 * Input:
 *   {
 *     logline:       string,
 *     genre?:        string,
 *     targetLength?: "feature" | "short" | "tv-pilot",
 *     tone?:         string
 *   }
 *
 * Output (JSON):
 *   {
 *     beatSheet:  Array<{ beat: string, page: number, description: string }>,
 *     actOne:     string,
 *     actTwo:     string,
 *     actThree:   string,
 *     characters: string[],
 *     themes:     string[]
 *   }
 *
 * Pairs with:
 *   - `book-outliner` — prose-form counterpart
 *   - `content-engine` — downstream scene-level drafting
 */

const SCREENPLAY_ASSISTANT_SYSTEM_PROMPT = `You are a screenwriting consultant trained in Save-the-Cat and McKee-style structural analysis with taste honed on working writers' rooms.

${ANTI_SLOP_RULES}

## STRUCTURE RULES
1. NEVER cite specific films or shows as reference works. Talk about the archetypal beat pattern ("the hero rejects the call"), not "like in The Matrix." The only exception is if the logline itself names a film the writer is riffing on.
2. Do not fabricate production statistics, box-office numbers, or studio preferences — this is story-structure guidance only.
3. Beat pages are targets, not rules. Use 110 pages for feature, 60 for tv-pilot, 10 for short. If the caller omits targetLength, assume feature.
4. Standard 15-beat sheet minimum for feature: Opening Image, Theme Stated, Setup, Catalyst, Debate, Break Into Two, B Story, Fun and Games, Midpoint, Bad Guys Close In, All Is Lost, Dark Night of the Soul, Break Into Three, Finale, Final Image. Scale proportionally for shorter formats.
5. Characters list is the cast by role (e.g. "Maya — protagonist, disgraced engineer"). Name + one-line function. Up to 8 characters.
6. Themes are 2–4 phrase-length thematic questions the story is asking (e.g. "Is loyalty worth more than truth?"), not abstract nouns.
7. Output VALID JSON only — no markdown fences, no prose wrapper, no trailing commas.`;

export const POST = createAgentRoute({
  name: "screenplay-assistant",
  requiredFields: ["logline"],
  handler: async ({ input }) => {
    const { logline, genre, targetLength = "feature", tone } = input as {
      logline: string;
      genre?: string;
      targetLength?: "feature" | "short" | "tv-pilot";
      tone?: string;
    };

    const prompt = `Develop this logline into a full beat sheet and three-act structure. Return ONLY valid JSON matching the schema.

LOGLINE: ${logline}
TARGET LENGTH: ${targetLength}
${genre ? `GENRE: ${genre}` : ""}
${tone ? `TONE: ${tone}` : ""}

SCHEMA:
{
  "beatSheet": [ { "beat": string, "page": number, "description": string } ],
  "actOne":     string,
  "actTwo":     string,
  "actThree":   string,
  "characters": [ string ],
  "themes":     [ string ]
}`;

    const response = await ai(prompt, {
      system: SCREENPLAY_ASSISTANT_SYSTEM_PROMPT,
      maxTokens: 3000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Screenplay development failed: model returned non-JSON output");
    }

    return { success: true, screenplay: parsed };
  },
});
