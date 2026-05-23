import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat } from "@/lib/nvidia";

/**
 * NEMOCLAW MEETING TRANSCRIBER — Process meeting transcripts and extract
 * actionable intelligence: decisions, action items, follow-ups, and auto-email drafts.
 * Uses Nemotron 3 Nano (262K context) for long transcript ingestion.
 */

export const POST = createAgentRoute({
  name: "meeting-transcriber",
  // Wave 116 M3 batch 10: memory hooks. Per-attendee-set + meeting-type
  // history compounds — last sprint's action items + recurring decisions
  // inform "what's still open vs delivered" framing.
  memory: {
    search: {
      query: (input) => {
        const attendees = Array.isArray(input.attendees)
          ? input.attendees.slice(0, 3).join(",")
          : "";
        return `meeting ${input.meeting_type ?? "general"} ${attendees}`.trim();
      },
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          decisions?: string[];
          action_items?: Array<{ owner?: string; task?: string }>;
        };
        const dec = (r.decisions ?? []).slice(0, 2).join(" · ");
        const act = (r.action_items ?? [])
          .slice(0, 2)
          .map((a) => `${a.owner ?? "?"}:${a.task ?? ""}`)
          .join(" · ");
        if (!dec && !act) return null;
        return `decisions=[${dec}] actions=[${act}]`;
      },
      metadata: (input) => ({
        meetingType:
          typeof input.meeting_type === "string"
            ? input.meeting_type
            : "general",
        kind: "meeting-transcriber",
      }),
    },
  },
  handler: async ({ input, email, userId }) => {
    const {
      transcript = "",
      meeting_type = "general",
      attendees,
    } = input as {
      transcript?: string;
      meeting_type?: string;
      attendees?: string[];
    };

    if (!transcript) {
      return { error: "transcript text is required." };
    }

    const start = Date.now();

    const analysis = await nimChat(
      "nvidia/nemotron-3-nano-30b-a3b",
      [
        {
          role: "system",
          content: `You are an executive assistant who processes meeting transcripts with surgical precision. Extract every actionable detail.`,
        },
        {
          role: "user",
          content: `Process this ${meeting_type} meeting transcript${attendees ? ` (Attendees: ${attendees.join(", ")})` : ""}.

TRANSCRIPT:
${transcript.substring(0, 200000)}

Output JSON:
{
  "meeting_summary": "3-sentence executive summary",
  "key_decisions": [{"decision": "what was decided", "owner": "who owns it", "deadline": "when"}],
  "action_items": [{"task": "specific task", "assigned_to": "person", "priority": "HIGH|MEDIUM|LOW", "deadline": "when"}],
  "follow_ups": [{"topic": "what needs follow-up", "with_whom": "person", "by_when": "date"}],
  "parking_lot": ["topics raised but not resolved"],
  "sentiment": "positive|neutral|tense|contentious",
  "auto_email": {
    "subject": "Meeting Recap: [topic]",
    "body": "Professional recap email ready to send"
  }
}

Output ONLY valid JSON.`,
        },
      ],
      { maxTokens: 3000, temperature: 0.2 },
    );

    let parsed;
    try {
      parsed = JSON.parse(
        analysis
          .replace(/```json?\n?/g, "")
          .replace(/```/g, "")
          .trim(),
      );
    } catch {
      parsed = { raw: analysis };
    }

    return {
      success: true,
      agent: "nemoclaw-meeting-transcriber",
      meeting_type,
      transcript_stats: {
        characters: transcript.length,
        words: transcript.split(/\s+/).length,
        estimated_duration_minutes: Math.ceil(
          transcript.split(/\s+/).length / 150,
        ),
      },
      intelligence: parsed,
      duration_ms: Date.now() - start,
    };
  },
});
