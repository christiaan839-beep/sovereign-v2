import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * YOUTUBE-SUMMARIZER — YouTube transcript → takeaways, timestamps, tweet thread.
 *
 * Takes a transcript (VTT, SRT, or plain text with time hints) and returns
 * a TL;DR, an array of bounded-size takeaways with nearest timestamps,
 * a drafted tweet thread, and a list of discussion questions for comments.
 *
 * Input:
 *   {
 *     transcript:    string,
 *     videoTitle?:   string,
 *     maxTakeaways?: number  // 3–10, default 5
 *   }
 *
 * Output (JSON):
 *   {
 *     tldr:                 string,
 *     takeaways:            Array<{ point: string, timestamp: string | null }>,
 *     tweetThread:          string[],
 *     discussionQuestions:  string[]
 *   }
 *
 * Pairs with:
 *   - `podcast-editor` — audio-only counterpart
 *   - `content-engine` — downstream publishing
 */

const YOUTUBE_SUMMARIZER_SYSTEM_PROMPT = `You are a video research analyst trained to extract durable insight from long-form video with editorial restraint.

${ANTI_SLOP_RULES}

## SUMMARIZATION RULES
1. NEVER fabricate timestamps or content. If the transcript has no visible time hints (VTT/SRT cues, "[00:14:22]" markers, explicit mentions), return timestamp: null for that takeaway instead of guessing. Better null than wrong.
2. If the transcript is thin (<500 words or clearly truncated), return fewer takeaways than requested and acknowledge the limit in the tldr ("Based on a partial transcript, …").
3. Each takeaway is one specific insight, 15–40 words, with the key number/name/claim. Not a topic heading.
4. The tweet thread is 5–8 tweets, each ≤260 chars. Tweet 1 is the hook (no "Thread 🧵" cliché). Final tweet ends with a concrete CTA or question.
5. Discussion questions are 3–5 open-ended, specific-to-the-video prompts that surface disagreement or experience — not generic ("what did you think?").
6. timestamp format is "HH:MM:SS" or "MM:SS"; use whichever matches the source cues.
7. Output VALID JSON only — no markdown fences, no prose, no trailing commas.`;

export const POST = createAgentRoute({
  name: "youtube-summarizer",
  requiredFields: ["transcript"],
  handler: async ({ input }) => {
    const { transcript, videoTitle, maxTakeaways = 5 } = input as {
      transcript: string;
      videoTitle?: string;
      maxTakeaways?: number;
    };

    const takeawayCap = Math.min(10, Math.max(3, Number(maxTakeaways) || 5));

    const prompt = `Summarize this YouTube video transcript. Return ONLY valid JSON matching the schema.

${videoTitle ? `TITLE: ${videoTitle}` : ""}
MAX TAKEAWAYS: ${takeawayCap}

TRANSCRIPT:
"""
${String(transcript).slice(0, 35_000)}
"""

SCHEMA:
{
  "tldr": string,
  "takeaways": [ { "point": string, "timestamp": string | null } ],
  "tweetThread": [ string ],
  "discussionQuestions": [ string ]
}`;

    const response = await ai(prompt, {
      system: YOUTUBE_SUMMARIZER_SYSTEM_PROMPT,
      maxTokens: 2500,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("YouTube summarization failed: model returned non-JSON output");
    }

    return { success: true, summary: parsed };
  },
});
