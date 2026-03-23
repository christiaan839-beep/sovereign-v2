import { NextResponse } from "next/server";
import { guardRoute, sanitizeString, errorResponse } from "@/lib/api-guard";
import { nimChat } from "@/lib/nvidia";

/**
 * MEETING NOTES AGENT — Transcribe and summarize meetings.
 *
 * Input: text transcript (or raw meeting notes)
 * Output: structured summary with action items, decisions, and follow-ups.
 *
 * Uses Nemotron Ultra for high-quality summarization.
 */
export async function POST(req: Request) {
  try {
    const guard = await guardRoute();
    if (!guard.authorized) return guard.response;

    const body = await req.json();
    const transcript = sanitizeString(body.transcript, 50000);
    const meetingTitle = sanitizeString(body.title, 200) || "Untitled Meeting";

    if (!transcript) {
      return errorResponse("Missing 'transcript' field", 400, "MISSING_FIELD");
    }

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
          content: `Meeting: "${meetingTitle}"\n\nTranscript:\n${transcript}`,
        },
      ],
      { maxTokens: 2000, temperature: 0.2 }
    );

    return NextResponse.json({
      title: meetingTitle,
      summary: result,
      wordCount: typeof result === "string" ? result.split(/\s+/).length : 0,
      model: "nemotron-ultra-253b",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return errorResponse(message, 500, "AGENT_ERROR");
  }
}
