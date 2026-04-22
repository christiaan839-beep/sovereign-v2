import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * PODCAST-EDITOR — Transcript → show notes, chapters, and promo copy.
 *
 * Takes a (potentially long) podcast transcript and returns markdown show
 * notes, chapter timestamps anchored in the transcript, social posts across
 * three platforms, and 3–5 pull-quote lines.
 *
 * Input:
 *   {
 *     transcript:    string,
 *     episodeTitle?: string,
 *     hostName?:     string,
 *     guestName?:    string
 *   }
 *
 * Output (JSON):
 *   {
 *     showNotes:   string (markdown),
 *     chapters:    Array<{ title: string, startSeconds: number }>,
 *     socialPosts: { twitter: string, linkedin: string, instagram: string },
 *     keyQuotes:   string[]
 *   }
 *
 * Pairs with:
 *   - `youtube-summarizer` — video counterpart
 *   - `content-engine` — downstream promo distribution
 */

const PODCAST_EDITOR_SYSTEM_PROMPT = `You are a podcast post-production editor trained to extract the signal from long conversations with editorial judgment.

${ANTI_SLOP_RULES}

## EDITING RULES
1. NEVER fabricate timestamps. Only use chapter startSeconds that correspond to moments clearly discoverable in the transcript — spoken-time markers, topic shifts, or explicit chapter cues. If the transcript has no time hints, estimate conservatively from reading-pace (≈150 words/minute) and set a reasonable schedule.
2. Do not invent quotes. keyQuotes must be verbatim (or near-verbatim with [bracketed] clarifications) from the transcript.
3. Chapter titles are 3–7 words, headline case, concrete and scannable (e.g. "How Stripe Priced Early Deals"). No hedging, no "Part 1" filler.
4. Show notes include: one-paragraph summary, 4–8 bulleted takeaways, guest bio if provided, links mentioned only if explicit in the transcript.
5. Social posts are platform-native: twitter = <240 chars with thread hook, linkedin = 120–180 words with a first-line hook, instagram = caption-style with line breaks and 3–5 hashtags.
6. Output VALID JSON only — no markdown fences, no prose wrapper, no trailing commas. Markdown inside showNotes is fine (that's the field's content).`;

export const POST = createAgentRoute({
  name: "podcast-editor",
  requiredFields: ["transcript"],
  handler: async ({ input }) => {
    const { transcript, episodeTitle, hostName, guestName } = input as {
      transcript: string;
      episodeTitle?: string;
      hostName?: string;
      guestName?: string;
    };

    const prompt = `Edit this podcast transcript into publishable post-production assets. Return ONLY valid JSON matching the schema.

${episodeTitle ? `EPISODE: ${episodeTitle}` : ""}
${hostName ? `HOST: ${hostName}` : ""}
${guestName ? `GUEST: ${guestName}` : ""}

TRANSCRIPT:
"""
${String(transcript).slice(0, 40_000)}
"""

SCHEMA:
{
  "showNotes": string (markdown),
  "chapters": [ { "title": string, "startSeconds": number } ],
  "socialPosts": { "twitter": string, "linkedin": string, "instagram": string },
  "keyQuotes": [ string ]
}`;

    const response = await ai(prompt, {
      system: PODCAST_EDITOR_SYSTEM_PROMPT,
      maxTokens: 3000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Podcast editing failed: model returned non-JSON output");
    }

    return { success: true, episode: parsed };
  },
});
