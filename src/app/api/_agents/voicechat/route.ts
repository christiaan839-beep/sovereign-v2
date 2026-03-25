import { NextResponse } from "next/server";
import { nimChat } from "@/lib/nvidia";

/**
 * REAL-TIME VOICE AGENT — Uses NVIDIA Nemotron Voicechat
 * for live bidirectional AI voice conversation.
 * Now BYOK-aware via nimChat().
 */

export async function POST(request: Request) {
  try {
    const { text, context = "customer-support", voice_style = "professional" } = await request.json();

    if (!text) {
      return NextResponse.json({ error: "text is required." }, { status: 400 });
    }

    const contextPrompts: Record<string, string> = {
      "customer-support": "You are a warm, helpful customer support agent. Keep responses under 3 sentences. Be empathetic and solution-oriented. Never say 'I cannot help' — always offer an alternative.",
      "sales": "You are a confident sales professional. Keep responses conversational and under 3 sentences. Focus on understanding needs and directing toward a booking link.",
      "receptionist": "You are a professional receptionist. Greet callers warmly, gather their name and reason for calling, and offer to connect them or take a message.",
      "appointment": "You are a scheduling assistant. Help callers book, reschedule, or cancel appointments. Confirm all details before finalizing.",
    };

    const response = await nimChat(
      "nvidia/nemotron-voicechat",
      [
        { role: "system", content: `${contextPrompts[context] || contextPrompts["customer-support"]} Voice style: ${voice_style}. Respond as if speaking on a phone call — natural, concise, human.` },
        { role: "user", content: text },
      ],
      { maxTokens: 200, temperature: 0.8 }
    );

    return NextResponse.json({
      success: true,
      model: "nemotron-voicechat",
      context,
      voice_style,
      response,
      word_count: response.split(/\s+/).length,
      estimated_duration_seconds: Math.round(response.split(/\s+/).length / 2.5),
    });
  } catch (error) {
    return NextResponse.json({ error: "Voicechat error", details: String(error) }, { status: 500 });
  }
}
