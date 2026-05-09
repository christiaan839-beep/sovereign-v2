import { createAgentRoute } from "@/lib/agent-factory";
import { NextResponse } from "next/server";
import { nimChat } from "@/lib/nvidia";

/**
 * REAL-TIME VOICE AGENT — Uses NVIDIA Nemotron Voicechat
 * for live bidirectional AI voice conversation.
 * Now BYOK-aware via nimChat().
 */

export const POST = createAgentRoute({
  name: "voicechat",
  handler: async ({ input, email, userId }) => {
    const {
      text = "",
      context = "customer-support",
      voice_style = "professional",
    } = input as {
      text?: string;
      context?: string;
      voice_style?: string;
    };

    if (!text) {
      return { error: "text is required." };
    }

    const contextPrompts: Record<string, string> = {
      "customer-support":
        "You are a warm, helpful customer support agent. Keep responses under 3 sentences. Be empathetic and solution-oriented. Never say 'I cannot help' — always offer an alternative.",
      sales:
        "You are a confident sales professional. Keep responses conversational and under 3 sentences. Focus on understanding needs and directing toward a booking link.",
      receptionist:
        "You are a professional receptionist. Greet callers warmly, gather their name and reason for calling, and offer to connect them or take a message.",
      appointment:
        "You are a scheduling assistant. Help callers book, reschedule, or cancel appointments. Confirm all details before finalizing.",
    };

    const response = await nimChat(
      "nvidia/nemotron-voicechat",
      [
        {
          role: "system",
          content: `${contextPrompts[context] || contextPrompts["customer-support"]} Voice style: ${voice_style}. Respond as if speaking on a phone call — natural, concise, human.`,
        },
        { role: "user", content: text },
      ],
      { maxTokens: 200, temperature: 0.8 },
    );

    return {
      success: true,
      model: "nemotron-voicechat",
      context,
      voice_style,
      response,
      word_count: response.split(/\s+/).length,
      estimated_duration_seconds: Math.round(
        response.split(/\s+/).length / 2.5,
      ),
    };
  },
});
