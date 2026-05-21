import { createAgentRoute } from "@/lib/agent-factory";
import { sanitizeString, errorResponse } from "@/lib/api-guard";
import { nimChat } from "@/lib/nvidia";

/**
 * MEETING NOTES AGENT — Transcribe and summarize meetings.
 *
 * Input: text transcript (or raw meeting notes)
 * Output: structured summary with action items, decisions, and follow-ups.
 *
 * Uses Nemotron Ultra for high-quality summarization.
 */
export const POST = createAgentRoute({
  name: "meeting-notes",
  // Wave-111.1 batch 4: memory hooks. Meetings on similar titles
  // (e.g. weekly "Engineering Sync") compound — past action items
  // can be cross-checked against this week's decisions to surface
  // unfollowed-through commitments.
  memory: {
    search: {
      query: (input) => `meeting title:${input.title ?? "Untitled Meeting"}`,
      limit: 3,
    },
    store: {
      extract: (result, input) => {
        const r = result as { summary?: string };
        if (!r.summary) return null;
        return `${input.title ?? "Untitled"}: ${r.summary.slice(0, 600)}`;
      },
      metadata: (input) => ({
        title: String(input.title ?? "Untitled Meeting"),
        kind: "meeting-notes",
      }),
    },
  },
  handler: async ({ input, pastContextAsPrompt }) => {
    // The agent-factory has already authenticated + parsed `input`;
    // the legacy guardRoute / request.json() paths below are dead and
    // would re-do work the factory has done. Use `input` directly.
    const body = input as { transcript?: string; title?: string };
    const transcript = sanitizeString(body.transcript ?? "", 50000);
    const meetingTitle =
      sanitizeString(body.title ?? "", 200) || "Untitled Meeting";

    if (!transcript) {
      return errorResponse("Missing 'transcript' field", 400, "MISSING_FIELD");
    }

    const pastMeetings = pastContextAsPrompt();

    const result = await nimChat(
      "nvidia/nemotron-ultra-253b-v1",
      [
        {
          role: "system",
          content: `You are a professional meeting note taker. Analyze the transcript and produce a structured summary in markdown format:

## Meeting Summary
Brief 2-3 sentence overview.

## Key Decisions
- Bullet list of decisions made

## Action Items
- [ ] Action item with owner name and deadline if mentioned

## Discussion Points
- Key topics discussed with brief context

## Follow-ups Required
- Items that need follow-up before next meeting

Be concise and factual. Do not add information not in the transcript.`,
        },
        {
          role: "user",
          content: `Meeting: "${meetingTitle}"${pastMeetings ? `\n\nPRIOR MEETING NOTES on this title (historical FACTS — surface unfollowed-through action items, do NOT restate):\n${pastMeetings}` : ""}\n\nTranscript:\n${transcript}`,
        },
      ],
      { maxTokens: 2000, temperature: 0.2 },
    );

    return {
      title: meetingTitle,
      summary: result,
      wordCount: typeof result === "string" ? result.split(/\s+/).length : 0,
      model: "nemotron-ultra-253b",
    };
  },
});
