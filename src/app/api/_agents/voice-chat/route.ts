import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * VOICE CHAT — Uses NVIDIA Nemotron VoiceChat for natural conversational AI.
 * This is the model specifically optimized for voice-first interactions.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { message, conversationHistory = [] } = await req.json();
    if (!message) return NextResponse.json({ error: "Missing message." }, { status: 400 });

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    if (!nimKey) return NextResponse.json({ error: "NVIDIA_NIM_API_KEY not configured." }, { status: 500 });

    const messages = [
      { role: "system", content: "You are Sovereign Copilot, a voice-first AI assistant. IMPORTANT: If this is an outbound call, you MUST identify yourself as an AI assistant at the start. Keep responses concise (2-3 sentences max), natural, and conversational. Avoid bullet points and markdown — speak like a human advisor." },
      ...conversationHistory.slice(-10),
      { role: "user", content: message },
    ];

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${nimKey}`,
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-voicechat",
        messages,
        max_tokens: 200,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      // Fallback to nemotron-3-super if voicechat unavailable
      const fallback = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
        body: JSON.stringify({
          model: "nvidia/nemotron-3-super-120b-a12b",
          messages,
          max_tokens: 200,
          temperature: 0.7,
        }),
      });
      const fbData = await fallback.json();
      return NextResponse.json({ response: fbData.choices?.[0]?.message?.content || "Voice model unavailable.", model: "nemotron-3-super-120b (fallback)" });
    }

    const data = await res.json();
    return NextResponse.json({
      response: data.choices?.[0]?.message?.content || "No response generated.",
      model: "nemotron-voicechat",
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
